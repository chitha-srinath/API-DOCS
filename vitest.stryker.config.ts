import { defineConfig } from 'vitest/config';

/** Stryker runs the source-level suites only; dist/pack/example tests do not exercise src. */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: [
      'test/perf/**',
      'test/dist/**',
      'test/entries/**',
      'test/examples/**',
      'test/meta/**',
      'node_modules/**',
    ],
    testTimeout: 30_000,
  },
});
