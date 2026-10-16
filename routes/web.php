<?php

// STAND-IN: Novapp already has this file, do not merge
// Minimal login: "/" shows a page whose button sets session('novapp_authenticated') = true.

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function (Request $request) {
    if ($request->session()->get('novapp_authenticated') === true) {
        return redirect()->route('dashboard.budget.index');
    }

    return view('auth.login');
})->name('login');

Route::post('/login', function (Request $request) {
    $request->session()->regenerate();
    $request->session()->put('novapp_authenticated', true);

    return redirect()->route('dashboard.budget.index');
})->name('login.store');

Route::post('/logout', function (Request $request) {
    $request->session()->forget('novapp_authenticated');
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/');
})->name('logout');
