// ST-007 (S-07): ADR-24 — bundling a fixture that imports dist/index.js with
// esbuild keeps the Express 5 `/api/users/{id}` prefix intact.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();

describe('entries/bundle', () => {
  it('a bundled fixture keeps the Express 5 prefix', () => {
    // Nested under the repo root (not the OS tmpdir) so Node's module
    // resolution walks up to the project's own node_modules and finds the
    // `--external:express` dependency at run time.
    const scratch = join(root, '.tmp-bundle-test');
    mkdirSync(scratch, { recursive: true });
    const tmp = mkdtempSync(join(scratch, 'run-'));
    const indexPath = join(root, 'dist/index.js').replace(/\\/g, '/');
    const fixturePath = join(tmp, 'fixture.mjs');
    writeFileSync(
      fixturePath,
      `
      import { createApiDocs } from '${indexPath}';
      import express from 'express';

      const app = express();
      const router = express.Router();
      const apiDocs = createApiDocs();
      app.use(apiDocs.router);
      const [validate, handler] = apiDocs.route('get', '/users/:id', {}, (req, res) => res.json({ ok: true }));
      router.get('/users/:id', validate, handler);
      app.use('/api', router);

      const spec = apiDocs.getSpec({ app });
      const paths = Object.keys(spec.paths);
      if (!paths.includes('/api/users/{id}')) {
        throw new Error('missing /api/users/{id}: ' + JSON.stringify(paths));
      }
      console.log('OK');
      `,
    );
    const bundlePath = join(tmp, 'bundle.mjs');
    execFileSync(
      process.execPath,
      [
        require.resolve('esbuild/bin/esbuild'),
        fixturePath,
        '--bundle',
        '--platform=node',
        '--format=esm',
        '--external:express',
        `--outfile=${bundlePath}`,
      ],
      { cwd: root, stdio: 'pipe' },
    );
    const out = execFileSync(process.execPath, [bundlePath], { cwd: root, stdio: 'pipe' }).toString();
    expect(out).toContain('OK');
    rmSync(scratch, { recursive: true, force: true });
  });
});
