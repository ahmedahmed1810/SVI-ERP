import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                // Budget page: same Tailwind, without the reset (preflight), see tailwind.budget.config.js
                'resources/css/budget.css',
                'resources/js/app.js',
            ],
            refresh: true,
        }),
    ],
});
