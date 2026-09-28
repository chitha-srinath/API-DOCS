// ST-007 (S-07): AC-004 — main entry loads (ESM and CJS) with zod resolution
// blocked, in a child process.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();

function run(script: string): void {
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: '' },
    stdio: 'pipe',
  });
}

describe('entries/no-zod-load', () => {
  it('loads the main entry via ESM without resolving zod', () => {
    const indexPath = join(root, 'dist/index.js').replace(/\\/g, '/');
    const script = `
      import Module from 'node:module';
      const originalResolve = Module._resolveFilename;
      Module._resolveFilename = function (request, ...rest) {
        if (request === 'zod') throw new Error('zod resolution blocked');
        return originalResolve.call(this, request, ...rest);
      };
      await import('file://${indexPath}');
      process.exit(0);
    `;
    expect(() => run(script)).not.toThrow();
  });

  it('loads the main entry via CJS without resolving zod', () => {
    const indexPath = join(root, 'dist/index.cjs').replace(/\\/g, '/');
    const script = `
      const Module = require('node:module');
      const originalResolve = Module._resolveFilename;
      Module._resolveFilename = function (request, ...rest) {
        if (request === 'zod') throw new Error('zod resolution blocked');
        return originalResolve.call(this, request, ...rest);
      };
      require('${indexPath}');
    `;
    execFileSync(process.execPath, ['-e', script], { cwd: root, stdio: 'pipe' });
  });
});
