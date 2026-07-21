// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config (ESLint v9) for the `@friends-ai/web` SPA workspace.
 *
 * `@eslint/js` recommended + `typescript-eslint` recommended. Browser globals
 * for app source (DOM APIs like `document`/`window`), Vitest globals for spec
 * files (this project runs Vitest with `test.globals: true`, so `it`/`expect`/
 * etc. are ambient at runtime and must be declared here too).
 */
export default tseslint.config(
  {
    // Never linted: build output, deps, coverage, TS build info, and this
    // config file itself.
    ignores: ['dist', 'node_modules', 'coverage', 'tsconfig.tsbuildinfo', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Allow `const { omitted, ...rest } = obj` to intentionally drop keys,
      // and `_`-prefixed args/vars as deliberate throwaways.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Vitest spec files and test setup run with ambient test globals
    // (`test.globals: true` in vitest.config.ts).
    files: ['**/*.spec.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
);
