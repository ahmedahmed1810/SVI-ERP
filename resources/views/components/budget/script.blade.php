{{-- Budget app script: the former v2-test/app.js, unchanged, cut into parts at its own section
     headers (components/budget/js/NN-*.blade.php). The parts are glued back into ONE <script>
     element in this order, so the code runs exactly as the single file did.
     Each part ends with its end-verbatim directive and NO newline after it: that keeps the glued
     script byte-identical to the original file. --}}
<script>
@include('components.budget.js.01-update-check')
@include('components.budget.js.02-loading-overlay')
@include('components.budget.js.03-movable-tabs')
@include('components.budget.js.04-data-tools-local-budgets')
@include('components.budget.js.05-api')
@include('components.budget.js.06-google-drive')
@include('components.budget.js.07-chs-bds-sync')
@include('components.budget.js.08-navigation-chs-bds')
@include('components.budget.js.09-bdg-loading')
@include('components.budget.js.10-bdg-list-and-budget-screen')
@include('components.budget.js.11-bdg-columns-sort-filter')
@include('components.budget.js.12-bdg-instance-input-and-links')
@include('components.budget.js.13-bdg-delays-planning-gantt')
@include('components.budget.js.14-bdg-import')
@include('components.budget.js.15-bdg-pdf-previews')
@include('components.budget.js.16-bdg-copy-paste')
@include('components.budget.js.17-bdg-selectors-products-charges-analysis')
@include('components.budget.js.18-chs-bds-forms-long-press')
@include('components.budget.js.19-startup')
@include('components.budget.js.20-dialogs-and-source-files')
@include('components.budget.js.21-parametrage-calendar-keyboard')
</script>
