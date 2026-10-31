"""Passe la version test (v2-test) en version validée (v2).
Copie app.js et styles.css, et refait v2/index.html à partir de v2-test/index.html :
- sans le préfixe des données de test ni le bandeau VERSION TEST, titre « SVI ERP — V2 » ;
- au premier lancement sur un appareil, les données de la version test (préfixe « svitest: », bases « svitest_… »)
  sont copiées une fois vers la version validée, puis la page se recharge (drapeau svi_from_test_v1).
Lancer depuis la racine du dépôt :  python3 outils/publier_v2.py"""
import os, re, shutil, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T, V = os.path.join(R, "v2-test"), os.path.join(R, "v2")
s = open(os.path.join(T, "index.html"), encoding="utf-8").read()
shim = re.search(r"\n  <!-- VERSION DE TEST[^\n]*-->\n  <script>.*?</script>\n", s, re.S)
tag = re.search(r'\n  <div style="position:fixed;[^>]*id="sviTestTag">VERSION TEST</div>\n', s, re.S)
app = re.search(r'  <script src="(app\.js\?v=\d+)"></script>', s)
if not (shim and tag and app): sys.exit("v2-test/index.html : repères introuvables (préfixe, bandeau ou app.js)")
MIG = r'''
  <!-- v748 : premier lancement de la version validée sur cet appareil — reprise unique des données de la version test -->
  <script>
    (function () {
      var F = "svi_from_test_v1", P = "svitest:";
      try { if (localStorage.getItem(F)) return; } catch (e) { return; }
      var has = false;
      try { for (var i = 0; i < localStorage.length; i++) { if (String(localStorage.key(i)).indexOf(P) === 0) { has = true; break; } } } catch (e) {}
      if (!has) { try { localStorage.setItem(F, "rien"); } catch (e) {} return; }
      window.__sviMig = true;
      try {
        var K = []; for (var j = 0; j < localStorage.length; j++) { var k = String(localStorage.key(j)); if (k.indexOf(P) === 0) K.push(k); }
        K.forEach(function (k) { localStorage.setItem(k.slice(P.length), localStorage.getItem(k)); });
      } catch (e) {}
      var copy = function (name, store) { return new Promise(function (ok) {
        var a = indexedDB.open("svitest_" + name, 1);
        a.onupgradeneeded = function () { a.transaction.abort(); };   /* pas de base de test : rien à copier */
        a.onerror = function () { ok(); };
        a.onsuccess = function () {
          var src = a.result; if (!src.objectStoreNames.contains(store)) { src.close(); ok(); return; }
          var t = src.transaction(store, "readonly").objectStore(store), ks = t.getAllKeys(), vs = t.getAll();
          vs.onerror = function () { src.close(); ok(); };
          vs.onsuccess = function () {
            src.close();
            var b = indexedDB.open(name, 1);
            b.onupgradeneeded = function () { if (!b.result.objectStoreNames.contains(store)) b.result.createObjectStore(store); };
            b.onerror = function () { ok(); };
            b.onsuccess = function () {
              var dst = b.result; if (!dst.objectStoreNames.contains(store)) { dst.close(); ok(); return; }
              var w = dst.transaction(store, "readwrite"), o = w.objectStore(store);
              ks.result.forEach(function (key, n) { o.put(vs.result[n], key); });
              w.oncomplete = w.onerror = w.onabort = function () { dst.close(); ok(); };
            };
          };
        };
      }); };
      var end = function () { try { localStorage.setItem(F, new Date().toISOString()); } catch (e) {} location.reload(); };
      document.addEventListener("DOMContentLoaded", function () {
        var m = document.createElement("div");
        m.style.cssText = "position:fixed;inset:0;z-index:30000;background:#fff;display:flex;align-items:center;justify-content:center;font:800 14px Arial,sans-serif;color:#1f2937";
        m.textContent = "MISE À JOUR DE LA VERSION VALIDÉE : REPRISE DES DONNÉES DE CET APPAREIL…"; document.body.appendChild(m);
      });
      Promise.all([copy("svi_store", "kv"), copy("svi_files", "f")]).then(end, end);
    })();
  </script>
'''
s = s.replace(shim.group(0), MIG, 1).replace(tag.group(0), "\n", 1)
s = s.replace("<title>SVI ERP — TEST</title>", "<title>SVI ERP — V2</title>", 1)
s = s.replace(app.group(0), '  <script>if (!window.__sviMig) document.write(\'<script src="%s"><\\/script>\');</script>' % app.group(1), 1)
if "svitest:" in s.split("<!-- v748")[0] or "VERSION TEST" in s: sys.exit("index.html : reste de la version test")
open(os.path.join(V, "index.html"), "w", encoding="utf-8").write(s)
for f in ("app.js", "styles.css"): shutil.copyfile(os.path.join(T, f), os.path.join(V, f))
print("v2 publiée :", app.group(1))
