import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

describe('package manifest', () => {
  it('AC-001: name, license, LICENSE, no working-name leftovers', () => {
    expect(pkg.name).toBe('express-api-docs');
    expect(pkg.license).toBe('MIT');
    const license = readFileSync(new URL('LICENSE', root), 'utf8');
    expect(license).toContain('MIT License');
    expect(license).toContain('Copyright (c) 2026 chitha_srinath');
    const working = ['express', 'openapi', 'lite'].join('-');
    let hits = '';
    try {
      hits = execFileSync('git', ['grep', '-l', '-I', working, '--', '.', ':!.aidd'], { cwd: root, encoding: 'utf8' });
    } catch (error) {
      // git grep exits 1 when nothing matches
      expect((error as { status?: number }).status).toBe(1);
    }
    expect(hits).toBe('');
  });

  it('AC-002: exports map import/require/types for ., ./manual and ./zod', () => {
    for (const entry of ['.', './manual', './zod']) {
      const base = entry === '.' ? 'index' : entry.slice(2);
      expect(pkg.exports[entry]).toEqual({
        import: { types: `./dist/${base}.d.ts`, default: `./dist/${base}.js` },
        require: { types: `./dist/${base}.d.cts`, default: `./dist/${base}.cjs` },
      });
      for (const file of [`${base}.js`, `${base}.cjs`, `${base}.d.ts`, `${base}.d.cts`]) {
        expect(existsSync(new URL(`dist/${file}`, root)), file).toBe(true);
      }
    }
    expect(pkg.type).toBe('module');
    expect(pkg.main).toBe('./dist/index.cjs');
    expect(pkg.types).toBe('./dist/index.d.cts');
    expect(pkg.module).toBeUndefined();
  });

  it('AC-004: peers, engines, no runtime deps, zod subpath only', () => {
    expect(pkg.peerDependencies.express).toBe('^4.21.0 || ^5.0.0');
    expect(pkg.peerDependencies.zod).toBe('^4.0.0');
    expect(pkg.peerDependenciesMeta.zod.optional).toBe(true);
    expect(pkg.peerDependenciesMeta['@types/express'].optional).toBe(true);
    expect(pkg.engines.node).toBe('>=22');
    expect(pkg.dependencies).toBeUndefined();
    expect(Object.keys(pkg.devDependencies).filter((d) => /scalar|swagger-ui/.test(d))).toEqual([]);
    const main = readFileSync(new URL('dist/index.js', root), 'utf8');
    const mainCjs = readFileSync(new URL('dist/index.cjs', root), 'utf8');
    expect(main).not.toMatch(/zodAdapter|from "zod"|require\("zod"\)/);
    expect(mainCjs).not.toMatch(/zodAdapter|from "zod"|require\("zod"\)/);
    expect(readFileSync(new URL('dist/zod.js', root), 'utf8')).toContain('zodAdapter');
  });

  it('ADR-24: sideEffects lists exactly the auto-record files', () => {
    expect(pkg.sideEffects).toEqual(['./dist/auto-record.js', './dist/auto-record.cjs']);
  });
});
