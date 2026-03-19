import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  // Base ESLint recommended rules.
  js.configs.recommended,

  // Recommended TypeScript rules.
  ...tseslint.configs.recommended,

  // SonarJS (aligns with SonarQube / SonarLint style checks in the IDE).
  sonarjs.configs.recommended,

  // Project-level ignore patterns.
  {
    ignores: ["dist", "node_modules", ".vite", "coverage"],
  },

  // React/JSX + browser globals + a couple runtime-safety rules.
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Hooks rules (helps catch subtle runtime bugs).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Refresh constraints.
      // This project shares small helpers/constants in component files, and
      // the fast-refresh constraint is not critical for production builds.
      "react-refresh/only-export-components": "off",
    },
  },

  // Large injected content script: Sonar complexity / duplicate-string noise is expected.
  {
    files: ["src/content.ts"],
    rules: {
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/max-lines-per-function": "off",
      "sonarjs/no-nested-functions": "off",
    },
  },

  // shadcn/ui primitives: keep Sonar light-touch (duplicated class strings, etc.).
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "sonarjs/no-duplicate-string": "off",
    },
  },
];
