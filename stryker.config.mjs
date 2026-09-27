/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'command',
  commandRunner: { command: 'npx vitest run --config vitest.stryker.config.ts' },
  coverageAnalysis: 'off',
  concurrency: 4,
  timeoutMS: 60000,
  mutate: ['src/config/**', 'src/introspect/**', 'src/spec/**', 'src/route/**', 'src/registry/**', 'src/adapter/**'],
  thresholds: { break: 70 },
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
};
