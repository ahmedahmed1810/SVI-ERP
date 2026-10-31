"""Assemble app.js à partir des fichiers de src/ (dans l'ordre de leur nom).
   python3 outils/assembler.py            → écrit app.js
   python3 outils/assembler.py --verifier → vérifie que app.js est à jour (code de sortie 1 sinon)
Les fichiers de src/ sont la source : on modifie src/, puis on assemble.
Chaque fichier commence par une ligne repère « ⟪ src/… ⟫ » ajoutée à l'assemblage."""
import os, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = "/* ⟪ src/{} ⟫ */\n"

def assemble():
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, "src", "*.js"))):
        out.append(MARK.format(os.path.basename(f)) + open(f, encoding="utf-8").read())
    return "".join(out)

if __name__ == "__main__":
    txt = assemble()
    app = os.path.join(ROOT, "app.js")
    if "--verifier" in sys.argv:
        ok = os.path.exists(app) and open(app, encoding="utf-8").read() == txt
        print("app.js À JOUR" if ok else "app.js PAS À JOUR : lancer python3 outils/assembler.py")
        sys.exit(0 if ok else 1)
    open(app, "w", encoding="utf-8").write(txt)
    print("app.js ASSEMBLÉ (%d lignes)" % txt.count("\n"))
