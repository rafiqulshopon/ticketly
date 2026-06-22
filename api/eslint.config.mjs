// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

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
);
