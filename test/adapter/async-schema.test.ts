import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiDocsSchemaError } from '../../src/adapter/errors.js';
import { memoizeAdapter } from '../../src/adapter/memo.js';
import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import type { StandardSchemaV1 } from '../../src/adapter/standard-types.js';

function makeAsyncStandardSchema(vendor: string): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor,
      validate: () => Promise.reject(new Error('nope')),
    },
  };
}

describe('ADR-31(1): async validate throws ApiDocsSchemaError', () => {
  let unhandledRejectionSpy: ReturnType<typeof vi.fn<(reason: unknown) => void>>;
  let listener: (reason: unknown) => void;

  beforeEach(() => {
    unhandledRejectionSpy = vi.fn<(reason: unknown) => void>();
    listener = (reason: unknown) => {
      unhandledRejectionSpy(reason);
    };
    process.on('unhandledRejection', listener);
  });

  afterEach(() => {
    process.off('unhandledRejection', listener);
  });

  it('throws ApiDocsSchemaError with code and vendor for a hand-built async schema', async () => {
    const schema = makeAsyncStandardSchema('acme');
    let caught: unknown;
    try {
      standardSchemaAdapter.validate(schema, {});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiDocsSchemaError);
    expect((caught as ApiDocsSchemaError).code).toBe('EAD_ASYNC_SCHEMA');
    expect((caught as ApiDocsSchemaError).message).toContain('acme');

    await new Promise((r) => setImmediate(r));
    expect(unhandledRejectionSpy).not.toHaveBeenCalled();
  });

  it('throws for a zod schema with an async refine, via standardSchemaAdapter', () => {
    const schema = z.object({ a: z.string().refine(async () => true) });
    expect(() => standardSchemaAdapter.validate(schema, { a: 'x' })).toThrow(ApiDocsSchemaError);
  });

  it('propagates the same error through memoizeAdapter', () => {
    const schema = makeAsyncStandardSchema('acme');
    const memoized = memoizeAdapter(standardSchemaAdapter);
    expect(() => memoized.validate(schema, {})).toThrow(ApiDocsSchemaError);
  });
});
