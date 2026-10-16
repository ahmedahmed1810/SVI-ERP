<?php

/*
| Budget module routes (loaded from bootstrap/app.php, inside the "web" group).
| Pages live under /dashboard/budget/..., route names dashboard.budget.*
*/

use Illuminate\Support\Facades\Route;

Route::middleware('novapp.auth')->group(function () {
    Route::prefix('dashboard/budget')->name('dashboard.budget.')->group(function () {
        // the whole Budget app (single page: PARAMÉTRAGE, BDS, BDG and the budget screen)
        Route::view('/', 'dashboard.budget.index')->name('index');

        // published version number, read by the « NOUVELLE VERSION — ACTUALISER » check
        Route::get('/version', fn () => response((string) config('budget.version'), 200, [
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]))->name('version');
    });
});
