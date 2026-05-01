import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", ".stryker-tmp"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      prettierConfig,
    ],
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      prettier: prettierPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Relax strictness around 'any' usage to warnings for incremental typing
      "@typescript-eslint/no-explicit-any": "warn",
      // Ignore unused variables prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Uncomment this code if you want to see all of the prettier errors inline
      // "prettier/prettier": [
      //   "error",
      //   {
      //     endOfLine: "auto",
      //   },
      // ],
    },
  },
  // Node.js config files need Node.js globals (process, module, etc.)
  {
    files: [
      "vite.config.ts",
      "playwright.config.ts",
      "*.config.js",
      "*.config.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
);
