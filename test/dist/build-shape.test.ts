import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');

describe('build shape (ADR-40 static half)', () => {
  it('emits no chunk files', () => {
    const files = readdirSync(distDir);
    expect(files.some((f) => f.startsWith('chunk-'))).toBe(false);
  });

  it('index entries import auto-record as external', () => {
    const js = readFileSync(join(distDir, 'index.js'), 'utf8');
    const cjs = readFileSync(join(distDir, 'index.cjs'), 'utf8');
    expect(js).toContain('import "./auto-record.js"');
    expect(cjs).toContain('require("./auto-record.cjs")');
  });

  it('does not inline the recorder auto-install invocation', () => {
    // index/index.cjs legitimately declare and export `installRecorder` (ADR-41),
    // so banning the identifier outright is a false positive. The build-shape
    // guarantee (ADR-40) is that the *auto-install call site* -- the bare
    // `installRecorder(express, log)` invocation and its `autoRecord()` trigger,
    // both defined only in `src/introspect/auto-record.ts` -- stays exclusively
    // in the external `dist/auto-record.{js,cjs}` entry, not inlined into index.
    const js = readFileSync(join(distDir, 'index.js'), 'utf8');
    const cjs = readFileSync(join(distDir, 'index.cjs'), 'utf8');
    expect(js).not.toContain('installRecorder(express, log)');
    expect(cjs).not.toContain('installRecorder(express, log)');
    expect(js).not.toContain('autoRecord()');
    expect(cjs).not.toContain('autoRecord()');
  });

  it('cjs outputs have no bare import.meta (shim present)', () => {
    const autoRecordCjs = readFileSync(join(distDir, 'auto-record.cjs'), 'utf8');
    const indexCjs = readFileSync(join(distDir, 'index.cjs'), 'utf8');
    expect(autoRecordCjs).not.toMatch(/\bimport\.meta\b/);
    expect(indexCjs).not.toMatch(/\bimport\.meta\b/);
  });
});
