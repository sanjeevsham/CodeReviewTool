import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // ====================
  // Base rules (JS + TS)
  // ====================
  {
    files: ["**/*.{js,ts,jsx,tsx,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      // Code quality
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "consistent-return": "error",
      "no-debugger": "error",
      "no-console": "warn",
      // Maintainability
      "complexity": ["warn", { max: 10 }],
      "max-depth": ["warn", { max: 4 }]
    }
  },

  // ====================
  // CommonJS override
  // ====================
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs"
    }
  },

  // ====================
  // TypeScript 
  // ====================
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      ...tseslint.configs.recommendedTypeChecked.rules,
      ...tseslint.configs.recommended.rules,
      // Stronger TS guarantees
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/strict-boolean-expressions": "warn"
    }
  }
];
