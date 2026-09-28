import { describe, expect, it, vi } from 'vitest';
import { memoizeAdapter } from '../../src/adapter/memo.js';
import type { JSONSchema, SchemaAdapter, SchemaIO } from '../../src/adapter/types.js';

function makeSpyAdapter() {
  const toJSONSchema = vi.fn((_schema: object, io: SchemaIO): JSONSchema => ({ io }));
  const validate = vi.fn(() => ({ ok: true as const, data: 'x' }));
  const adapter: SchemaAdapter<object> = {
    name: 'spy',
    isSchema: (x): x is object => typeof x === 'object' && x !== null,
    validate,
    toJSONSchema,
  };
  return { adapter, toJSONSchema, validate };
}

describe('memoizeAdapter (ADR-03)', () => {
  it('calls the inner adapter once for the same schema and io, returning the identical object', () => {
    const { adapter, toJSONSchema } = makeSpyAdapter();
    const memoized = memoizeAdapter(adapter);
    const schema = {};

    const first = memoized.toJSONSchema(schema, 'input');
    const second = memoized.toJSONSchema(schema, 'input');

    expect(toJSONSchema).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('calls the inner adapter separately for different io values', () => {
    const { adapter, toJSONSchema } = makeSpyAdapter();
    const memoized = memoizeAdapter(adapter);
    const schema = {};

    memoized.toJSONSchema(schema, 'input');
    memoized.toJSONSchema(schema, 'output');

    expect(toJSONSchema).toHaveBeenCalledTimes(2);
  });

  it('keeps separate cache entries for different schemas', () => {
    const { adapter, toJSONSchema } = makeSpyAdapter();
    const memoized = memoizeAdapter(adapter);

    memoized.toJSONSchema({}, 'input');
    memoized.toJSONSchema({}, 'input');

    expect(toJSONSchema).toHaveBeenCalledTimes(2);
  });

  it('delegates validate on every call', () => {
    const { adapter, validate } = makeSpyAdapter();
    const memoized = memoizeAdapter(adapter);

    memoized.validate({}, 'a');
    memoized.validate({}, 'b');

    expect(validate).toHaveBeenCalledTimes(2);
  });
});
