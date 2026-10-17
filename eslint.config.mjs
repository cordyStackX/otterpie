import js from "@eslint/js";
import globals from "globals";
import noSecrets from "eslint-plugin-no-secrets";
import reactPlugin from "eslint-plugin-react";
import nextPlugin from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
// import { FlatCompat } from "@eslint/eslintrc";

// Helper to translate some old-style configs
// const compat = new FlatCompat();

export default [
  js.configs.recommended, // ✅ base JS rules

  // Declaration files can reference generated type artifacts that may not exist yet.
  {
    files: ["**/*.d.ts"],
    rules: {
      "import/no-unresolved": "off",
      "import/named": "off",
    },
  },

  // TypeScript support
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: "./tsconfig.eslint.json",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        process: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      import: importPlugin,
      "@next/next": nextPlugin,
      "no-secrets": noSecrets,
    },
    rules: {
      ...(tsPlugin.configs.recommended.rules ?? {}),
      ...(reactPlugin.configs.recommended.rules ?? {}),
      ...(nextPlugin.configs["core-web-vitals"]?.rules ?? nextPlugin.configs.recommended?.rules ?? {}),
      semi: ["error", "always"],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unknown-property": ["error", { ignore: ["intensity", "position", "args", "attach"] }],
      "no-secrets/no-secrets": ["error", { tolerance: 4.2 }],
      "import/no-unresolved": "error",
      "import/named": "error",
       "@typescript-eslint/triple-slash-reference": "off",
       "no-undef": "off",
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
        alias: {
          map: [["@", "./src"]],
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
      },
    },
  },

  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        process: "readonly",
      },
    },
    plugins: {
      react: reactPlugin,
      import: importPlugin,
      "@next/next": nextPlugin,
      "no-secrets": noSecrets,
    },
    rules: {
      ...(reactPlugin.configs.recommended.rules ?? {}),
      ...(nextPlugin.configs["core-web-vitals"]?.rules ?? nextPlugin.configs.recommended?.rules ?? {}),
      semi: ["error", "always"],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unknown-property": ["error", { ignore: ["intensity", "position", "args", "attach"] }],
      "no-secrets/no-secrets": ["error", { tolerance: 4.2 }],
      "import/no-unresolved": "error",
      "import/named": "error",
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
        alias: {
          map: [["@", "./src"]],
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
      },
    },
  },

  // Keep declaration file linting focused on types, not runtime module resolution.
  {
    files: ["**/*.d.ts"],
    rules: {
      "import/no-unresolved": "off",
      "import/named": "off",
    },
  },

  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/.venv/**",
      "**/python/**",
      "**/mobile/**",
    ],
  },
];