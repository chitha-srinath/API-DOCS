// ST-008 (S-08): structural/content assertions on README.md and CHANGELOG.md
// (component C11, AC-029). Also carries the ADR-52 zod-wording assertions that
// architecture.md attributes to `test/docs/readme.test.ts`; both paths are
// inside `test/docs/**`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

// Built from parts so this file never contains the literal old working name.
const oldWorkingName = ['express', '-openapi-', 'lite'].join('');

describe('README sections (AC-029)', () => {
  const headings = [
    'Install',
    'Quick start',
    'SchemaAdapter',
    'Security',
    'Response validation',
    'Error shape',
    'Incremental adoption',
    'Route auto-detection',
    'Configuration',
    'Internals',
  ];

  it.each(headings)('has a "%s" heading', (heading) => {
    const re = new RegExp(`^#{1,6}\\s*${heading}\\s*$`, 'im');
    expect(re.test(readme), `README missing heading: ${heading}`).toBe(true);
  });

  it('documents the autoDetect: false opt-out', () => {
    expect(readme).toMatch(/autoDetect:\s*false/);
  });

  it('documents importing before mounting routers', () => {
    expect(readme).toMatch(/import .*before mounting/i);
  });

  it('documents installRecorder with second-copy wording and the warn code', () => {
    expect(readme).toContain('installRecorder(');
    expect(readme).toMatch(/second copy|pnpm|monorepo/i);
    expect(readme).toContain('EAD_RECORDER_NOT_INSTALLED');
  });

  it('documents the /manual opt-out entry', () => {
    expect(readme).toContain('express-api-contract/manual');
  });

  it('documents the APM before/after result', () => {
    expect(readme).toMatch(/APM/);
  });

  it('documents the /zod subpath and the optional ^4.2.0 peer, without a below-4.2 workaround', () => {
    expect(readme).toContain('express-api-contract/zod');
    expect(readme).toMatch(/optional peer/i);
    expect(readme).toContain('^4.2.0');
    expect(readme).not.toContain("import { zodAdapter } from 'express-api-contract'");
    expect(readme).not.toMatch(/zod[^\n]*\^4\.0\.0/);
  });

  it('ADR-52: states "zod >= 4.2" and never advises a below-4.2 workaround', () => {
    expect(readme).toMatch(/zod\s*>=\s*4\.2/);
    expect(readme.toLowerCase()).not.toContain('below 4.2');
    expect(readme).not.toMatch(/<\s*4\.2/);
  });

  it('SchemaAdapter section documents schemaAdapter, meta.adapter and the C2 method names', () => {
    expect(readme).toContain('schemaAdapter');
    expect(readme).toContain('meta.adapter');
    expect(readme).toContain('isSchema');
    expect(readme).toContain('validate');
    expect(readme).toContain('toJSONSchema');
    expect(readme).not.toContain('toJsonSchema');
  });

  it('Error section documents err.code, EAD_ASYNC_SCHEMA, both error classes and cross-build instanceof', () => {
    expect(readme).toContain('err.code');
    expect(readme).toContain('EAD_ASYNC_SCHEMA');
    expect(readme).toContain('ApiDocsConfigError');
    expect(readme).toContain('ApiDocsSchemaError');
    expect(readme).toContain('instanceof');
    expect(readme).toMatch(/minif/i);
  });

  it('Internals note documents all 6 versioned protocol keys', () => {
    expect(readme).toContain('express-api-contract.v1.meta');
    expect(readme).toContain('express-api-contract.v1.mount');
    expect(readme).toContain('express-api-contract.v1.child');
    expect(readme).toContain('express-api-contract.v1.recorder');
    expect(readme).toContain('express-api-contract.v1.brand');
    expect(readme).toContain('express-api-contract.v1.brandKey');
    expect(readme.toLowerCase()).toContain('protocol');
    expect(readme).not.toMatch(/Symbol\.for\(['"]express-api-contract\.meta['"]\)/);
  });

  it('documents the Node >= 22 floor', () => {
    expect(readme).toMatch(/Node(\.js)?\s*(>=|≥)\s*22/);
  });

  it('documents the new commands and the scoped/nightly mutation split', () => {
    expect(readme).toContain('npm run check:pack');
    expect(readme).toContain('npm run mutation');
    expect(readme).toContain('npm run perf');
    expect(readme).toContain('npm audit');
    expect(readme).toContain('--mutate');
    expect(readme).toContain('--incremental');
    expect(readme).toMatch(/nightly/i);
  });

  it('does not contain the old working name', () => {
    expect(readme).not.toContain(oldWorkingName);
  });
});

describe('CHANGELOG.md (AC-029)', () => {
  it('has an entry for the current package version mentioning key features', () => {
    expect(changelog).toMatch(/##\s*\[0\.1\.0\]/);
    expect(changelog).toContain('installRecorder');
    expect(changelog).toContain('/manual');
    expect(changelog).toContain('/zod');
    expect(changelog).toContain('schemaAdapter');
    expect(changelog).toMatch(/Node\s*(\.js)?\s*(>=|≥)?\s*22|Node 22/i);
  });

  it('does not contain the old working name', () => {
    expect(changelog).not.toContain(oldWorkingName);
  });
});
