{{-- STAND-IN: Novapp already has this file, do not merge --}}
<!DOCTYPE html>
<html lang="fr">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connexion — Novapp</title>
  @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
  <form method="POST" action="{{ route('login.store') }}" class="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
    @csrf
    <h1 class="text-lg font-bold text-slate-800">Novapp</h1>
    <p class="text-sm text-slate-500">Page de connexion de remplacement (stand-in) pour faire tourner le module Budget seul.</p>
    <button type="submit" class="w-full rounded-lg bg-slate-900 text-white font-bold py-3">SE CONNECTER</button>
  </form>
</body>

</html>
