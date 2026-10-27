"""Garde-fous de la refonte (étape 0) : captures de référence et comparaison.

  python3 tests/reference.py capture <dossier>        captures + texte de chaque écran + temps d'ouverture
  python3 tests/reference.py compare <avant> <après>  écarts d'image et de texte, écran par écran

Budgets : TEST-1 (celui des tests) et, si la variable SVI_REF_BUDGET donne le chemin d'un fichier .json
téléchargé par TÉLÉCHARGER LE BUDGET, ce budget réel (jamais mis dans le dépôt).
Date figée au 27/10/2026 à 9 h : les traits AUJOURD'HUI restent à la même place d'un jour à l'autre."""
import os, sys, json, time, difflib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_app as T
from playwright.sync_api import sync_playwright

VIEW = {"width": 1180, "height": 820}
TABS = ["chg", "prd", "qlt", "dly", "lnk"]


def budgets():
    out = [json.loads(json.dumps(T.BUDGET))]
    p = os.environ.get("SVI_REF_BUDGET")
    if p and os.path.exists(p):
        o = json.load(open(p))
        out.append(o.get("budget", o))
    return out


def snap(pg, d, name):
    pg.wait_for_timeout(700)
    pg.screenshot(path=os.path.join(d, name + ".png"))
    txt = pg.evaluate("""() => { const p = document.querySelector('.bdg-d-page') || document.body;
        return p.innerText.replace(/[ \\t]+/g, ' ').split('\\n').map(s => s.trim()).filter(Boolean).join('\\n'); }""")
    open(os.path.join(d, name + ".txt"), "w").write(txt)


def capture(d):
    os.makedirs(d, exist_ok=True)
    T.serve()
    times = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for B in budgets():
            ref = B["ref"]; tag = "".join(c if c.isalnum() else "_" for c in ref)
            ctx = b.new_context(viewport=VIEW)
            pg = ctx.new_page()
            pg.clock.install(time="2026-10-27T09:00:00")
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.route("https://script.google.com/**", lambda r: r.abort())
            url = f"http://127.0.0.1:{T.PORT}/index.html"
            pg.goto(url); pg.wait_for_timeout(1500)
            pg.evaluate("b => { sviInstSet([b]); return sviInstFlush(); }", B)
            pg.evaluate("r => { localStorage.setItem('svi_lastbdg_v1', r); localStorage.setItem('svi_listmode_v1', 'inst'); localStorage.setItem('svi_dtab_v1', 'chg'); }", ref)
            pg.goto(url); pg.wait_for_timeout(1200)
            pg.evaluate("() => document.querySelector('.nav-btn[data-view=\"bdg\"]')?.click()"); pg.wait_for_timeout(600)
            t0 = time.time()
            pg.evaluate("async () => { await SVI_INST_READY; bdgRows = []; bdgLoaded = true; renderBudgetList(); }")
            times[ref] = round(time.time() - t0, 2)
            pg.evaluate("() => document.querySelectorAll('#svConf [data-x], #svConf .svc-close, [data-cancel]').forEach(x => { try { x.click(); } catch (e) {} })")
            snap(pg, d, tag + "-ouverture")
            for t in TABS:
                t1 = time.time()
                pg.evaluate("t => document.querySelector(`.bdg-d-tab[data-tab=\"${t}\"]`)?.click()", t)
                times[ref + " " + t] = round(time.time() - t1, 2)
                pg.evaluate("() => document.querySelector('#bdgTabs')?.scrollIntoView({ block: 'start' })")
                snap(pg, d, tag + "-" + t)
            if errs:
                open(os.path.join(d, tag + "-erreurs.txt"), "w").write("\n".join(errs))
            ctx.close()
        b.close()
    json.dump(times, open(os.path.join(d, "temps.json"), "w"), indent=1, ensure_ascii=False)
    print("captures :", d); print(json.dumps(times, ensure_ascii=False))


def compare(a, c):
    from PIL import Image, ImageChops
    bad = 0
    for n in sorted(f for f in os.listdir(a) if f.endswith(".png")):
        pa, pc = os.path.join(a, n), os.path.join(c, n)
        if not os.path.exists(pc): print("ABSENTE ", n); bad += 1; continue
        ia, ic = Image.open(pa).convert("RGB"), Image.open(pc).convert("RGB")
        if ia.size != ic.size: print("TAILLE  ", n, ia.size, ic.size); bad += 1; continue
        diff = ImageChops.difference(ia, ic).convert("L").point(lambda v: 255 if v > 24 else 0)
        px = sum(1 for v in diff.getdata() if v)
        ratio = px / (ia.size[0] * ia.size[1])
        ta, tc = open(pa[:-4] + ".txt").read().splitlines(), open(pc[:-4] + ".txt").read().splitlines()
        td = [l for l in difflib.unified_diff(ta, tc, lineterm="", n=0) if l[:1] in "+-" and l[:3] not in ("+++", "---")]
        ok = ratio < 0.002 and not td
        if not ok: bad += 1
        print(("OK      " if ok else "ÉCART   ") + n, f"{ratio * 100:.2f} % de pixels", ("" if not td else f"{len(td)} ligne(s) de texte : " + " | ".join(td[:4])))
    ta = json.load(open(os.path.join(a, "temps.json"))); tc = json.load(open(os.path.join(c, "temps.json")))
    for k in ta: print(f"temps {k} : {ta[k]} s → {tc.get(k)} s")
    print("écarts :", bad)
    return bad


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "capture": capture(sys.argv[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == "compare": sys.exit(1 if compare(sys.argv[2], sys.argv[3]) else 0)
    else: print(__doc__)
