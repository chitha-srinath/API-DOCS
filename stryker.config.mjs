/**
 * Mutation testing (ADR-05, ADR-27d): break below a 70% mutation score.
 *
 * Uses the command runner: @stryker-mutator/vitest-runner 10.0.0 does not activate
 * mutants under vitest 5 (every mutant reports "survived", even an emptied function),
 * while the command runner's `__STRYKER_ACTIVE_MUTANT__` activation works.
 */
export default {
  testRunner: 'command',
  commandRunner: { command: 'npx vitest run --config vitest.stryker.config.ts --bail=1' },
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
  reporters: ['clear-text', 'progress-append-only', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 85, low: 70, break: 70 },
  coverageAnalysis: 'off',
  concurrency: 4,
  timeoutMS: 60000,
};
