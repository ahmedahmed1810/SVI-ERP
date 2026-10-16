<?php

// STAND-IN: Novapp already has this file, do not merge

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Minimal stand-in for Novapp's "novapp.auth" middleware:
 * lets the request through only when session('novapp_authenticated') === true,
 * otherwise sends the visitor back to the login page at "/".
 */
class NovappAuthenticate
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->session()->get('novapp_authenticated') === true) {
            return $next($request);
        }

        return redirect('/');
    }
}
