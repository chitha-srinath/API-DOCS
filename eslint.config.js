import tseslint from 'typescript-eslint';

const symbolRule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.name='Symbol']",
      message:
        'Local Symbol() is banned for values crossing module boundaries. Use Symbol.for(...) or add an allow-list comment for purely local symbols.',
    },
  ],
};

const express4Rule = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.name='require'][arguments.0.value='express4']",
      message: "require('express4') is restricted outside test/fixtures/**.",
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'reports/**', '.stryker-tmp/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      ...symbolRule,
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'zod', message: 'zod may only be imported from src/adapter/zod.ts' }], patterns: ['zod/*'] },
      ],
    },
  },
  {
    files: ['src/adapter/zod.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'zod', message: 'config/** must not import zod' }],
          patterns: ['zod/*', '../adapter', '../adapter/*', '**/adapter/**'],
        },
      ],
    },
  },
  {
    files: ['test/**/*.ts'],
    ignores: ['test/fixtures/**'],
    rules: {
      ...express4Rule,
    },
  },
  {
    files: ['test/fixtures/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
);
