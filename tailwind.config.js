import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './resources/**/*.blade.php',
        './resources/**/*.js',
        // Budget: its HTML / JS use their own class names (hidden, table, fixed…) styled by
        // public/budget/styles.css; they must not generate Tailwind utilities.
        // (storage/framework/views is not scanned either: it holds the compiled Budget page.)
        '!./resources/views/dashboard/budget/**',
        '!./resources/views/components/budget/**',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },
    plugins: [],
};
