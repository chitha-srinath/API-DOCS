// ST-007 (S-07): AC-003, AC-001, ADR-41 — exact runtime export sets for `.`,
// `./manual` and `./zod`, in ESM and CJS, against the built dist.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();

const MAIN_KEYS = [
  'ApiDocsConfigError',
  'ApiDocsSchemaError',
  'DEFAULT_OPTIONS',
  'createApiDocs',
  'installRecorder',
  'standardSchemaAdapter',
].sort();
const ZOD_KEYS = ['ApiDocsSchemaError', 'zodAdapter'].sort();

describe('entries/parity', () => {
  it('ESM `.` exports exactly the ADR-41 set', async () => {
    const mod = (await import(join(root, 'dist/index.js'))) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(MAIN_KEYS);
  });

  it('CJS `.` exports exactly the ADR-41 set', () => {
    const mod = require(join(root, 'dist/index.cjs')) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(MAIN_KEYS);
  });

  it('ESM `./manual` exports exactly the ADR-41 set', async () => {
    const mod = (await import(join(root, 'dist/manual.js'))) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(MAIN_KEYS);
  });

  it('CJS `./manual` exports exactly the ADR-41 set', () => {
    const mod = require(join(root, 'dist/manual.cjs')) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(MAIN_KEYS);
  });

  it('ESM `./zod` exports exactly [ApiDocsSchemaError, zodAdapter]', async () => {
    const mod = (await import(join(root, 'dist/zod.js'))) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(ZOD_KEYS);
  });

  it('CJS `./zod` exports exactly [ApiDocsSchemaError, zodAdapter]', () => {
    const mod = require(join(root, 'dist/zod.cjs')) as Record<string, unknown>;
    expect(Object.keys(mod).sort()).toEqual(ZOD_KEYS);
  });

  it('no owned file contains the old package name', () => {
    const OLD_NAME = ['express', 'openapi', 'lite'].join('-');
    const ownedDirs = ['src/serve', 'test/serve', 'test/entries', 'test/perf', 'bench'];
    const ownedFiles = ['src/index.ts', 'src/manual.ts', 'src/zod.ts'];
    const offenders: string[] = [];

    function walk(dir: string): void {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (readFileSync(full, 'utf8').includes(OLD_NAME)) offenders.push(full);
      }
    }

    for (const dir of ownedDirs) walk(join(root, dir));
    for (const file of ownedFiles) {
      try {
        if (readFileSync(join(root, file), 'utf8').includes(OLD_NAME)) offenders.push(file);
      } catch {
        /* file may not exist in a partial checkout */
      }
    }

    expect(offenders).toEqual([]);
  });
});
