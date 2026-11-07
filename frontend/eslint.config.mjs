import withNuxt from "./.nuxt/eslint.config.mjs";

import tailwind from "eslint-plugin-tailwindcss";
import prettier from "eslint-plugin-prettier";

import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";

const gitignorePath = fileURLToPath(new URL("../.gitignore", import.meta.url));

export default withNuxt([
  includeIgnoreFile(gitignorePath, "Imported ../.gitignore patterns"),
  tailwind.configs.recommended,
  {
    settings: {
      tailwindcss: {
        // v4 reads the theme from the CSS entry instead of a JS config
        cssConfigPath: "./assets/css/main.css",
      },
    },
    plugins: {
      prettier,
      tailwindcss: tailwind,
    },
    rules: {
      "vue/no-undef-components": [
        "error",
        {
          // ignore anything that start with a lowercase letter or #composables
          ignorePatterns: [
            "^i18n",
            "ClientOnly",
            "Html",
            "Link",
            "Meta",
            "NuxtLayout",
            "NuxtPage",
            "NuxtLink",
            "Title",
          ],
        },
      ],
      "no-console": 0,
      "no-unused-vars": "off",
      "vue/multi-word-component-names": "off",
      "vue/no-setup-props-destructure": 0,
      "vue/no-multiple-template-root": 0,
      "vue/no-v-model-argument": 0,
      "vue/no-v-html": 0,
      "vue/html-self-closing": 0,

      "tailwindcss/no-custom-classname": [
        "warn",
        {
          // Plain CSS classes defined in assets/css/main.css. `inputs` is the
          // plugin misreading the `...inputs` rest parameter of cn().
          whitelist: ["homebox", "markdown", "scroll-bg", "text-no-transform", "inputs"],
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true,
          destructuredArrayIgnorePattern: "_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/unified-signatures": "off",

      "prettier/prettier": [
        "warn",
        {
          arrowParens: "avoid",
          semi: true,
          tabWidth: 2,
          useTabs: false,
          vueIndentScriptAndStyle: true,
          singleQuote: false,
          trailingComma: "es5",
          printWidth: 120,
        },
      ],
    },
  },
]);
