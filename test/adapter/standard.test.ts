import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiDocsSchemaError } from '../../src/adapter/errors.js';
import { memoizeAdapter } from '../../src/adapter/memo.js';
import { standardSchemaAdapter, stripSchemaRoot, toIssuePath } from '../../src/adapter/standard.js';
import type { StandardSchemaV1 } from '../../src/adapter/standard-types.js';

function fakeSchema(props: Partial<StandardSchemaV1.Props>): StandardSchemaV1 {
  return { '~standard': { version: 1, vendor: 'fake', validate: () => ({ value: 1 }), ...props } };
}

describe('standardSchemaAdapter', () => {
  it('recognises Standard Schemas only', () => {
    expect(standardSchemaAdapter.isSchema(z.string())).toBe(true);
    expect(standardSchemaAdapter.isSchema(fakeSchema({}))).toBe(true);
    expect(standardSchemaAdapter.isSchema({})).toBe(false);
    expect(standardSchemaAdapter.isSchema(null)).toBe(false);
    expect(standardSchemaAdapter.isSchema({ '~standard': {} })).toBe(false);
    expect(standardSchemaAdapter.isSchema('x')).toBe(false);
  });

  it('validates and coerces zod v4 without importing zod', () => {
    const schema = z.object({ id: z.coerce.number() });
    expect(standardSchemaAdapter.validate(schema, { id: '3' })).toEqual({
      ok: true,
      data: { id: 3 },
    });
  });

  it('maps issues with paths', () => {
    const schema = z.object({ user: z.object({ tags: z.array(z.string()) }) });
    const result = standardSchemaAdapter.validate(schema, { user: { tags: ['a', 1] } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.path).toEqual(['user', 'tags', 1]);
      expect(typeof result.issues[0]!.message).toBe('string');
    }
  });

  it('toIssuePath accepts PathSegment objects, symbols and undefined', () => {
    expect(toIssuePath([{ key: 'a' }, 0, { key: 2 }])).toEqual(['a', 0, 2]);
    expect(toIssuePath([Symbol.for('s')])).toEqual(['Symbol(s)']);
    expect(toIssuePath(undefined)).toEqual([]);
  });

  it('ADR-31: an async validate throws ApiDocsSchemaError without an unhandled rejection', async () => {
    const rejected = Promise.reject(new Error('late'));
    const schema = fakeSchema({ validate: () => rejected as never });
    let error: unknown;
    try {
      standardSchemaAdapter.validate(schema, 1);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ApiDocsSchemaError);
    expect((error as ApiDocsSchemaError).code).toBe('EAD_ASYNC_SCHEMA');
    expect((error as Error).message).toContain('"fake"');
    await new Promise((r) => setTimeout(r, 5));
  });

  it('emits draft 2020-12 JSON Schema without $schema', () => {
    const json = standardSchemaAdapter.toJSONSchema(z.object({ id: z.number() }), 'input');
    expect(json).toEqual({
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    });
  });

  it('distinguishes input and output', () => {
    const schema = z.string().default('x');
    expect(standardSchemaAdapter.toJSONSchema(schema, 'input')).toEqual({
      type: 'string',
      default: 'x',
    });
    expect(standardSchemaAdapter.toJSONSchema(schema, 'output')).toEqual({
      type: 'string',
      default: 'x',
    });
  });

  it('ADR-31: missing jsonSchema gives {} and a warn', () => {
    const warn = vi.fn();
    expect(standardSchemaAdapter.toJSONSchema(fakeSchema({}), 'input', { warn })).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toEqual({ code: 'EAD_SCHEMA_NO_JSONSCHEMA', vendor: 'fake' });
    expect(standardSchemaAdapter.toJSONSchema(fakeSchema({}), 'input')).toEqual({});
  });

  it('ADR-31: a throwing converter gives {} and a warn', () => {
    const warn = vi.fn();
    const schema = fakeSchema({
      jsonSchema: {
        input: () => {
          throw new Error('nope');
        },
        output: () => ({}),
      },
    });
    expect(standardSchemaAdapter.toJSONSchema(schema, 'input', { warn })).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stripSchemaRoot keeps schemas without $schema as-is', () => {
    const schema = { type: 'string' };
    expect(stripSchemaRoot(schema)).toBe(schema);
    expect(stripSchemaRoot({ $schema: 'x', type: 'string' })).toEqual({ type: 'string' });
  });
});

describe('memoizeAdapter', () => {
  it('converts each schema once per io and warns once per schema', () => {
    const warn = vi.fn();
    const adapter = memoizeAdapter(standardSchemaAdapter);
    const schema = fakeSchema({});
    adapter.toJSONSchema(schema, 'input', { warn });
    adapter.toJSONSchema(schema, 'input', { warn });
    expect(warn).toHaveBeenCalledTimes(1);
    adapter.toJSONSchema(schema, 'output', { warn });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('returns the same object for repeated calls and delegates the rest', () => {
    const adapter = memoizeAdapter(standardSchemaAdapter);
    const schema = z.string();
    expect(adapter.toJSONSchema(schema, 'input')).toBe(adapter.toJSONSchema(schema, 'input'));
    expect(adapter.name).toBe('standard-schema');
    expect(adapter.isSchema(schema)).toBe(true);
    expect(adapter.validate(schema, 'a')).toEqual({ ok: true, data: 'a' });
  });

  it('does not cache primitive schemas', () => {
    const inner = {
      name: 'p',
      isSchema: (_v: unknown): _v is unknown => true,
      validate: () => ({ ok: true as const, data: 1 }),
      toJSONSchema: vi.fn(() => ({})),
    };
    const adapter = memoizeAdapter(inner);
    adapter.toJSONSchema('s' as never, 'input');
    adapter.toJSONSchema('s' as never, 'input');
    expect(inner.toJSONSchema).toHaveBeenCalledTimes(2);
  });
});
