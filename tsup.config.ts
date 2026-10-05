import { defineConfig } from 'tsup';
import type { Plugin } from 'esbuild';

// Entries that other entries reference by relative path. They stay separate files so
// consumers only load them when used (the auto-record side effect; the docs UI bundle).
const SPLIT_ENTRIES = ['auto-record', 'docs-ui.generated'];

function keepSplitEntriesExternal(): Plugin {
  return {
    name: 'keep-split-entries-external',
    setup(build) {
      for (const name of SPLIT_ENTRIES) {
        const escaped = name.replace(/[.]/g, '\\.');
        build.onResolve({ filter: new RegExp(`^\\./${escaped}$`) }, () => {
          const ext = build.initialOptions.format === 'cjs' ? '.cjs' : '.js';
          return { path: `./${name}${ext}`, external: true };
        });
        build.onResolve({ filter: new RegExp(`^\\./${escaped}\\.js$`) }, () => {
          const ext = build.initialOptions.format === 'cjs' ? '.cjs' : '.js';
          return { path: `./${name}${ext}`, external: true };
        });
      }
    },
  };
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    manual: 'src/manual.ts',
    zod: 'src/zod.ts',
    'auto-record': 'src/auto-record.ts',
    'docs-ui.generated': 'src/serve/docs-ui.generated.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  shims: true,
  treeshake: false,
  clean: true,
  esbuildPlugins: [keepSplitEntriesExternal()],
});
