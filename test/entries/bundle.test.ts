import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, describe, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ead-bundle-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('bundled consumer (ADR-24 sideEffects)', () => {
  it('keeps the recorder so Express 5 prefixes survive bundling', async () => {
    const entry = join(dir, 'entry.mjs');
    writeFileSync(
      entry,
      `import { createApiDocs } from ${JSON.stringify(join(repo, 'dist/index.js'))};
import express from 'express';
const api = createApiDocs({ logger: { debug() {}, warn() {} } });
const app = express();
const router = express.Router();
router.get('/users/:id', (_q, r) => r.end());
app.use('/api', router);
console.log(Object.keys(api.getSpec({ app }).paths).join(','));
`,
    );
    const outfile = join(dir, 'out.cjs');
    await build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['express'],
      outfile,
      logLevel: 'silent',
    });
    const output = execFileSync(process.execPath, [outfile], {
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: join(repo, 'node_modules') },
    }).trim();
    expect(output).toBe('/api/users/{id}');
  });
});
