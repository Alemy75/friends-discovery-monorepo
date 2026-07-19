// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config (ESLint v9) for the NestJS API workspace.
 *
 * `@eslint/js` recommended + `typescript-eslint` recommended, with the
 * relaxations NestJS's own preset applies (decorator-heavy DI + Prisma make
 * some rules more noise than signal). No Prettier — this repo doesn't use it.
 */
export default tseslint.config(
  {
    // Never linted: build output, deps, coverage, generated SQL migrations,
    // and this config file itself.
    ignores: ['dist', 'node_modules', 'coverage', 'prisma/migrations', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
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
);
