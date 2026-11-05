"""Assemble les fichiers de l'application à partir de src/ — un fichier par module (v753).
   python3 outils/assembler.py            → écrit app.js, app-budget.js, app-achats.js, app-autres.js
   python3 outils/assembler.py --verifier → vérifie qu'ils sont à jour (code de sortie 1 sinon)
Les fichiers de src/ sont la source : on modifie src/, puis on assemble.
Chaque fichier de src/ commence, dans l'assemblé, par une ligne repère « ⟪ src/… ⟫ ».

Modules (chargés dans cet ordre par index.html) :
  app.js         SOCLE COMMUN : stockage, base V3, Google, navigation, outils et filtres communs, démarrage,
                 fenêtres, paramétrage des unités, calendrier et saisie au clavier (tous les écouteurs globaux)
  app-budget.js  BUDGET : données et règles du budget, avenants, liste des budgets, écran d'un budget
  app-achats.js  ACHATS
  app-autres.js  AUTRES : BDS (décomposition) et formulaires CHS / BDS
Le socle garde ses fichiers dans l'ordre de leur nom ; dans chaque module aussi. Le nom app.js du socle est gardé :
le bouton NOUVELLE VERSION lit « app.js?v=… » dans la page publiée.
Un nouveau fichier de src/ doit être rangé dans MODULES (sinon l'assemblage s'arrête)."""
import os, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = "/* ⟪ src/{} ⟫ */\n"

MODULES = [
  ("app.js", "SOCLE COMMUN", ["00-", "01-", "02-", "02e-", "03-", "05-", "09-", "09c-", "09d-", "09e-", "09f-", "32-", "33-", "34-", "34b-", "35-"]),
  ("app-budget.js", "BUDGET", ["02b-", "02c-", "02d-", "02f-", "07-", "1", "2", "30-"]),
  ("app-achats.js", "ACHATS", ["4"]),
]

def plan():
    files = sorted(os.path.basename(f) for f in glob.glob(os.path.join(ROOT, "src", "*.js")))
    out, seen = [], set()
    for name, lab, pre in MODULES:
        L = [f for f in files if any(f.startswith(p) for p in pre) and f not in seen]
        seen.update(L)
        out.append((name, lab, L))
    left = [f for f in files if f not in seen]
    if left: sys.exit("FICHIERS SANS MODULE (à ranger dans MODULES de outils/assembler.py) : " + ", ".join(left))
    return out

def assemble():
    return [(name, "".join(MARK.format(f) + open(os.path.join(ROOT, "src", f), encoding="utf-8").read() for f in L), L) for name, lab, L in plan()]

if __name__ == "__main__":
    res = assemble()
    if "--verifier" in sys.argv:
        bad = [n for n, txt, L in res if not (os.path.exists(os.path.join(ROOT, n)) and open(os.path.join(ROOT, n), encoding="utf-8").read() == txt)]
        print("FICHIERS ASSEMBLÉS À JOUR" if not bad else "PAS À JOUR : " + ", ".join(bad) + " — lancer python3 outils/assembler.py")
        sys.exit(1 if bad else 0)
    for n, txt, L in res:
        open(os.path.join(ROOT, n), "w", encoding="utf-8").write(txt)
        print("%-14s %5d lignes  (%d fichiers)" % (n, txt.count("\n"), len(L)))
