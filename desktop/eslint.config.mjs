import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["out/**", "release/**", "node_modules/**", "test-results/**", "**/generated/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
      "scripts/**/*.mjs",
      "tests/**/*.ts",
      "*.config.*",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
);
