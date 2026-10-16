<?php

namespace Tests\Feature;

use Tests\TestCase;

class BudgetPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_guest_is_sent_to_login(): void
    {
        $this->get('/dashboard/budget')->assertRedirect('/');
        $this->get('/dashboard/budget/version')->assertRedirect('/');
    }

    public function test_login_page_sets_the_session_and_opens_the_budget(): void
    {
        $this->get('/')->assertOk()->assertSee('SE CONNECTER');

        $this->post('/login')
            ->assertRedirect(route('dashboard.budget.index'))
            ->assertSessionHas('novapp_authenticated', true);
    }

    public function test_budget_page_and_version(): void
    {
        $this->withSession(['novapp_authenticated' => true]);

        $this->get(route('dashboard.budget.index'))
            ->assertOk()
            ->assertSee('<meta name="budget-version" content="'.config('budget.version').'">', false)
            ->assertSee('budget/styles.css?v='.config('budget.version'), false)
            ->assertSee('const API_URL = "https://script.google.com/macros/s/', false)
            ->assertSee('BUDGETS VALIDÉS', false);

        $this->get(route('dashboard.budget.version'))
            ->assertOk()
            ->assertSeeText((string) config('budget.version'));
    }
}
