import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/dist/global-setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Bound worker concurrency below the host's logical CPU count so CPU-bound
    // subprocess-spawning tests (esbuild bundling, ESLint lintText) aren't starved
    // when vitest's default per-file worker isolation queues dozens of workers at
    // once — this was the root cause of two non-deterministic hookTimeout/testTimeout
    // flakes (test/entries/minified.test.ts, test/meta/lint-rules.test.ts) under
    // default parallelism. See .aidd/changes/*/qa/determinism-report.md,
    // build-log.md "QA fix loop — worker concurrency" entry.
    maxWorkers: 4,
    include: ['test/**/*.test.ts'],
    exclude: ['test/perf/**', 'test/aidd-exhaustive/performance-smoke/**', 'node_modules/**', 'dist/**'],
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
      exclude: ['**/*.v4.test-d.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
