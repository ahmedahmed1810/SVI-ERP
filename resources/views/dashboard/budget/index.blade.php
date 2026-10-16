@extends('dashboard.layout')
@section('page-title', 'Budget')
{{-- Budget page: Tailwind without its reset (preflight) --}}
@section('tailwind-css', 'resources/css/budget.css')
@section('content')
  <x-budget.head />
  <x-budget.markup />
  <x-budget.script />
@endsection
