import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

describe('v4 scripts (ADR-51)', () => {
  it('typecheck:v4 runs tsc against tsconfig.v4.json and the v4 typecheck config', () => {
    expect(pkg.scripts['typecheck:v4']).toContain('tsc --noEmit -p tsconfig.v4.json');
    expect(pkg.scripts['typecheck:v4']).toContain('vitest.typecheck.v4.config.ts');
  });

  it('test:v4 runs coverage without --typecheck then chains typecheck:v4', () => {
    expect(pkg.scripts['test:v4']).toContain('vitest run --coverage');
    expect(pkg.scripts['test:v4']).not.toContain('--typecheck');
    expect(pkg.scripts['test:v4']).toContain('npm run typecheck:v4');
  });

  it('vitest.typecheck.v4.config.ts has the required typecheck shape', async () => {
    const mod = await import('../../vitest.typecheck.v4.config.ts');
    const config = mod.default;
    const typecheck = config.test?.typecheck;
    expect(typecheck?.tsconfig).toBe('./tsconfig.v4.json');
    expect(typecheck?.enabled).toBe(true);
    expect(typecheck?.only).toBe(true);
    expect(typecheck?.exclude).toContain('**/*.v5.test-d.ts');
  });

  it('tsconfig.v4.json extends the base config and excludes v5 type-only tests', () => {
    const tsconfig = JSON.parse(readFileSync(join(root, 'tsconfig.v4.json'), 'utf8'));
    expect(tsconfig.extends).toBe('./tsconfig.json');
    expect(tsconfig.exclude).toContain('**/*.v5.test-d.ts');
  });
});
