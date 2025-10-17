import path from "node:path";
import { fileURLToPath } from "node:url";

import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const typeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map(
  (config) =>
    config.files
      ? config
      : {
          ...config,
          files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
        },
);

export default tseslint.config(
  {
    ignores: ["bin/**", "dist/**"],
  },
  ...typeCheckedConfigs,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  eslintConfigPrettier,
);
