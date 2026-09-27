import { describe, expect, it, vi } from 'vitest';
import { memoizeAdapter } from '../../src/adapter/memo.js';
import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import type { StandardSchemaV1 } from '../../src/adapter/standard-types.js';

function schemaWithoutJsonSchema(): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'acme',
      validate: (v: unknown) => ({ value: v }),
    },
  };
}

function schemaWhoseJsonSchemaThrows(): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'acme',
      validate: (v: unknown) => ({ value: v }),
      jsonSchema: {
        input: () => {
          throw new Error('boom');
        },
        output: () => {
          throw new Error('boom');
        },
      },
    },
  };
}

function healthySchema(): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'acme',
      validate: (v: unknown) => ({ value: v }),
      jsonSchema: {
        input: () => ({ type: 'object' }),
        output: () => ({ type: 'object' }),
      },
    },
  };
}

describe('ADR-31(2): missing jsonSchema is accepted', () => {
  it('returns {} when ~standard.jsonSchema is absent', () => {
    expect(standardSchemaAdapter.toJSONSchema(schemaWithoutJsonSchema(), 'input')).toEqual({});
  });

  it('returns {} without throwing when jsonSchema.output throws', () => {
    expect(() => standardSchemaAdapter.toJSONSchema(schemaWhoseJsonSchemaThrows(), 'output')).not.toThrow();
    expect(standardSchemaAdapter.toJSONSchema(schemaWhoseJsonSchemaThrows(), 'output')).toEqual({});
  });

  it('warns exactly once per schema identity, regardless of how many times or which io is requested', () => {
    const logger = { warn: vi.fn(), debug: vi.fn() };
    const memoized = memoizeAdapter(standardSchemaAdapter, logger);

    const schemaA = schemaWithoutJsonSchema();
    const schemaB = schemaWithoutJsonSchema();
    const healthy = healthySchema();

    memoized.toJSONSchema(schemaA, 'input');
    memoized.toJSONSchema(schemaA, 'input');
    memoized.toJSONSchema(schemaA, 'output');
    memoized.toJSONSchema(schemaB, 'input');
    memoized.toJSONSchema(healthy, 'input');

    const degradedWarnings = logger.warn.mock.calls.filter(
      (call) => call[0] === 'EAD_SCHEMA_NO_JSONSCHEMA' && call[1] === 'standard',
    );
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(degradedWarnings.length).toBe(2);
  });

  it('the returned {} is never the shared sentinel (mutation isolation)', () => {
    const memoized = memoizeAdapter(standardSchemaAdapter);
    const first = memoized.toJSONSchema(schemaWithoutJsonSchema(), 'input');
    const second = memoized.toJSONSchema(schemaWithoutJsonSchema(), 'input');
    expect(first).toEqual({});
    expect(second).toEqual({});
    expect(first).not.toBe(second);
    (first as Record<string, unknown>).mutated = true;
    expect(second).not.toHaveProperty('mutated');
  });
});
