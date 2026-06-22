// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
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
  },
);
