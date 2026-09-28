// ST-007 (S-07): ADR-40 runtime half — in a child process, loading the main
// entry (CJS `require`, ESM `import`) installs RECORDER on the root Express
// prototype with zero EAD_* warns. This is the ADR-55 red-first test: it goes
// red while `package.json`'s `sideEffects` array omits
// `src/introspect/auto-record.ts`'s built output paths, because esbuild's
// tree-shaking then strips the auto-record side-effect import from the
// bundled entries.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();

const INSTALLED_HELPER = `
      function installed(instance) {
        let proto = instance;
        while (proto) {
          if (Object.prototype.hasOwnProperty.call(proto, RECORDER)) return true;
          proto = Object.getPrototypeOf(proto);
        }
        return false;
      }
`;

describe('entries/recorder-install', () => {
  it('require(dist/index.cjs) installs RECORDER with zero EAD_* warns', () => {
    const indexPath = join(root, 'dist/index.cjs').replace(/\\/g, '/');
    const script = `
      const RECORDER = Symbol.for('express-api-docs.v1.recorder');
      ${INSTALLED_HELPER}
      const originalWarn = console.warn;
      let warned = false;
      console.warn = (...args) => { warned = true; originalWarn(...args); };
      require('${indexPath}');
      const express = require('express');
      const routerInstalled = installed(express.Router());
      const appInstalled = installed(express.application);
      if (!routerInstalled || !appInstalled) throw new Error('RECORDER not installed on require');
      if (warned) throw new Error('unexpected EAD_* warn on require');
    `;
    expect(() => execFileSync(process.execPath, ['-e', script], { cwd: root, stdio: 'pipe' })).not.toThrow();
  });

  it('import(dist/index.js) installs RECORDER with zero EAD_* warns', () => {
    const indexPath = join(root, 'dist/index.js').replace(/\\/g, '/');
    const script = `
      const RECORDER = Symbol.for('express-api-docs.v1.recorder');
      ${INSTALLED_HELPER}
      const originalWarn = console.warn;
      let warned = false;
      console.warn = (...args) => { warned = true; originalWarn(...args); };
      await import('file://${indexPath}');
      const express = (await import('express')).default;
      const routerInstalled = installed(express.Router());
      const appInstalled = installed(express.application);
      if (!routerInstalled || !appInstalled) throw new Error('RECORDER not installed on import');
      if (warned) throw new Error('unexpected EAD_* warn on import');
      process.exit(0);
    `;
    expect(() =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, stdio: 'pipe' }),
    ).not.toThrow();
  });
});
