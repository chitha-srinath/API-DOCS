import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/perf/**', 'node_modules/**'],
    globalSetup: ['test/dist/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    typecheck: {
      include: ['test/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/types.ts', 'src/adapter/standard-types.ts', 'src/config/index.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
