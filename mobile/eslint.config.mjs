// @ts-check
// Flat config (ESLint 10), mirroring web/eslint.config.mjs so the repo lints
// consistently. RN doesn't use the react-refresh plugin (that's Vite/HMR); we
// keep react-hooks + typescript-eslint. tsconfigRootDir prevents the monorepo
// double-root IDE error (api/web do the same).
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".expo/**", "dist/**", "expo-env.d.ts", "nativewind-env.d.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
