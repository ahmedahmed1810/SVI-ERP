# SVI ERP — Document technique (version test `/v2-test/`)

Mise à jour : 27/10/2026, v648 (fin de la refonte, étapes 0 à 12).
Pour un informaticien qui reprend le code. Les règles métier sont dans le cahier des charges du projet (documents `claude/cahier/00` à `08`, INDEX) ; la forme (écrans, fenêtres, couleurs) dans le FORMAT (mêmes documents, chapitre FORME). Ce document dit **où** est chaque chose dans le code et **comment** la faire évoluer.

## 1. Vue d'ensemble

- Application web d'une seule page, sans cadriciel ni compilation : `index.html`, `styles.css`, `app.js`.
- Données de référence (CHS, budgets validés, base V3) : Google Sheets, lues par un script Google Apps Script (`API_URL`, `API_KEY` dans `src/00-socle.js` ; fonctions `apiGet` (`src/03-api-drive.js`) et `apiSrc` (`src/33-confirmations-sources.js`)).
- **Budgets en instance** (en cours de saisie) : sur l'appareil, dans IndexedDB (`svi_store`, clé `svi_bdg_inst_v1`) — `src/02-stockage-instance.js` (`sviInstGet`, `sviInstSet`, `sviInstFlush`).
- Réglages d'affichage (largeurs, ordre des colonnes, filtres mémorisés, dernière vue…) : `localStorage` (clés `svi_…`).
- Hébergement : GitHub Pages (dépôt `ahmedahmed1810/SVI-ERP`) ; `/v2/` = version validée, `/v2-test/` = version test.

## 2. Code source et assemblage

- La source est dans `src/*.js`. **`app.js` est assemblé** : `python3 outils/assembler.py` concatène les fichiers de `src/` dans l'ordre de leur nom (repère `/* ⟪ src/… ⟫ */` en tête de chacun). On ne modifie jamais `app.js` à la main.
- Liste et rôle des fichiers : `src/LISEZ-MOI.md`.
- **Le grand bloc** : les fichiers `11` à `27` forment ensemble une seule fonction, `openBudgetDetail(ref)` (ouverte en 11, fermée en 27), qui affiche un budget. Ils partagent ses variables (`INS`, `LK`, `shell`, `active`, `CF`…). Tout ce qui ne dépend d'aucune de ces variables en a été sorti :
  - `02b-donnees-budget.js` : forme des données, conversions des anciens budgets (`SVI_MIGRATIONS`, `sviMigrate`), enregistrement (`sviBudgetStore`), contrôle des doublons (`sviDataHasDup`) ;
  - `02c-planning-regles.js` : règles de dates du planning, calcul pur (`sviPlanLinkNeed`, `sviPlanNeed`, `sviPlanChainO`, `sviPlanMove`) ;
  - `02d-saisie-import-regles.js` : intitulés presque identiques (`sviIsNear`), lecture des imports (`sviImpDate`, `sviLinkType`, `sviSheetKind`, `sviBfNorm`) ;
  - `09-budget-outils.js` : 150 fonctions et constantes sans état sorties automatiquement du bloc (texte inchangé ; l'origine de chacune est notée).
- Socle global (hors bloc) : `00-socle.js` (constantes, calendrier en jours travaillés `sviWork`, `sviWAdd`, `sviWDur`…), `33-confirmations-sources.js` (fenêtres, messages), `35-calendrier-saisie.js` (calendrier, saisie au clavier façon Google Sheets, sélection de cases, cadre et point).

## 3. Données d'un budget en instance

Un budget = `{ ref, project, intitule, client, created, state ("instance" | "fige" | "valide"), data }`. `data` (appelé `INS` dans le code) :

| Clé | Contenu |
|---|---|
| `des` | désignations client `{ id, art, des, u, q, p, tva, t (titre), d (niveau), on (case cochée) }` |
| `lot`, `prim`, `sec` | lots (chemin « A / B »), activités primaires et secondaires `{ id, v, u, tw (jumelle), on }` |
| `prd`, `chg` | produits et charges `{ id, des, u, nbr, d1..d3, q, p, art, chs, on }` |
| `links` | liaisons `{ id, des, lot, prim, sec, prd: [{id}], chg: [{id, q}], on }` |
| `dlp` | dates par tâche `« lotId|secId » → [{ id, deb, fin, dmd, fmd }]` (plusieurs morceaux possibles ; `dmd` / `fmd` = demi-journée) |
| `dpred` | prédécesseurs `« tâche » → [{ k, t: "FD" | "DD", o (décalage) }]` |
| `dord` | ordre des tâches du planning |
| `cal` | calendrier du budget `{ we, off, on }` |
| `pdeb`, `gdeb`, `dbut` | début du projet, début de génération, date butoir |
| `hset`, `hrange`, `hval`, `plafR`, `appro`, `dlim`, `dinc`, `dcut` | réglages du graphique, plage DÉBUT – FIN, capacités, approvisionnement, ressource limitante, tâches incompressibles, coupe des tâches |
| `chgPar` | filtre CHARGES QUI FONT n % |
| `qq`, `qlt` | DÉTAIL QUALITÉ |
| `inc` | lignes d'IMPORT NON CRÉÉ |
| `src` | source du dernier import (ACTUALISER) |
| `fdV2`, `dmig86`, `dlpSec`, `secUV1`, `cleanV1`, `sortedV1`, `ordSyncV1` | drapeaux des conversions déjà faites (ne pas réutiliser ces noms) |

Enregistrement : toute modification appelle `insSave()` (13) → mise en ordre (`sviDataTidy`), annuler / rétablir (`shell.__undoTick`, 18), écriture regroupée (`sviBudgetStore`).

## 4. Mécanismes communs (à utiliser, ne pas refaire)

- **Filtres** : une seule liste, `FSRC` (`13-instance-saisie.js`, refonte étape 2). Chaque source (cases cochées d'un bloc, liaisons de MARGE, tâches cochées, ISOLER, plage DÉBUT – FIN, CHARGES QUI FONT, filtre du jour, IMPORT NON CRÉÉ, TÂCHES SANS CHARGE) y a `on`, `mark`, `n`, `clear`, `blk`, `tabs`, `lab`, `ord`. En découlent : l'ordre des filtres (`insCkOrd`), les liaisons retenues (`insCheckLinks`), les onglets bleus (`insTabFilt`), EFFACER d'un bloc et de tout (`fsClear`), le bandeau « AUCUNE LIGNE… », le point bleu de ⚠. Loupes de colonnes : `FS_CF` + `CF[table].f`.
- **Colonnes** : un tableau décrit ses colonnes en `[clé, libellé, valeur(ligne), classe]` ; `cfHead` (en-tête : tri, filtre, poignée de largeur), `cfApply` (tri et filtre), `coOrder` (ordre mémorisé), `cwGet` (largeur). Catalogue unique `SVI_COL` / `SVI_COL_T` (`12-tableaux-colonnes.js`) : largeur par défaut, poids dans les aperçus (`colPw`), format (`colFmt`).
- **Fenêtres** : `sviWinNew()` / `sviWinShow(d)` / `sviWinCard({ title, body, foot, cls, close })` (`33-confirmations-sources.js`) pour `#svConf` ; `sviPopNew()` / `sviPopShow(p)` pour les fenêtres au format INF (`#docPop`). Prêtes à l'emploi : `svConfirm`, `svChoose`, `sviAlert`, `svToast` (message près de la case, FORMAT 1). Échap = ✕.
- **Sélection, cadre, clavier** : 35 (`TSEL`, `sviCellOf`, `sviFrame`, poignée `#sviSelHandle`).

## 5. Planning, Gantt, graphique

- 17-1 liaisons (`dlyLinks`, `dlyNeedOf` → règles 02c) ; 17-2 lignes, ordre, `dlyApply` (seule porte d'entrée d'un changement de dates) ; 17-3 dessin du Gantt (`dlyGanttDraw`, pied fixe `dlyFoot`, ajustement à l'écran) ; 17-4 tableau et fenêtres ; 17-5 / 17-6 / 17-7 gestes (tableau, Gantt et graphique, pincements et échelle) ; 17-8 actions (`shell.__insDly`, objet X) ; 17-9 dessin du graphique (`dlyGraphHTML`) ; 17b calcul (GÉNÉRER / COMPRESSER `dlyPlanCompute`, capacités, données du graphique `dlyHistData`, commandes `dlyOrders`, rendement).
- Le Gantt ne se redessine que si la taille du tableau, du bloc ou la largeur des jours a changé (`host.__hk0`), ou à la demande (`host.__drawn = false; dlyGanttDraw()`).

## 6. Recettes

- **Ajouter une colonne** à un tableau : l'ajouter à sa liste de colonnes `[clé, libellé, valeur, classe]` ; lui donner une ligne dans `SVI_COL` (largeur, poids d'aperçu, format) ; tri, filtre, largeur, ordre, copie, export et aperçu suivent.
- **Ajouter un filtre** : une entrée dans `FSRC` (13) ; s'il réduit les autres blocs (`ord: true`), l'appliquer aussi dans `insCheckLinks` (13).
- **Ajouter une fenêtre** : `const d = sviWinNew(); d.innerHTML = sviWinCard({ … }); sviWinShow(d);`.
- **Ajouter une règle de calcul** : l'écrire sans écran dans `02c` / `02d` (ou un nouveau `02x`), l'appeler depuis le bloc, ajouter un test « règle … » dans `tests/test_app.py`.
- **Changer la forme des données** : ajouter une conversion à `SVI_MIGRATIONS` (02b) avec un nouveau drapeau ; ne jamais réutiliser un drapeau existant.

## 7. Tests et livraison

- `python3 tests/test_app.py` (Chromium sans réseau, budget d'essai TEST-1) : doit finir par « N / N TESTS RÉUSSIS ». Nouveaux tests : seulement pour les règles de calcul.
- `python3 tests/reference.py capture <dossier>` puis `compare <avant> <après>` : captures et texte de chaque écran (budget d'essai, et un vrai budget via `SVI_REF_BUDGET=<fichier .json>`, jamais mis dans le dépôt) ; sert à vérifier qu'une réorganisation ne change rien à l'écran.
- Livraison : modifier `src/` → `python3 outils/assembler.py` → tests → monter `app.js?v=` (et `styles.css?v=` si les styles changent) dans `index.html` → commit → push. L'application affiche alors « NOUVELLE VERSION — ACTUALISER ».
- Diagnostic d'un blocage à l'ouverture : `sviStep` (40 dernières étapes, `svi_steps_v1`), fenêtre OUVERTURE BLOQUÉE au démarrage, `?liste` dans l'adresse, TÉLÉCHARGER LE BUDGET / CHARGER UN FICHIER BUDGET.

## 8. Ce qui reste à faire pour aller plus loin

- Sortir aussi du grand bloc les parties qui gardent un état (liaisons et ronds, saisie, planning) : chacune deviendrait un module qui reçoit le budget ouvert au lieu de partager les variables. À faire partie par partie, avec les captures de référence.
- Feuille de styles : beaucoup de règles se corrigent l'une l'autre (`!important`) ; la ranger par partie demande de vérifier chaque écran.
