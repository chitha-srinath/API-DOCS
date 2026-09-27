import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/dist/global-setup.ts'],
    testTimeout: 20000,
    include: ['test/**/*.test.ts'],
    exclude: ['test/perf/**', 'node_modules/**', 'dist/**'],
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
