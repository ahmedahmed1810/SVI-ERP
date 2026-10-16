import base from './tailwind.config.js';

/**
 * Tailwind for the Budget page only: identical to tailwind.config.js but without
 * the reset (preflight), so the Budget app keeps the browser defaults it was built on.
 * @type {import('tailwindcss').Config}
 */
export default {
    ...base,
    corePlugins: {
        ...(base.corePlugins || {}),
        preflight: false,
    },
};
