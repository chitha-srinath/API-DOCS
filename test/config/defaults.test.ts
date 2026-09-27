import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, deepFreeze, freezeResolved } from '../../src/config/defaults.js';
import { OPTION_SPEC } from '../../src/config/spec-table.js';
import { resolveOptions, validateOptions } from '../../src/config/validate.js';

function expectDeepFrozen(value: unknown, path = 'DEFAULT_OPTIONS'): void {
  if (typeof value !== 'object' || value === null) return;
  expect(Object.isFrozen(value), path).toBe(true);
  for (const [key, child] of Object.entries(value)) expectDeepFrozen(child, `${path}.${key}`);
}

describe('DEFAULT_OPTIONS (AC-036)', () => {
  it('is deep-frozen', () => {
    expectDeepFrozen(DEFAULT_OPTIONS);
    expect(() => {
      (DEFAULT_OPTIONS.openapi.info as { title: string }).title = 'x';
    }).toThrow(TypeError);
  });

  it('has a row for every option in AC-037..AC-042', () => {
    const required = [
      'specPath',
      'docsPath',
      'ui',
      'cdnUrl',
      'serveSpec',
      'serveDocs',
      'docs.specUrl',
      'openapi.info.title',
      'openapi.info.version',
      'openapi.info.description',
      'openapi.servers',
      'openapi.tags',
      'securitySchemes',
      'security',
      'validateRequests',
      'validateResponses',
      'onValidationError',
      'autoDetect.enabled',
      'autoDetect.include',
      'autoDetect.exclude',
      'detectedDefaultResponse.status',
      'detectedDefaultResponse.description',
      'operationIdStrategy',
      'tagStrategy',
    ];
    for (const path of required) expect(Object.keys(OPTION_SPEC)).toContain(path);
  });

  it('has the documented defaults', () => {
    expect(DEFAULT_OPTIONS.specPath).toBe('/openapi.json');
    expect(DEFAULT_OPTIONS.docsPath).toBe('/docs');
    expect(DEFAULT_OPTIONS.ui).toBe('scalar');
    expect(DEFAULT_OPTIONS.validateRequests).toBe(true);
    expect(DEFAULT_OPTIONS.validateResponses).toBe(false);
    expect(DEFAULT_OPTIONS.autoDetect).toEqual({ enabled: true, include: [], exclude: [] });
    expect(DEFAULT_OPTIONS.serveSpec).toBe(true);
    expect(DEFAULT_OPTIONS.serveDocs).toBe(true);
    expect(DEFAULT_OPTIONS.openapi.info).toEqual({
      title: 'API',
      version: '0.0.0',
      description: null,
      summary: null,
      termsOfService: null,
      contact: null,
      license: null,
    });
    expect(DEFAULT_OPTIONS.detectedDefaultResponse).toEqual({ status: 200, description: 'OK' });
  });

  it('every default passes its own check and validateOptions()', () => {
    for (const [path, row] of Object.entries(OPTION_SPEC))
      expect(row.check(row.default), path).toBe(true);
    expect(() => validateOptions(structuredClone(DEFAULT_OPTIONS))).not.toThrow();
  });

  it('every row has a description and allowed text', () => {
    for (const row of Object.values(OPTION_SPEC)) {
      expect(row.description.length).toBeGreaterThan(5);
      expect(row.allowed.length).toBeGreaterThan(2);
    }
  });
});

describe('freezeResolved', () => {
  it('freezes a copy and keeps adapter/logger by reference, unfrozen', () => {
    const logger = { debug() {}, warn() {} };
    const servers = [{ url: 'https://a' }];
    const frozen = freezeResolved(resolveOptions({ logger, openapi: { servers } }));
    expect(frozen.logger).toBe(logger);
    expect(Object.isFrozen(logger)).toBe(false);
    expect(Object.isFrozen(servers)).toBe(false);
    expect(Object.isFrozen(frozen.openapi.servers)).toBe(true);
    expect(frozen.openapi.servers).toEqual(servers);
  });

  it('deepFreeze leaves non-plain values alone', () => {
    const date = new Date();
    expect(deepFreeze(date)).toBe(date);
    expect(Object.isFrozen(date)).toBe(false);
    expect(deepFreeze(5)).toBe(5);
  });
});
