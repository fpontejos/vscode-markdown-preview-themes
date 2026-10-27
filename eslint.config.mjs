// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'docs/', 'vendor/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      curly: ['warn', 'multi-line'],
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
    },
  },
  {
    // Node build scripts, tests, and the editor webview script are plain JavaScript.
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
  {
    files: ['media/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { window: 'readonly', document: 'readonly', acquireVsCodeApi: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', console: 'readonly', navigator: 'readonly', MessageEvent: 'readonly', URLSearchParams: 'readonly', location: 'readonly' },
    },
  },
);
