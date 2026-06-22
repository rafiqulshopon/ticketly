// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import requireAuthDecision from './eslint-rules/require-auth-decision.mjs';

export default tseslint.config(
  { ignores: ['dist/**', 'src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
        // Monorepo: each workspace has its own tsconfig. Without this, the IDE
        // ESLint run accumulates api/ + web/ as candidate root dirs and errors.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // NestJS DI + decorators; this project permits `any` (tsconfig noImplicitAny: false)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Authorization merge-gate: every route handler must declare an access
    // decision. See eslint-rules/require-auth-decision.mjs. Prevents an
    // admin-only endpoint from shipping as merely "authenticated".
    files: ['src/**/*.ts'],
    plugins: {
      ticketly: { rules: { 'require-auth-decision': requireAuthDecision } },
    },
    rules: {
      'ticketly/require-auth-decision': 'error',
    },
  },
);
