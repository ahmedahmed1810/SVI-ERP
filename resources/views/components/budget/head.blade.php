{{-- Budget app <head> pieces: stylesheet and the published version (config/budget.php).
     The « svitest: » storage prefix of the former test page is gone: this address has its own storage. --}}
<meta name="budget-version" content="{{ config('budget.version') }}">
<meta name="budget-version-url" content="{{ route('dashboard.budget.version') }}">
<link
    rel="stylesheet"
    href="{{ asset('budget/styles.css') }}?v={{ config('budget.version') }}"
  >
