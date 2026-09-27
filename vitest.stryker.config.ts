import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/dist/**', 'test/entries/**', 'test/perf/**', 'bench/**', '**/*.test-d.ts'],
    typecheck: { enabled: false },
    coverage: { enabled: false },
    pool: 'threads',
  },
});
