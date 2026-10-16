{{-- STAND-IN: Novapp already has this file, do not merge --}}
<!DOCTYPE html>
<html lang="fr">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <title>@yield('page-title') — Novapp</title>
  {{-- A page may ask for another Tailwind entry (the budget page uses one without the Tailwind reset) --}}
  @php($tailwindCss = trim($__env->yieldContent('tailwind-css')) ?: 'resources/css/app.css')
  @vite([$tailwindCss, 'resources/js/app.js'])
</head>

<body>
  @yield('content')
</body>

</html>
