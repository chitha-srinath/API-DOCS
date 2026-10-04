import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function packDryRun(): { path: string }[] {
  const out = execSync('npm pack --dry-run --json', { cwd: root }).toString();
  const parsed = JSON.parse(out);
  return parsed[0].files;
}

describe('pack contents', () => {
  const files = packDryRun();
  const paths = files.map((f) => f.path.replace(/\\/g, '/'));

  it('contains all dist entry outputs', () => {
    for (const name of ['index', 'manual', 'zod', 'auto-record']) {
      expect(paths).toContain(`dist/${name}.js`);
      expect(paths).toContain(`dist/${name}.cjs`);
    }
    for (const name of ['index', 'manual', 'zod']) {
      expect(paths).toContain(`dist/${name}.d.ts`);
      expect(paths).toContain(`dist/${name}.d.cts`);
    }
  });

  it('includes every exports target', () => {
    for (const key of Object.keys(pkg.exports)) {
      if (key === './package.json') continue;
      const entry = pkg.exports[key];
      for (const cond of [entry.import, entry.require]) {
        for (const target of [cond.types, cond.default]) {
          expect(paths).toContain(target.replace('./', ''));
        }
      }
    }
  });

  it('has no bundled UI assets and no stray js/cjs outside dist', () => {
    for (const p of paths) {
      expect(p).not.toMatch(/\.css$/);
      expect(p).not.toMatch(/redoc/i);
      if (/\.(js|cjs)$/.test(p)) {
        expect(p.startsWith('dist/')).toBe(true);
      }
    }
  });

  it('sideEffects matches the auto-record entries', () => {
    expect(pkg.sideEffects).toEqual([
      './dist/auto-record.js',
      './dist/auto-record.cjs',
      'src/introspect/auto-record.ts',
    ]);
  });

  it('index outputs do not reference zod', () => {
    const js = readFileSync(join(root, 'dist/index.js'), 'utf8');
    const cjs = readFileSync(join(root, 'dist/index.cjs'), 'utf8');
    expect(js).not.toMatch(/\bzod\b/);
    expect(cjs).not.toMatch(/\bzod\b/);
  });

  it('packs and resolves via require', () => {
    const tarOut = execSync('npm pack --json', { cwd: root }).toString();
    const tarInfo = JSON.parse(tarOut);
    const tarballName: string = tarInfo[0].filename;
    const tmp = mkdtempSync(join(tmpdir(), 'eaod-pack-'));
    const nodeModules = join(tmp, 'node_modules', 'express-api-contract');
    mkdirSync(nodeModules, { recursive: true });
    const tarballPath = join(root, tarballName);
    const toPosix = (p: string): string => p.replace(/\\/g, '/');
    execSync(`tar --force-local -xf "${toPosix(tarballPath)}" -C "${toPosix(nodeModules)}" --strip-components=1`);
    rmSync(tarballPath);

    const req = createRequire(join(tmp, 'x.cjs'));
    const resolved = req.resolve('express-api-contract/package.json');
    expect(resolved).toBeTruthy();
    const loaded = req(resolved);
    expect(loaded.name).toBe('express-api-contract');
  }, 60000);
});
