# Sources de l'application (v2-test)

`app.js` est **assemblé** à partir de ces fichiers : on modifie ici, puis

```
python3 outils/assembler.py          # écrit app.js
python3 tests/test_app.py            # tests de non-régression
```

Les fichiers 11 à 27 forment ensemble la fonction `openBudgetDetail` (écran d'un budget) : ils se suivent et partagent les mêmes variables ; un fichier seul n'est donc pas un module JavaScript complet. Une ligne repère `/* ⟪ src/… ⟫ */` marque dans `app.js` le début de chaque fichier.

| Fichier | Lignes |
|---|---|
| `00-socle.js` | 441 |
| `01-onglets-donnees-outils.js` | 286 |
| `02-stockage-instance.js` | 51 |
| `02b-donnees-budget.js` | données du budget : forme, conversions des anciens budgets, enregistrement, doublons (refonte, étape 1) |
| `02c-planning-regles.js` | règles de calcul du planning, sans écran (liaisons, décalage, déplacement) — testées une par une (refonte, étape 5) |
| `03-api-drive.js` | 387 |
| `04-chs-bds-donnees.js` | 522 |
| `05-navigation-chs.js` | 209 |
| `06-bds-configuration.js` | 708 |
| `07-bdg-chargement.js` | 198 |
| `10-bdg-liste.js` | 1915 |
| `11-budget-ouverture.js` | 519 |
| `12-tableaux-colonnes.js` | 362 |
| `13-instance-saisie.js` | 1080 |
| `14-doublons-classement.js` | 410 |
| `15-qualite.js` | 963 |
| `16-a-completer.js` | 100 |
| `17-1-liaisons.js` | PLANNING : prédécesseurs, liaisons, décalages, respect des liaisons |
| `17-2-lignes-ordre.js` | PLANNING : lots, couleurs, marges, replis, ordre, lignes, liens, dlyApply, échelle |
| `17-3-gantt-dessin.js` | PLANNING : dessin du Gantt et de l'histogramme, hauteur à l'écran |
| `17-4-tableau-fenetres.js` | PLANNING : dates, tableau (insDlyHTML), fenêtres PRÉDÉCESSEURS et AJOUTER |
| `17-5-gestes-tableau.js` | PLANNING : gestes 1 — clic, saisie, clavier, glisser des lignes et des lots |
| `17-6-gestes-gantt.js` | PLANNING : gestes 2 — barres du Gantt, liaisons au doigt, histogramme, bulle |
| `17-7-gestes-echelle.js` | PLANNING : gestes 3 — largeur des jours, pincement, poignées |
| `17-8-actions.js` | PLANNING : actions (shell.__insDly, objet X) |
| `17-9-graphique-dessin.js` | dessin du graphique (dlyGraphHTML), sorti de dlyGanttDraw (refonte, étape 7) |
| `17b-planning-auto.js` | GÉNÉRER / COMPRESSER, plafond, ressource cochée, tâches incompressibles, commandes (v530, v542) |
| `18-annuler-liaisons.js` | 1123 |
| `19-delais-disposition.js` | 519 |
| `20-glisser-lignes.js` | 403 |
| `21-export-import.js` | 2075 |
| `22-saisie-directe.js` | 482 |
| `22b-exploitation.js` | onglet MARGE (v498, ex-LIAISONS VALIDÉES et EXPLOITATION) |
| `23-apercus-impression.js` | 1147 |
| `24-doc-historique-fenetres.js` | 541 |
| `25-inf.js` | 598 |
| `26-copier-coller.js` | 650 |
| `26b-conditionnement.js` | conditionnement / emballage d'un article (v530, remarque 4 en v542) |
| `27-etat-fin-budget.js` | 438 |
| `30-bdg-produits-charges-analyse.js` | 674 |
| `31-formulaires-appui-long.js` | 345 |
| `32-demarrage.js` | 302 |
| `33-confirmations-sources.js` | 349 |
| `34-parametrage.js` | 370 |
| `35-calendrier-saisie.js` | 378 |
