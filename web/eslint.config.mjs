// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    // Register the React plugins as objects (ESLint 10 rejects the legacy
    // `plugins: ["react-hooks"]` array form that the plugin's own preset still uses).
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { warnOnUnsupportedTypeScriptVersion: false },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // shadcn/ui primitives intentionally co-export variant helpers (e.g. `buttonVariants`)
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);
