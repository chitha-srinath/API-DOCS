import { defineConfig, type Options } from 'tsup';

/**
 * `src/index.ts` imports `./auto-record.js` for its side effect. Keep that import
 * external and point it at the sibling file of the same format, so the patch lives in
 * exactly one listed `sideEffects` file per format (ADR-24).
 */
function externalAutoRecord(
  extension: '.js' | '.cjs',
): NonNullable<Options['esbuildPlugins']>[number] {
  return {
    name: 'external-auto-record',
    setup(build) {
      build.onResolve({ filter: /^\.\/auto-record(\.js)?$/ }, (args) =>
        args.importer.endsWith('index.ts')
          ? { path: `./auto-record${extension}`, external: true }
          : undefined,
      );
    },
  };
}

const shared: Options = {
  entry: {
    index: 'src/index.ts',
    manual: 'src/manual.ts',
    zod: 'src/zod.ts',
    'auto-record': 'src/auto-record.ts',
  },
  dts: true,
  sourcemap: false,
  splitting: false,
  shims: true,
  target: 'node22',
  platform: 'node',
  external: ['express', 'zod'],
};

export default defineConfig([
  {
    ...shared,
    format: 'esm',
    clean: true,
    outExtension: () => ({ js: '.js' }),
    esbuildPlugins: [externalAutoRecord('.js')],
  },
  {
    ...shared,
    format: 'cjs',
    outExtension: () => ({ js: '.cjs' }),
    esbuildPlugins: [externalAutoRecord('.cjs')],
  },
]);
