import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Core no-undef isn't type-aware, so it false-positives on anything
      // that only exists in TS type-space — a namespace referenced as a
      // type (NodeJS.Timeout), a global ambient type (RequestInit), a
      // locally-declared type/interface used before its declaration in
      // source order, JSX's implicit React reference, etc. TypeScript's own
      // compiler already reports a genuinely undefined identifier (TS2304)
      // far more accurately than this rule can — this is typescript-eslint's
      // own documented recommendation, not a one-off workaround.
      'no-undef': 'off',
    },
  },
];
