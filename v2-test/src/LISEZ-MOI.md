# Sources de l'application (v2-test)

`app.js` est **assemblé** à partir de ces fichiers : on modifie ici, puis

```
python3 outils/assembler.py          # écrit app.js
python3 tests/test_app.py            # tests de non-régression
```

Les fichiers 11 à 27 forment ensemble la fonction `openBudgetDetail` (écran d'un budget) : ils se suivent et partagent les mêmes variables ; un fichier seul n'est donc pas un module JavaScript complet. Une ligne repère `/* ⟪ src/… ⟫ */` marque dans `app.js` le début de chaque fichier.

| Fichier | Rôle | Lignes |
|---|---|---|
| `00-socle.js` | constantes, accès Google, calendrier en jours travaillés, outils communs | 411 |
| `01-onglets-donnees-outils.js` | données en mémoire (db), petits outils de saisie | 289 |
| `02-stockage-instance.js` | budgets sur l'appareil (IndexedDB) | 54 |
| `02b-donnees-budget.js` | données du budget : forme, conversions des anciens budgets, enregistrement, doublons | 104 |
| `02c-planning-regles.js` | règles de calcul du planning, sans écran (liaisons, décalage, déplacement) — testées | 31 |
| `02d-saisie-import-regles.js` | règles de saisie et d'import, sans écran — testées | 66 |
| `02e-synchro-base.js` | base V3 : envoi, fusion, verrous par zone, contrôle par les totaux, données partagées | 417 |
| `02f-avenants.js` | étapes d'un budget, consolidé GLOBAL, contradictions, chaîne d'origine | 144 |
| `03-api-drive.js` | appels au script Google, dossiers Drive | 388 |
| `04-bds-donnees.js` | chargement des données BDS (CHS retiré en v742) | 490 |
| `05-navigation.js` | menu principal (PARAMÉTRAGE / BDG) | 65 |
| `06-bds-configuration.js` | écran BDS (décomposition) | 708 |
| `07-bdg-chargement.js` | chargement des budgets validés | 179 |
| `09-budget-outils.js` | fonctions sans état du budget (calculs, emballage et chutes, échéancier, bibliothèque, CUMUL) | 1209 |
| `10-bdg-liste.js` | liste des budgets (arborescence, avenants, CUMUL) | 2003 |
| `11-budget-ouverture.js` | ouverture d'un budget (début de openBudgetDetail) | 548 |
| `12-tableaux-colonnes.js` | colonnes des tableaux (SVI_COL), en-têtes, tri, filtre, largeurs | 348 |
| `13-instance-saisie.js` | budget en instance : saisie, filtres (FSRC), totaux, calendrier de tâche insCal | 1644 |
| `14-doublons-classement.js` | doublons, classement, bandeau de liaison | 517 |
| `15-qualite.js` | DÉTAIL QUALITÉ | 1308 |
| `16-a-completer.js` | ⚠ À COMPLÉTER et FILTRES ACTIFS | 181 |
| `17-1-liaisons.js` | PLANNING : prédécesseurs, liaisons, décalages | 129 |
| `17-2-lignes-ordre.js` | PLANNING : lots, couleurs, marges, ordre, dlyApply | 338 |
| `17-3-gantt-dessin.js` | PLANNING : dessin du Gantt, pied fixe, ajustement | 510 |
| `17-4-tableau-fenetres.js` | PLANNING : tableau DÉLAIS, fenêtres PRÉDÉCESSEURS et AJOUTER | 490 |
| `17-5-gestes-tableau.js` | PLANNING : gestes du tableau | 321 |
| `17-6-gestes-gantt.js` | PLANNING : gestes du Gantt et du graphique | 536 |
| `17-7-gestes-echelle.js` | PLANNING : largeur des jours, pincement, poignées | 276 |
| `17-8-actions.js` | PLANNING : actions (shell.__insDly) | 657 |
| `17-9-graphique-dessin.js` | PLANNING : dessin du graphique | 263 |
| `17b-planning-auto.js` | GÉNÉRER / COMPRESSER, capacités, calendrier des charges, DATE OBJECTIF | 949 |
| `18-annuler-liaisons.js` | annuler / rétablir, liaisons (ronds, VALIDER, DÉLIER) | 1237 |
| `19-delais-disposition.js` | disposition des blocs, hauteurs en lignes entières | 611 |
| `20-glisser-lignes.js` | glisser des lignes et des titres | 462 |
| `21-export-import.js` | export / import (Excel, Google Sheets, autre budget), menu ⋯ | 2071 |
| `22-saisie-directe.js` | SAISIE DIRECTE | 609 |
| `22b-exploitation.js` | exploitation (ex-onglet MARGE) | 507 |
| `22c-ratios-multi-signature.js` | indicateurs (données), signatures | 98 |
| `22d-contrat.js` | contrat : CPS, révision des prix, modalités de paiement, retenue de garantie | 254 |
| `22e-versions-scenarios.js` | scénarios et versions | 492 |
| `22f-plans.js` | plans et métré | 187 |
| `22g-indicateurs.js` | indicateurs : éléments, calcul, liste commune | 343 |
| `22h-tableau-de-bord.js` | tableau de bord | 219 |
| `22i-indicateurs-tableau.js` | tableau et graphique d'un indicateur | 195 |
| `22j-recalages.js` | recalages | 90 |
| `22k-approvisionnement.js` | APPROVISIONNEMENT PRÉVISIONNEL | 184 |
| `22l-indicateur-onglet.js` | onglet INDICATEURS (quatre parties, ESSAI) | 121 |
| `22m-comparatif.js` | COMPARATIF | 151 |
| `22n-bibliotheque.js` | bibliothèque de prix dans le budget, bandeau du CUMUL | 59 |
| `23-apercus-impression.js` | aperçus PDF, impression | 1188 |
| `24-doc-historique-fenetres.js` | DOCUMENTS, TAF, OBSERVATIONS, historique | 466 |
| `25-inf.js` | fenêtre INF | 613 |
| `26-copier-coller.js` | copier, couper, coller | 710 |
| `26b-conditionnement.js` | emballage et découpe par titre de charges | 105 |
| `27-etat-fin-budget.js` | FIGER, VALIDER, fin de openBudgetDetail | 716 |
| `30-bdg-produits-charges-analyse.js` | analyse des produits et charges (budgets validés) | 652 |
| `31-formulaires-appui-long.js` | formulaires et appui long de BDS | 319 |
| `32-demarrage.js` | démarrage de l'application | 278 |
| `33-confirmations-sources.js` | fenêtres, messages, données source | 385 |
| `34-parametrage.js` | PARAMÉTRAGE : UNITÉS, BIBLIOTHÈQUE DE PRIX, calendrier du budget | 446 |
| `35-calendrier-saisie.js` | calendrier, saisie façon Google Sheets, cadre de sélection unique | 1451 |

Document technique (architecture, données, recettes, tests) : `../DOC-TECHNIQUE.md`.
