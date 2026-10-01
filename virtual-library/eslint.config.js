// Linting (npm run lint): ESLint's recommended rules, plus a few for modern JavaScript.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    // the server, the tests and the tools run in Node
    files: ['src/**/*.js', 'test/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // the page runs in the browser (shared/ is used by the server too, but needs no globals)
    files: ['public/js/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],                  // === everywhere, but `x == null` (null or undefined) is fine
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
];
