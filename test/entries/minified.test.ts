// ST-007 (S-07): ADR-49 — two separately minified bundles (mangled class
// names) still cross-recognise ApiDocsConfigError/ApiDocsSchemaError via the
// stable BRAND/BRAND_KEY string codes, never `this.name` (ADR-42 superseded).
// Bundle A is built from the ESM output (kept as an ESM bundle, loaded via
// dynamic `import()`); bundle B is built from the CJS output (kept as CJS,
// loaded via `require()`) so neither bundle needs an `import.meta.url` shim.
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildSync } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();

let bundleAPath: string;
let bundleBPath: string;
let tmp: string;
let scratchDir: string;

interface Bundle {
  ApiDocsConfigError: new (path: string, expected: string) => Error;
  ApiDocsSchemaError: new (vendor: string) => Error;
}

let bundleA: Bundle;
let bundleB: Bundle;

beforeAll(async () => {
  // Nested under the repo root (not the OS tmpdir) so Node's module
  // resolution walks up to the project's own node_modules and finds the
  // `--external:express` dependency at run time.
  scratchDir = join(root, '.tmp-minified-test');
  mkdirSync(scratchDir, { recursive: true });
  tmp = mkdtempSync(join(scratchDir, 'run-'));
  bundleAPath = join(tmp, 'a.mjs');
  bundleBPath = join(tmp, 'b.cjs');
  // JS API, not the bin/esbuild CLI: on Linux that file is a native binary that
  // `node` cannot execute, so the CLI path only worked on Windows.
  buildSync({
    entryPoints: [join(root, 'dist/index.js')],
    bundle: true,
    minify: true,
    keepNames: false,
    platform: 'node',
    format: 'esm',
    external: ['express'],
    outfile: bundleAPath,
    logLevel: 'silent',
  });
  buildSync({
    entryPoints: [join(root, 'dist/index.cjs')],
    bundle: true,
    minify: true,
    keepNames: false,
    platform: 'node',
    format: 'cjs',
    external: ['express'],
    outfile: bundleBPath,
    logLevel: 'silent',
  });
  bundleA = (await import(bundleAPath)) as unknown as Bundle;
  bundleB = require(bundleBPath) as Bundle;
});

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

describe('entries/minified', () => {
  it('minified class names are mangled', () => {
    const nameDiffers =
      bundleA.ApiDocsConfigError.name !== 'ApiDocsConfigError' ||
      bundleA.ApiDocsSchemaError.name !== 'ApiDocsSchemaError';
    expect(nameDiffers).toBe(true);
  });

  it('config error A<->B', () => {
    const errA = new bundleA.ApiDocsConfigError('x', 'y');
    const errB = new bundleB.ApiDocsConfigError('x', 'y');
    expect(errA).toBeInstanceOf(bundleB.ApiDocsConfigError);
    expect(errB).toBeInstanceOf(bundleA.ApiDocsConfigError);
  });

  it('schema error A<->B', () => {
    const errA = new bundleA.ApiDocsSchemaError('vendor');
    const errB = new bundleB.ApiDocsSchemaError('vendor');
    expect(errA).toBeInstanceOf(bundleB.ApiDocsSchemaError);
    expect(errB).toBeInstanceOf(bundleA.ApiDocsSchemaError);
  });

  it('subclass passes across bundles', () => {
    class MyErrA extends bundleA.ApiDocsSchemaError {}
    expect(new MyErrA('vendor')).toBeInstanceOf(bundleB.ApiDocsSchemaError);

    class MyErrB extends bundleB.ApiDocsSchemaError {}
    expect(new MyErrB('vendor')).toBeInstanceOf(bundleA.ApiDocsSchemaError);
  });

  it('cross-class is false', () => {
    const configErrA = new bundleA.ApiDocsConfigError('x', 'y');
    const schemaErrA = new bundleA.ApiDocsSchemaError('vendor');
    expect(configErrA).not.toBeInstanceOf(bundleB.ApiDocsSchemaError);
    expect(schemaErrA).not.toBeInstanceOf(bundleB.ApiDocsConfigError);
  });
});
