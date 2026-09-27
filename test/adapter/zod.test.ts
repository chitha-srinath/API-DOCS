import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiDocsSchemaError } from '../../src/adapter/errors.js';
import { zodAdapter } from '../../src/adapter/zod.js';
import * as subpath from '../../src/zod.js';

describe('zodAdapter (express-api-docs/zod)', () => {
  it('is the subpath export', () => {
    expect(subpath.zodAdapter).toBe(zodAdapter);
    expect(zodAdapter.name).toBe('zod');
  });

  it('recognises zod schemas only', () => {
    expect(zodAdapter.isSchema(z.string())).toBe(true);
    expect(zodAdapter.isSchema({ '~standard': {} })).toBe(false);
  });

  it('validates and coerces', () => {
    expect(zodAdapter.validate(z.object({ n: z.coerce.number() }), { n: '5' })).toEqual({
      ok: true,
      data: { n: 5 },
    });
    const bad = zodAdapter.validate(z.object({ n: z.number() }), { n: 'x' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues[0]!.path).toEqual(['n']);
  });

  it('uses unrepresentable: any for transforms', () => {
    const schema = z.object({ d: z.date() });
    expect(zodAdapter.toJSONSchema(schema, 'input')).toEqual({
      type: 'object',
      properties: { d: {} },
      required: ['d'],
    });
  });

  it('throws ApiDocsSchemaError for async refinements', () => {
    const schema = z.string().refine(async () => true);
    expect(() => zodAdapter.validate(schema, 'a')).toThrow(ApiDocsSchemaError);
  });

  it('rethrows other errors', () => {
    const schema = z.string().transform(() => {
      throw new RangeError('boom');
    });
    expect(() => zodAdapter.validate(schema, 'a')).toThrow(RangeError);
  });
});
