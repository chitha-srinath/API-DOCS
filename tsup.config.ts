import { defineConfig } from 'tsup';
import type { Plugin } from 'esbuild';

function keepAutoRecordExternal(): Plugin {
  return {
    name: 'keep-auto-record-external',
    setup(build) {
      build.onResolve({ filter: /^\.\/auto-record$/ }, (args) => {
        const ext = build.initialOptions.format === 'cjs' ? '.cjs' : '.js';
        return { path: `./auto-record${ext}`, external: true };
      });
    },
  };
}

export default defineConfig({
  entry: { index: 'src/index.ts', manual: 'src/manual.ts', zod: 'src/zod.ts', 'auto-record': 'src/auto-record.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  shims: true,
  treeshake: false,
  clean: true,
  esbuildPlugins: [keepAutoRecordExternal()],
});
