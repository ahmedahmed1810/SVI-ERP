# Budget module (SVI ERP) — Laravel version

This branch (`laravel`) is a **straight conversion** of the static Budget app
(`v2-test`, version 420, branch `ui-bdg-list-2026-10-07`) into a Laravel 11 project
with Novapp's stack. Same pages, same features, same calculations, same texts and
the same Google Sheet connection. The static site on GitHub Pages is unchanged.

## Run it

(Not run on an iPad: this is for a developer's computer.)

Requirements: PHP 8.2+, Composer, Node 18+.

```bash
composer install
cp .env.example .env
php artisan key:generate
npm install
npm run dev          # Vite dev server (keep it running), or: npm run build
php artisan serve    # http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000/`, touch **SE CONNECTER** (stand-in login), and the
Budget app opens at `/dashboard/budget`.

`.env.example` uses file sessions and file cache, so no database is needed.

Tests: `php artisan test` (includes `tests/Feature/BudgetPageTest.php`).

## Pages and routes

All Budget routes are in `routes/budget.php`, loaded from `bootstrap/app.php`
(inside the `web` group), behind the `novapp.auth` middleware.

| URL | Route name | What it is |
|---|---|---|
| `GET /dashboard/budget` | `dashboard.budget.index` | The whole Budget app (single page): PARAMÉTRAGE (CHS, UNITÉS, CALENDRIER, DATES DU BUDGET), BDS, BDG (list of budgets, then the budget screen: designations, TÂCHES, detail tabs, planning / Gantt, links, DOC / TAF / OBS, imports, exports, PDF previews). The views are switched in JavaScript, exactly as before. |
| `GET /dashboard/budget/version` | `dashboard.budget.version` | Plain-text published version, read by the « NOUVELLE VERSION — ACTUALISER » check. |

Stand-in routes (`routes/web.php`): `GET /` (login page), `POST /login`, `POST /logout`.

## Where things are

| Path | Content |
|---|---|
| `resources/views/dashboard/budget/index.blade.php` | The page (`@extends('dashboard.layout')`, page-title `Budget`). |
| `resources/views/components/budget/head.blade.php` | Stylesheet link and the published version (meta tags). |
| `resources/views/components/budget/markup.blade.php` | The HTML body of the former `index.html`, unchanged. |
| `resources/views/components/budget/script.blade.php` | Glues the script parts back into **one** `<script>`. |
| `resources/views/components/budget/js/01…21-*.blade.php` | The former `app.js`, unchanged, cut at its own section headers. |
| `public/budget/styles.css` | The former `styles.css`, unchanged. |
| `config/budget.php` | `version`: the one place to set the published version. |
| `resources/css/budget.css` + `tailwind.budget.config.js` | Tailwind for the Budget page **without the reset (preflight)**. |
| `apps-script/` | Copies of the Google Apps Script code (runs in Google, not here). |

### What changed compared with v2-test (and only this)

1. **Update button**: the version is set once in `config/budget.php`. The page publishes it
   (`meta name="budget-version"`) and the check reads `/dashboard/budget/version` instead of
   looking for `app.js?v=…` (the script is now inline). Same button, same behaviour.
2. **Red « VERSION TEST » label removed.** The `#sviTestTag` element stays, hidden, because the
   script reads it to keep the test version's behaviour (base V3 read, editable source file = V3).
3. **`svitest:` storage prefix removed**: the new address has its own browser storage.

Everything else in the served page is byte-identical to the originals (checked by diffing the
HTML returned by Laravel against `v2-test/index.html` and `v2-test/app.js`).

## Stand-in files (Novapp already has them — do not merge)

Each one starts with `STAND-IN: Novapp already has this file, do not merge`.

- `resources/views/dashboard/layout.blade.php`: minimal layout (`@yield('page-title')`,
  `@yield('content')`, Tailwind + Vite). It also honours an optional
  `@section('tailwind-css', …)` so the Budget page can load `resources/css/budget.css`
  (Tailwind without the reset). **Novapp's real layout needs the same one-line switch**,
  otherwise Tailwind's reset would change the Budget app's buttons, headings and lists.
- `app/Http/Middleware/NovappAuthenticate.php` and its alias `novapp.auth` in `bootstrap/app.php`:
  lets the request through only when `session('novapp_authenticated') === true`, otherwise
  redirects to `/`.
- `routes/web.php` and `resources/views/auth/login.blade.php`: a one-button login page at `/`
  that sets that session key.

When merging into Novapp, also keep the two `!./resources/views/…/budget/**` exclusions of
`tailwind.config.js` in Novapp's own Tailwind config. The Budget app uses its own class names
(`hidden`, `table`, `fixed`…); they must not turn into Tailwind utilities.

## How the Google Sheet connection works (unchanged)

The browser talks to Google directly; Laravel has no controller for it.

- **Apps Script web app**: `API_URL` and `API_KEY` at the top of
  `components/budget/js/01-update-check.blade.php` (first lines of the former `app.js`).
  - Reads (GET, then POST if needed): `bootstrap` (CHS / BDS), `brd`, the old BDG tab,
    `v3Read` (base V3: BUDGETS, DESIGNATIONS, TACHES, DETAILS, ARRETS), `srcGet`, `sheetRead`.
  - Writes (POST, JSON body): `saveCHS` / `deleteCHS`, `saveBDS` / `deleteBDS`,
    `saveBRD` / `deleteBRD`, `exportSheet` (formatted Google Sheet in Drive), `saveFile`
    (PDF / Excel / JSON in Drive), `drivePath`, `srcSet`.
  - Server side: `apps-script/Code.gs` and `apps-script/exportSheet.gs` (deployed in Google).
- **Public sheet links** (`docs.google.com/.../gviz/tq?tqx=out:csv`) are read directly when
  importing from a Google Sheet link.
- **Libraries loaded on demand from CDNs**: xlsx-js-style (Excel), html2canvas and jsPDF (PDF).
- **On the device only**: budgets EN INSTANCE (IndexedDB) and preferences (localStorage).
  A new web address starts with empty storage. To bring a budget over, use
  **EXPORTER LE BUDGET** on the old site, then **IMPORTER UN BUDGET** here.

## Test checklist (Google Sheet)

Reads, on the real sheet:

1. Open `/dashboard/budget`: PARAMÉTRAGE › CHS shows the charges list (action `bootstrap`).
2. ☰ › DONNÉES SOURCE shows VERSION TEST and BUDGETS (BDG) = base V3 (not « BASE V3 NON LUE »).
3. BDG: the budget list loads (`v3Read`); open one budget, its designations, tasks and details show.
4. Import a block from a Google Sheet link (`sheetRead` / gviz): the rows are read.

Writes, with one test entry only, without touching existing data:

5. PARAMÉTRAGE › CHS › + AJOUTER: create `TEST LARAVEL — À SUPPRIMER`; check the new row in the
   CHS tab of the main sheet. Then long press › SUPPRIMER on it; check the row is gone.
6. Open a budget › ⋯ › EXPORTER LE BUDGET › GOOGLE SHEETS › DANS LE DRIVE: check that the file
   appears in Drive with its tabs, then delete that file in Drive.
