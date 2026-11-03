# Sources de l'application (v2-test)

Depuis la v753, l'application est **assemblée en un fichier par module** à partir de ces fichiers : on modifie ici, puis

```
python3 outils/assembler.py          # écrit app.js, app-budget.js, app-achats.js, app-autres.js
python3 tests/test_app.py            # tests de non-régression
```

| Fichier assemblé | Module | Fichiers de src/ |
|---|---|---|
| `app.js` | SOCLE COMMUN (chargé en premier ; garde le nom app.js, lu par le bouton NOUVELLE VERSION) | 00, 01, 02, 02e, 03, 05, 09, 09c, 09d, 09e, 09f, 32, 33, 34, 35 |
| `app-budget.js` | BUDGET | 02b, 02c, 02d, 02f, 07, 10 à 27, 30 |
| `app-achats.js` | ACHATS | 40 à 45 |
| `app-autres.js` | AUTRES : BDS, formulaires CHS / BDS | 04, 06, 31 |

`index.html` charge les quatre fichiers dans cet ordre, avec le même numéro de version. Tous les écouteurs globaux (clavier, saisie, calendrier, menu) sont dans le socle, dans le même ordre qu'avant ; les autres modules ne contiennent que des déclarations (sauf ACHATS, qui démarre son écran). Un nouveau fichier de `src/` se range dans `MODULES` de `outils/assembler.py`, sinon l'assemblage s'arrête.

Les fichiers 11 à 27 forment ensemble la fonction `openBudgetDetail` (écran d'un budget) : ils se suivent et partagent les mêmes variables ; un fichier seul n'est donc pas un module JavaScript complet. Une ligne repère `/* ⟪ src/… ⟫ */` marque dans chaque fichier assemblé le début de chaque fichier de src/.

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
| `09c-filtres-communs.js` | tri et filtre par colonne façon tableur, COMMUNS à tous les écrans (budget, achats) : `sviCfKit` | 335 |
| `09d-couleurs-etats.js` | couleurs des états (EN INSTANCE, FIGÉ, VALIDÉ, EXPIRÉ, BLOQUÉ, ARCHIVÉ), paramétrables, variables CSS `--st-…` | 27 |
| `09f-fenetres-communes.js` | moteur commun des fenêtres et des achats : listes déroulantes et choix de fichier au format de l'application, ligne CRÉER … ICI, cases à droite au lieu des ✕, ANNULER puis l'action (v798) | 120 |
| `09f-masques-saisie.js` | masques de saisie (ICE, IF, RC, CNSS, téléphone) réglés dans PARAMÉTRAGE › FORMAT › MASQUES DE SAISIE : mise en forme pendant la frappe, contrôle à l'enregistrement (v804) | 60 |
| `10-bdg-liste.js` | liste des budgets (arborescence, avenants, CUMUL) | 2003 |
| `11-budget-ouverture.js` | ouverture d'un budget (début de openBudgetDetail) | 548 |
| `12-tableaux-colonnes.js` | ordre manuel des lignes du budget ; tri et filtre pris de 09c (`sviCfKit`) | 37 |
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
| `22c-ratios-multi-signature.js` | appel de « indicateurs (données), signatures » (v840 : le code est dans 28i-ratios-multi-signature.js) | 2 |
| `22d-contrat.js` | contrat : CPS, révision des prix, modalités de paiement, retenue de garantie | 254 |
| `22e-versions-scenarios.js` | scénarios et versions | 492 |
| `22f-plans.js` | appel de « plans et métré » (v838 : le code est dans 28g-plans.js) | 2 |
| `22g-indicateurs.js` | indicateurs : éléments, calcul, liste commune | 343 |
| `22h-tableau-de-bord.js` | appel de « tableau de bord » (v841 : le code est dans 28j-tableau-de-bord.js) | 2 |
| `22i-indicateurs-tableau.js` | tableau et graphique d'un indicateur | 195 |
| `22j-recalages.js` | appel des recalages (v832 : le code est dans 28-recalages.js) | 2 |
| `22k-approvisionnement.js` | appel de « APPROVISIONNEMENT PRÉVISIONNEL » (v836 : le code est dans 28e-approvisionnement.js) | 2 |
| `22l-indicateur-onglet.js` | appel de « onglet INDICATEURS (quatre parties, ESSAI) » (v839 : le code est dans 28h-indicateur-onglet.js) | 2 |
| `22m-comparatif.js` | appel de « COMPARATIF » (v837 : le code est dans 28f-comparatif.js) | 2 |
| `22n-bibliotheque.js` | appel de « bibliothèque de prix dans le budget, bandeau du CUMUL » (v835 : le code est dans 28d-bibliotheque.js) | 2 |
| `22o-etapes-onglets.js` | appel de « bloc à onglets AVENANTS / SCÉNARIOS / VERSIONS / RECALAGES (onglet AVENANTS, boutons de l'onglet ouvert, ouverture depuis la liste = scénario retenu) » (v834 : le code est dans 28c-etapes-onglets.js) | 2 |
| `23-apercus-impression.js` | aperçus PDF, impression | 1188 |
| `24-doc-historique-fenetres.js` | DOCUMENTS, TAF, OBSERVATIONS, historique | 466 |
| `25-inf.js` | fenêtre INF | 613 |
| `26-copier-coller.js` | copier, couper, coller | 710 |
| `26b-conditionnement.js` | appel de « emballage et découpe par titre de charges » (v833 : le code est dans 28b-conditionnement.js) | 2 |
| `27-etat-fin-budget.js` | FIGER, VALIDER, fin de openBudgetDetail | 716 |
| `28-recalages.js` | recalages, hors du grand bloc (v832, découpe étape 1) : sviBdgRecalages(C) | 100 |
| `28b-conditionnement.js` | emballage et découpe par titre de charges, hors du grand bloc (v833) : sviBdgConditionnement(C) | 112 |
| `28c-etapes-onglets.js` | bloc à onglets AVENANTS / SCÉNARIOS / VERSIONS / RECALAGES (onglet AVENANTS, boutons de l'onglet ouvert, ouverture depuis la liste = scénario retenu), hors du grand bloc (v834) : sviBdgEtapesOnglets(C) | 229 |
| `28d-bibliotheque.js` | bibliothèque de prix dans le budget, bandeau du CUMUL, hors du grand bloc (v835) : sviBdgBibliotheque(C) | 67 |
| `28e-approvisionnement.js` | APPROVISIONNEMENT PRÉVISIONNEL, hors du grand bloc (v836) : sviBdgAppro(C) | 192 |
| `28f-comparatif.js` | COMPARATIF, hors du grand bloc (v837) : sviBdgComparatif(C) | 298 |
| `28g-plans.js` | plans et métré, hors du grand bloc (v838) : sviBdgPlans(C) | 197 |
| `28h-indicateur-onglet.js` | onglet INDICATEURS (quatre parties, ESSAI), hors du grand bloc (v839) : sviBdgIndicateurOnglet(C) | 130 |
| `28i-ratios-multi-signature.js` | indicateurs (données), signatures, hors du grand bloc (v840) : sviBdgRatiosSignature(C) | 107 |
| `28j-tableau-de-bord.js` | tableau de bord, hors du grand bloc (v841) : sviBdgTableauBord(C) | 228 |
| `30-bdg-produits-charges-analyse.js` | analyse des produits et charges (budgets validés) | 652 |
| `31-formulaires-appui-long.js` | formulaires et appui long de BDS | 319 |
| `32-demarrage.js` | démarrage de l'application | 278 |
| `33-confirmations-sources.js` | fenêtres, messages, données source | 385 |
| `34-parametrage.js` | PARAMÉTRAGE : UNITÉS, BIBLIOTHÈQUE DE PRIX, calendrier du budget | 446 |
| `35-calendrier-saisie.js` | calendrier, saisie façon Google Sheets, cadre de sélection unique | 1451 |
| `40-achats-donnees.js` | ACHATS : données et règles des articles et paramètres (partagés par la base V3), lien avec les charges des budgets | 98 |
| `41-achats-ecran.js` | ACHATS : écran ARTICLES / FOURNISSEURS / PARAMÈTRES, corbeille, fusion, historique H | 320 |
| `42-achats-fournisseurs.js` | FOURNISSEURS : tableau (même format que les articles) et FICHE (identité, fiscal, RIB, conditions, familles, documents fiscaux, contacts, évaluations, contrats) | 200 |
| `43-achats-besoins.js` | BESOINS : tableau, fiche (budget › charge › tâche, contrôle du prévu, dépassement bloqué, déblocage justifié, validation, annulation) | 190 |
| `44-achats-consultations.js` | CONSULTATIONS (plusieurs fournisseurs, réponses, comparatif, clôture) et DEVIS ; tableau générique des listes d'achats (achListMod), choix multiple (achPickWin) | 260 |
| `45-achats-commandes.js` | COMMANDES (nature, avance, remise, transport, avenant, solder), RÉCEPTIONS (BL, photo, réserves, refus, tolérance), RETOURS de commande et de réception | 330 |
| `46-achats-factures.js` | FACTURES (rapprochement, doublon, écart, retenue à la source, avance imputée, échéance, bon à payer), AVOIRS, PAIEMENTS (règlement ou avance, chèque / LCN émis → encaissé ou rejeté) | 300 |
| `47-achats-liste-page.js` | Listes au format du budget (EN INSTANCE / VALIDÉS, dates, ligne CRÉER → fenêtre) et PAGE d'un élément (DOC / TAF / OBS en un bloc, menu ⋯, tableaux liés) : ARTICLES et FOURNISSEURS | 280 |

Documents du projet (ils font foi, plus de copie dans le dépôt) : document technique (architecture, données, recettes, tests) https://claude.ai/artifact/NJveG1A9Y5H3k8n4rAERdk ; document unique de forme https://claude.ai/artifact/1vKCKKCn3LKzAtq8YVL3FW ; cahier des charges https://claude.ai/artifact/5rU5qrhQHpbfEvqtRbgftq ; note de reprise https://claude.ai/artifact/8Uve95a1yLjvC315u1Hi5x ; feuille de route https://claude.ai/artifact/KMtD6rVXWgWoPQzkbppcoS.
