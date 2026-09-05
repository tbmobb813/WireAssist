const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.d.ts', '*.js'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
        // Without this, './tsconfig.json' resolves against whatever the
        // eslint process's CWD happens to be, not this config file's own
        // directory — harmless when eslint always runs from inside this
        // package (pnpm --filter @wireassist/core lint, the only way this
        // repo actually invokes it), but breaks with a confusing "cannot
        // read tsconfig.json" parse error the moment anything lints this
        // package from a different CWD (a multi-package glob run from the
        // repo root, a future CI step, an IDE plugin). Confirmed 2026-09-05
        // — a one-off root-level diagnostic run hit exactly this.
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2015,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      // New in ESLint 10's recommended set; not previously enforced here.
      // Adopting it means auditing every rethrow site for `{ cause }` —
      // tracked separately rather than folded into this config migration.
      'preserve-caught-error': 'off',
      // Base rule doesn't understand TS declaration merging (interfaces,
      // namespaces); defer to the type-aware variant instead.
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },
];
