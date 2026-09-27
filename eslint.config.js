import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'reports/**',
      '.stryker-tmp/**',
      'node_modules/**',
      '.aidd/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/adapter/zod.ts'],
    rules: {
      // ADR-21: the core never imports zod; only the ./zod subpath adapter may.
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'zod', message: 'Only src/adapter/zod.ts may import zod (ADR-21).' }] },
      ],
      // ADR-20: identities that cross module copies must use Symbol.for.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='Symbol']",
          message: 'Use Symbol.for("express-api-docs.*") for cross-copy identities (ADR-20).',
        },
      ],
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: {
      // ADR-04: config never depends on a schema library or the adapter layer.
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'zod', message: 'config/** must not import zod (ADR-04).' }],
          patterns: [
            { group: ['**/adapter/**'], message: 'config/** must not import adapter/** (ADR-04).' },
          ],
        },
      ],
    },
  },
  {
    files: ['test/**/*.ts', 'examples/**/*.{js,mjs,cjs,ts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
