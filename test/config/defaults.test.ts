import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import { OPTION_SPEC } from '../../src/config/spec-table.js';
import { validateOptions } from '../../src/config/validate.js';

function isRecursivelyFrozen(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return true;
  }
  if (seen.has(value)) {
    return true;
  }
  seen.add(value);
  if (!Object.isFrozen(value)) {
    return false;
  }
  return Object.getOwnPropertyNames(value).every((key) =>
    isRecursivelyFrozen((value as Record<string, unknown>)[key], seen),
  );
}

describe('config/defaults: DEFAULT_OPTIONS', () => {
  it('is deep-frozen', () => {
    expect(isRecursivelyFrozen(DEFAULT_OPTIONS)).toBe(true);
  });

  it('has a row for every option', () => {
    const expectedPaths = [
      'specPath',
      'serveSpec',
      'openapi.info',
      'openapi.servers',
      'openapi.tags',
      'securitySchemes',
      'security',
      'validateRequests',
      'validateResponses',
      'onValidationError',
      'autoDetect',
      'detectedDefaultResponse',
      'operationIdStrategy',
      'tagStrategy',
      'schemaAdapter',
    ];
    expect(Object.keys(OPTION_SPEC).sort()).toEqual(expectedPaths.sort());
  });

  it('has the documented defaults', () => {
    expect(DEFAULT_OPTIONS.specPath).toBe('/openapi.json');
    expect(DEFAULT_OPTIONS.validateRequests).toBe(true);
    expect(DEFAULT_OPTIONS.validateResponses).toBe(false);
    expect(DEFAULT_OPTIONS.autoDetect).toBe(true);
    expect(DEFAULT_OPTIONS.serveSpec).toBe(true);
  });

  it('DEFAULT_OPTIONS.schemaAdapter === null (ADR-38, AC-047)', () => {
    expect(DEFAULT_OPTIONS.schemaAdapter).toBeNull();
  });

  it('passes validateOptions()', () => {
    expect(() => validateOptions(DEFAULT_OPTIONS)).not.toThrow();
  });
});
