"""v915 (mission ALLÈGEMENT, étape 1) : MESURE DES TEMPS — démarrage, liste des budgets, ouverture d'un gros budget d'essai
(N désignations liées, données inventées), onglets, une saisie. Processeur ralenti ×4 (proche d'une tablette), sans réseau.
Lancer depuis v2-test :  python3 outils/mesure.py [N lignes, 400 par défaut] [étiquette]
Les temps sont en millisecondes ; « détail » = temps du code (JS), de la mise en page et du calcul des styles."""
import sys, json, os, time
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, "tests")
import test_app as T
from playwright.sync_api import sync_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
LAB = sys.argv[2] if len(sys.argv) > 2 else ""
RATE = 4

def big():
    B = json.loads(json.dumps(T.BUDGET)); D = B["data"]
    D["lot"] = [{"id": "l%d" % i, "v": "LOT %d" % i} for i in range(1, 21)]
    D["prim"] = [{"id": "p%d" % i, "v": "PRIM %d" % i} for i in range(1, 31)]
    D["sec"] = [{"id": "s%d" % i, "v": "SEC %d" % i, "u": "M3"} for i in range(1, 61)]
    D["prd"] = [{"id": "x%d" % i, "des": "PRODUIT %d" % i, "u": "M3", "nbr": 10, "d1": 1, "d2": 0.5, "d3": 2} for i in range(1, 81)]
    D["chg"] = [{"id": "c%d" % i, "art": "C%d" % i, "des": "CHARGE %d" % i, "u": "T", "q": 3, "p": 100 + i} for i in range(1, 151)]
    des, links = [], []
    for i in range(N):
        if i % 20 == 0: des.append({"id": "t%d" % i, "t": True, "d": 0, "art": str(i // 20 + 1), "des": "CHAPITRE %d" % (i // 20 + 1)})
        des.append({"id": "d%d" % i, "d": 1, "art": "%d.%d" % (i // 20 + 1, i % 20 + 1), "des": "DESIGNATION %d" % i, "u": "M3", "q": 10 + i % 7, "p": 1000 + i, "tva": 20})
        links.append({"id": "L%d" % i, "des": "d%d" % i, "lot": "l%d" % (i % 20 + 1), "prim": "p%d" % (i % 30 + 1), "sec": "s%d" % (i % 60 + 1),
                      "prd": [{"id": "x%d" % (i % 80 + 1)}], "chg": [{"id": "c%d" % (i % 150 + 1)}, {"id": "c%d" % ((i * 7) % 150 + 1)}]})
    D["des"], D["links"] = des, links
    return B

def M(cdp):
    m = {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}
    return {k: m.get(k, 0) for k in ("ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "TaskDuration")}
def D(a, b): return "JS %d / mise en page %d / styles %d" % tuple(round((b[k] - a[k]) * 1000) for k in ("ScriptDuration", "LayoutDuration", "RecalcStyleDuration"))
def main():
    srv = T.serve(); out = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1180, "height": 820})
        ctx.add_init_script("try { localStorage.setItem('svitest:svi_user_v1', 'TESTEUR'); localStorage.setItem('svitest:svi_tva_def_v1','20'); localStorage.setItem('svi_tva_def_v1','20'); } catch (e) {}")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://script.google.com/**", lambda r: r.abort())
        url = f"http://127.0.0.1:{T.PORT}/index.html"
        pg.goto(url); pg.wait_for_timeout(1500)
        pg.evaluate("b => { sviInstSet([b]); return sviInstFlush(); }", big())
        pg.evaluate("() => { localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.removeItem('svi_lastbdg_v1'); }")
        cdp = ctx.new_cdp_session(pg); cdp.send("Performance.enable")
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
        # 1. démarrage (moyenne de 3)
        S = []
        for k in range(3):
            pg.goto(url, wait_until="load")
            S.append(pg.evaluate("() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; }"))
            m = {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}
            S[-1]["script"] = round(m.get("ScriptDuration", 0) * 1000); S[-1]["heap"] = round(m.get("JSHeapUsedSize", 0) / 1e6, 1)
        out["démarrage (page prête, ms)"] = round(sum(s["load"] for s in S) / 3)
        out["temps JS au démarrage (ms)"] = round(sum(s["script"] for s in S) / 3)
        out["mémoire JS (Mo)"] = S[-1]["heap"]
        pg.wait_for_timeout(1500)
        pg.evaluate("() => document.querySelectorAll('#svConf').forEach(x => x.remove())")
        # 2. liste des budgets
        out["liste des budgets (ms)"] = pg.evaluate("""async () => { await SVI_INST_READY; const t = performance.now();
            document.querySelector('.nav-btn[data-view="bdg"]')?.click(); bdgRows = []; bdgLoaded = true; renderBudgetList();
            await new Promise(z => setTimeout(z, 0)); return Math.round(performance.now() - t); }""")
        pg.wait_for_timeout(800)
        # 3. ouverture du gros budget
        m0 = M(cdp)
        out["ouverture budget %d lignes (ms)" % N] = pg.evaluate("""async () => { const t = performance.now(); window.__sviAvOpen('TEST-1');
            for (let i = 0; i < 400 && !document.querySelector('.bdg-d-page #bdgTabBody'); i++) await new Promise(z => setTimeout(z, 5));
            await new Promise(z => requestAnimationFrame(() => setTimeout(z, 0))); return Math.round(performance.now() - t); }""")
        pg.wait_for_timeout(2500); out["  détail ouverture"] = D(m0, M(cdp))
        pg.evaluate("() => document.querySelectorAll('#svConf').forEach(x => x.remove())")
        # 4. onglets
        for tab in ["prd", "qlt", "dly", "chg", "unl", "lnk"]:
            m0 = M(cdp)
            out["onglet " + tab + " (ms)"] = pg.evaluate("""async t => { const b = document.querySelector('.bdg-d-tab[data-tab="' + t + '"]'); if (!b) return -1;
                const t0 = performance.now(); b.click(); await new Promise(z => requestAnimationFrame(() => setTimeout(z, 0))); return Math.round(performance.now() - t0); }""", tab)
            pg.wait_for_timeout(400); out["  détail " + tab] = D(m0, M(cdp))
            pg.evaluate("() => document.querySelectorAll('.tab-menu-pop, .sv-pop').forEach(x => x.remove())")
        # 5. une saisie (quantité de la 1re ligne)
        m0 = M(cdp)
        out["saisie quantité + recalcul (ms)"] = pg.evaluate("""async () => { const sh = [...document.querySelectorAll('*')].find(e => e.__ins); if (!sh) return -1; const X = sh.__ins;
            const t0 = performance.now(); X.INS.des[1].q = 99; X.insSave(); X.refreshAll(); await new Promise(z => requestAnimationFrame(() => setTimeout(z, 0))); return Math.round(performance.now() - t0); }""")
        pg.wait_for_timeout(300); out["  détail saisie"] = D(m0, M(cdp))
        out["erreurs"] = errs[:3]
        b.close()
    srv.shutdown()
    print(json.dumps({"label": LAB, **out}, ensure_ascii=False, indent=1))
    J = os.environ.get("SVI_MESURES")
    if J:
        with open(J, "a") as f: f.write(json.dumps({"label": LAB, "t": time.strftime("%H:%M"), **out}, ensure_ascii=False) + "\n")
main()
