import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/aidd-exhaustive/performance-smoke/**/*.perf.test.ts'],
    passWithNoTests: true,
    testTimeout: 120000,
  },
});
