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
        # remarque 59 (remplacée en v528) : lot choisi par son rond — la liste ne change plus d'ordre
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(400)
        o59 = pg.evaluate("() => [...document.querySelectorAll('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid]')].map(x => x.dataset.iid)")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(300)
        # v528 (remarque 3) : la liste des lots garde désormais son ordre quand on choisit un lot
        check("remarque 59 → v528 : lot choisi, la liste des lots garde son ordre", bool(o59) and o59.index("l1") > o59.index("l2"), o59)
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
        check("v523 remarque 6 : boutons-icônes à la même taille (36 × 36)", len(r6) > 3 and all(x == "36x36" for x in r6), r6)

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
            if (sc) sc.scrollTop += b.getBoundingClientRect().top - sc.getBoundingClientRect().top - 40; }"""); pg.wait_for_timeout(300)
        g = pg.evaluate("""() => { const a = document.querySelector('.lot-grp[data-path="TOIT / NIVEAU 2"]'), b = document.querySelector('.lot-grp[data-path="TOIT / NIVEAU 1"]'); if (!a || !b) return null;
            const ia = a.querySelector('input.lot-gname').getBoundingClientRect(), rb = b.getBoundingClientRect(); return [ia.left + ia.width / 2, ia.top + ia.height / 2, ia.left + ia.width / 2, rb.top + 2]; }""")
        if g:
            pg.mouse.move(g[0], g[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
            pg.mouse.move(d6[0], d6[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
        pg.mouse.move(c1[0], c1[1]); pg.mouse.down(); pg.wait_for_timeout(500); pg.mouse.move(c1[0], c1[1] + 30, steps=5); pg.wait_for_timeout(200)
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
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
        check("v529 remarque 2 : titres en bleu foncé sur ligne grisée partout (lots, désignations, planning)",
              t2 == ["rgb(30, 58, 138)", "rgb(228, 233, 241)", "rgb(30, 58, 138)", "rgb(30, 58, 138)"], t2)
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
        check("v530 remarque 2 : sous-groupe décalé au niveau des numéros de ses lots frères", q2 == [0, 30, 16], q2)
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
            pg.evaluate("x => { const h = document.querySelector('#dlyGantt'); h.scrollLeft = Math.max(0, x - h.getBoundingClientRect().left - Math.min(200, h.clientWidth / 2)); }", x); pg.wait_for_timeout(200)
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
        pg.mouse.move(st[0], st[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
        check("v532 : « GROUPE 6 » reste « GROUPE 6 » ; un nouveau titre garde son nom après d'autres glissements ; ses lots numérotés 6.1, 6.2",
              "GROUPE 6" in grp(n0) and "GROUPE 6" in grp(n1) and len(grp(n2)) == 2 and grp(n3) == grp(n2) and "6.1 ZONE B" in n0, [n0, n1, n2, n3])

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
        pg.mouse.move(s3[0], s3[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
        pg.mouse.move(s4[0], s4[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
        pg.mouse.move(s5[0], s5[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
        # R2 / R5 : barre en direct (compression), « AUCUN GAIN » ; un seul bouton dans le menu ⋯, plus de nivellement
        pg.evaluate(f"() => {DXJ}.plafSeg(0, 4)"); pg.wait_for_timeout(300)
        pg.evaluate(f"() => {DXJ}.plafSeg(0, 4)"); pg.wait_for_timeout(300)
        t2 = pg.evaluate(f"() => [{ins}.INS.dlp['l1|s1'][0].fin, (document.getElementById('svToast') || {{}}).textContent || '']")
        pg.evaluate("() => document.querySelector('#bdgTabs .blk-more')?.click()"); pg.wait_for_timeout(300)
        mn = pg.evaluate("() => (document.getElementById('blkMenu') || {}).textContent || ''")
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        check("v542 R2 / R5 : plafond recompresse aussitôt (4 J-H ÷ 4 = 1 jour), même nombre = AUCUN GAIN ; menu (v546) : vue, CLASSER PAR DÉBUT, APPROVISIONNEMENT — plus de COMPRESSER ni de JOUR / SEMAINE / MOIS",
              t2[0] == "2026-11-02" and "AUCUN GAIN" in t2[1] and "COMPRESSER LE PLANNING" not in mn and "GÉNÉRER" not in mn and "NIVELLEMENT" not in mn and "JOUR" not in mn.replace("PAR LOT", "").replace("CLASSER", "").split("GRAPHIQUE")[0].replace("AFFICHER PAR DÉBUT", "") and "CLASSER PAR DÉBUT" not in mn and "AFFICHER PAR LOT" not in mn and "AFFICHER PAR DÉBUT" in mn and "APPROVISIONNEMENT PRÉVISIONNEL" not in mn, [t2, mn[:200]])
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
        pg.evaluate("() => document.querySelector('#bdgTabs .blk-more')?.click()"); pg.wait_for_timeout(300)
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
              z1 == ["PLANNING"] and not z1b and vd[0] == ["l2|s1", "l1|s1"] and vd[1] and not vd[2] and vd[3] == '["l1|s1","l2|s1"]' and vl == ["l1|s1", "l2|s1"], [z1, z1b, vd, vl])
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
        pg.evaluate("() => document.querySelector('#bdgTabs .blk-more')?.click()"); pg.wait_for_timeout(300)
        v549m = pg.evaluate("() => [...document.querySelectorAll('#blkMenu [data-dly]')].map(b => b.dataset.dly).join(',') + '|' + [...document.querySelectorAll('#blkMenu .blk-hint')].map(e => e.textContent).join(',') + '|' + (document.getElementById('blkMenu') || {}).textContent")
        pg.evaluate("() => document.getElementById('blkMenu')?.remove()")
        check("v549 / v553 / v555 : plus de bouton AJOUTER sous le planning ni dans le menu ⋯ (P11 R3), ni RÉGLAGES DU GRAPHIQUE dans le menu (P11 R6) ; rubrique GRAPHIQUE ; barre marron de la barre verticale au bord droit du cadre (v552)",
              v549 == [False, True] and "add" not in v549m and "appr" not in v549m and "RÉGLAGES DU GRAPHIQUE" not in v549m, [v549, v549m])
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
              g2[0] <= g2[1] + 1 and g2[1] - g2[0] <= 8 and 0 <= g2[0] - g2[2] <= 12, g2)
        pg.evaluate("() => localStorage.removeItem('svi_dlyhh_v1')"); pg.evaluate(f"() => {DXJ}.hh(110)"); pg.wait_for_timeout(500)
        check("v550 : graphique plein écran stable quand la page défile ; graphique caché = barre « = » visible au bas de l'écran",
              len(set(g0)) == 1 and g0[0] > 0 and g1[0] < g1[1] and g1[1] - g1[0] < 60, [g0, g1])
        check("v547 R22 : COMPRESSER coupe la tâche autour de la pénurie (02-03 / 05-06) ; deux barres, pastille 2 ; MORCEAUX → RECOLLER = un seul morceau de 4 jours",
              m1[0] == '[["2026-11-02","2026-11-03"],["2026-11-05","2026-11-06"]]' and m1[1] == 2 and m1[2] == "2" and m2[0].startswith("MORCEAUX") and m2[1] == 2 and m3 == '[["2026-11-02","2026-11-05"]]', [m1, m2, m3])

        # v546 : remarques 14 à 35 (sauf 22)
        DXJ = "[...document.querySelectorAll('*')].find(e => e.__insDly).__insDly"
        pg.set_viewport_size({"width": 1180, "height": 900}); pg.wait_for_timeout(300)
        pg.evaluate(f"""() => {{ const X = {ins}; const I = X.INS;
            I.chg.forEach(r => {{ r.on = false; }});
            I.chg.push({{ id: 'w1', des: 'MACON', u: 'JH', q: 4, p: 100, on: true }}, {{ id: 'w2', des: 'MACON', u: 'JH', q: 2, p: 100, on: true }}, {{ id: 'w3', des: 'SABLE', u: 'M3', q: 10, p: 50, on: true }});
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
        pg.evaluate("() => document.querySelector('.blk-cfg-btn')?.click()"); pg.wait_for_timeout(300)
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
        pg.evaluate("() => document.querySelector('#bdgTabs .blk-more')?.click()"); pg.wait_for_timeout(300)
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
              h0 == [True, 0] and sc0 == "JOUR*,SEMAINE,MOIS" and sw[0] == "s" and sw[1] > 9 and not inf[0] and inf[1] != "", [h0, sc0, sw, inf])

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
        check("v545 remarque 1 : bouton AGRANDIR / RÉDUIRE visible juste à gauche du ⋯, plus dans le menu ; double toucher sur la barre de titre = rien",
              r1 == [True, True, True] and r1m is False and r1d == 0, [r1, r1m, r1d])
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
        k4c = pg.evaluate("() => /SABLE FIN\\|M3/.test(localStorage.getItem('svi_cond_chs_v1') || '')")
        pg.evaluate(f"() => {{ const X = {ins}; const I = X.INS; I.chg = I.chg.filter(r => !/^m[123]$/.test(r.id)); delete I.cond; X.insSave(); X.refreshAll(); }}"); pg.wait_for_timeout(300)
        pg.set_viewport_size({"width": 1180, "height": 820}); pg.wait_for_timeout(300)
        check("v542 remarque 4 : conditionnement sur le titre des charges regroupées et sur une charge seule (pas sur les lignes du titre), réglé pour l'article (tous les budgets)",
              k4 == [True, False, True] and "TOUS LES BUDGETS" in k4b and k4c, [k4, k4b[:160], k4c])

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
        with ctx.expect_page(timeout=5000) as pi:
            pg.evaluate("() => document.querySelector('[data-blk=\"client\"][data-act=\"pdf\"]')?.click()")
        pv = pi.value; pv.wait_for_timeout(1200)
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
            pg.mouse.move(a[0], a[1]); pg.mouse.down(); pg.wait_for_timeout(500)
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
        with ctx.expect_page(timeout=5000) as pi:
            pg.evaluate("() => { const s = [...document.querySelectorAll('*')].find(e => e.__sdp); s.__sdp(); }")
        pv = pi.value; pv.wait_for_timeout(1500)
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
        pg.evaluate("() => document.querySelector('[data-pill=\"obs\"]')?.click()"); pg.wait_for_timeout(400)
        o10 = pg.evaluate("() => [...document.querySelectorAll('#docPop select#recAtt option')].map(o => o.textContent + (o.selected ? '*' : '')).join(' | ')")
        pg.fill("#recText", "OBS TACHE AXE 10"); pg.evaluate("() => document.querySelector('#recSave').click()"); pg.wait_for_timeout(400)
        a10 = pg.evaluate("() => [...document.querySelectorAll('#recTable-obs tbody tr')].map(t => t.innerText.replace(/\\s+/g, ' ')).find(t => t.includes('OBS TACHE AXE 10')) || 'none'")
        n10a = pg.evaluate("() => [...document.querySelectorAll('#recTable-obs tbody tr')].filter(t => !t.querySelector('.empty')).length")
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"sec\"] .ins-li[data-iid=\"s1\"] .lk-rd')?.click()"); pg.wait_for_timeout(250)
        pg.evaluate("() => document.querySelector('.ins-hcol[data-ik=\"lot\"] .ins-li[data-iid=\"l1\"] .lk-rd')?.click()"); pg.wait_for_timeout(250)
        n10b = pg.evaluate("() => [...document.querySelectorAll('#recTable-obs tbody tr')].filter(t => !t.querySelector('.empty')).length")
        pg.evaluate("() => { Object.keys(localStorage).filter(k => k.startsWith('svi_obs_v1:')).forEach(k => { const L = JSON.parse(localStorage.getItem(k) || '[]').filter(x => x.text !== 'OBS TACHE AXE 10'); localStorage.setItem(k, JSON.stringify(L)); }); }")
        pg.evaluate(f"() => {ins}.refreshAll()"); pg.wait_for_timeout(300)
        check("v666 axe 10 : OBS créée avec la tâche choisie = RATTACHÉ À BDG › RDC › BETONNAGE (choix le plus fin d'office) ; liste limitée à l'élément choisi, tout au niveau du budget",
              "RDC › BETONNAGE*" in o10 and "BDG › RDC › BETONNAGE" in a10 and n10a >= 1 and n10b >= n10a, [o10, a10, n10a, n10b])

        check("aucune erreur JavaScript pendant les tests", not errs, errs[:3])
        b.close()
    srv.shutdown()
    bad = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(bad)} / {len(RESULTS)} TESTS RÉUSSIS")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
