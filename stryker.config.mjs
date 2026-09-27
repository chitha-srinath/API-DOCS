/** Mutation testing (ADR-05, ADR-27d): break below a 70% mutation score. */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.stryker.config.ts' },
  mutate: [
    'src/config/**/*.ts',
    'src/introspect/**/*.ts',
    'src/spec/**/*.ts',
    'src/route/**/*.ts',
    'src/registry/**/*.ts',
    'src/adapter/**/*.ts',
    '!src/**/types.ts',
    '!src/adapter/standard-types.ts',
    '!src/config/index.ts',
  ],
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 85, low: 70, break: 70 },
  coverageAnalysis: 'perTest',
  concurrency: 4,
  timeoutMS: 20000,
};
