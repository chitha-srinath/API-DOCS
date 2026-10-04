import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const license = readFileSync(join(root, 'LICENSE'), 'utf8');

const OLD_NAME = ['express', 'openapi', 'lite'].join('-');

describe('manifest', () => {
  it('has the correct name and license', () => {
    expect(pkg.name).toBe('express-api-contract');
    expect(pkg.license).toBe('MIT');
    expect(license).toContain('MIT License');
    expect(license).toMatch(/Copyright \(c\) \d{4} chitha_srinath/);
  });

  it('has correct peerDependencies', () => {
    expect(pkg.peerDependencies.express).toBe('^4.21.0 || ^5.0.0');
    expect(pkg.peerDependencies.zod).toBe('^4.2.0');
    expect(pkg.peerDependenciesMeta.zod.optional).toBe(true);
    expect(pkg.peerDependencies['@types/express']).toBe('^4.17.21 || ^5.0.0');
    expect(pkg.peerDependenciesMeta['@types/express'].optional).toBe(true);
  });

  it('has engines.node >=22', () => {
    expect(pkg.engines.node).toBe('>=22');
  });

  it('has the correct exports map', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', './manual', './package.json', './zod'].sort());
    for (const key of ['.', './manual', './zod']) {
      const entry = pkg.exports[key];
      expect(entry.import.types).toBeTruthy();
      expect(entry.import.default).toBeTruthy();
      expect(entry.require.types).toBeTruthy();
      expect(entry.require.default).toBeTruthy();
    }
    expect(pkg.exports['./package.json']).toBe('./package.json');
  });

  it('has correct types field and no module field', () => {
    expect(pkg.types).toBe('./dist/index.d.cts');
    expect('module' in pkg).toBe(false);
  });

  it('pins esbuild and zod devDependencies, excludes stryker vitest runner', () => {
    expect(pkg.devDependencies.esbuild).toMatch(/^~0\.27\./);
    expect(pkg.devDependencies.zod).toBe('^4.6.5');
    expect('@stryker-mutator/vitest-runner' in pkg.devDependencies).toBe(false);
  });

  it('has no runtime dependency on UI asset packages', () => {
    const deps = pkg.dependencies || {};
    expect(Object.keys(deps).length).toBe(0);
    const all = { ...deps, ...pkg.peerDependencies };
    for (const key of Object.keys(all)) {
      expect(key).not.toMatch(/redoc/i);
    }
  });

  it('contains the old package name in no file outside .aidd/', () => {
    const skip = new Set(['.aidd', '.git', 'node_modules', 'dist', 'coverage', 'reports', '.stryker-tmp']);
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        if (skip.has(entry)) continue;
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (stat.isFile()) {
          let content = '';
          try {
            content = readFileSync(full, 'utf8');
          } catch {
            content = '';
          }
          if (content.includes(OLD_NAME)) offenders.push(full);
        }
      }
    }

    walk(root);
    expect(offenders).toEqual([]);
  });
});
