# CLAUDE.md — Budget module (SVI ERP) in Laravel

This repository branch (`laravel`) holds the Budget app converted from the static site
(`v2-test`) into Laravel, with the same language, logic and architecture as the main app
"Novapp". Read `README_BUDGET.md` for how to run it and how it talks to Google.

## Stack (same as Novapp)

- PHP 8.2, Laravel 11.
- Blade views + Tailwind CSS 3 + Vite 5 + Alpine.js 3, plain JavaScript.
- Never add React, Vue, Inertia, Livewire, Jetstream, Breeze, Filament or any other UI/auth package.

## Structure (everything named "budget")

| What | Where |
|---|---|
| Pages | `resources/views/dashboard/budget/` |
| Page scripts and reusable Blade pieces | `resources/views/components/budget/` |
| Controllers, only if needed | `app/Http/Controllers/Api/Budget/` (namespace `App\Http\Controllers\Api\Budget`) |
| Static files and images | `public/budget/` |
| Routes | `routes/budget.php` only, loaded from `bootstrap/app.php` |
| Published version | `config/budget.php` (`version`) |

- Page URLs: `/dashboard/budget/...`, inside `Route::middleware('novapp.auth')->group(...)`,
  route names `dashboard.budget.*`.
- Every page starts with:
  ```blade
  @extends('dashboard.layout')
  @section('page-title', 'Budget')
  @section('content') ... @endsection
  ```
- Budget pages also set `@section('tailwind-css', 'resources/css/budget.css')`: Tailwind
  without its reset (preflight), so the app keeps the browser defaults it was built on.

## The Budget app code

- `components/budget/markup.blade.php`: the app's HTML. `components/budget/js/NN-*.blade.php`:
  the app's JavaScript, cut at its own section headers and glued back into ONE `<script>` by
  `components/budget/script.blade.php` (order = file number). `public/budget/styles.css`: its CSS.
- Code inside these parts is wrapped in `@verbatim` (the JS contains `@` and `{{`).
  Keep the two conventions that make the served script identical to the source:
  - a part starts with `@verbatim` immediately followed by its first character (Blade drops
    whitespace right after `@verbatim`; leading indentation belongs to the end of the previous part);
  - a part ends with its end-verbatim directive and **no newline** after it.
- Never put `@endverbatim` or `<?` inside the code, and never `</script>` unescaped (`<\/script>`).
- The app is a single page; its views (PARAMÉTRAGE, BDS, BDG, budget screen) are switched
  in JavaScript. Do not split it into several Laravel pages.
- Texts on screen stay in French, in CAPITALS, as they are.

## Google Sheet

- The browser talks to Google directly (Apps Script web app `API_URL` / `API_KEY`, gviz CSV
  links, Drive through the same script). Do not rewrite or change the sync logic, the sheet,
  its tabs or its columns. The Google side is in `apps-script/` (deployed in Google, not here).
- Budgets EN INSTANCE live only on the device (IndexedDB); that is the current behaviour.

## Releasing a change

- Raise `version` in `config/budget.php` at each release. Open pages then show
  « NOUVELLE VERSION — ACTUALISER », and `public/budget/styles.css` is re-downloaded.

## Stand-ins (do not merge into Novapp)

Files starting with `STAND-IN: Novapp already has this file, do not merge`:
`resources/views/dashboard/layout.blade.php`, `app/Http/Middleware/NovappAuthenticate.php`
(alias `novapp.auth` in `bootstrap/app.php`), `routes/web.php`, `resources/views/auth/login.blade.php`.
They only let this project run on its own. Novapp's real layout must honour the
`tailwind-css` section, and Novapp's Tailwind config must keep the two
`!./resources/views/…/budget/**` content exclusions.

## Rules

- Same behaviour, same results. If something is unclear, ask instead of guessing or "fixing" it.
- Never commit `.env`, `vendor/` or `node_modules/`.
- Small commits with clear messages, in this repository.
- The static site (GitHub Pages: `main` → v2, `ui-bdg-list-2026-10-07` → v2-test) is not
  touched from this branch.
