import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: [
      'test/dist/**',
      'test/entries/**',
      'test/perf/**',
      'test/aidd-exhaustive/performance-smoke/**',
      'bench/**',
      '**/*.test-d.ts',
    ],
    typecheck: { enabled: false },
    coverage: { enabled: false },
    pool: 'threads',
    testTimeout: 20000,
  },
});
