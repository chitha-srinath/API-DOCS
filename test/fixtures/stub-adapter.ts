import type { SchemaAdapter } from '../../src/adapter/types.js';

/** A non-Zod schema: required string fields and their JSON types. */
export interface StubSchema {
  kind: 'stub';
  fields: Record<string, 'string' | 'number'>;
}

export const stub = (fields: StubSchema['fields']): StubSchema => ({ kind: 'stub', fields });

/** A minimal hand-written adapter used to prove the SchemaAdapter port (AC-005). */
export const stubAdapter: SchemaAdapter<StubSchema> = {
  name: 'stub',
  isSchema: (value): value is StubSchema =>
    typeof value === 'object' && value !== null && (value as StubSchema).kind === 'stub',
  validate(schema, input) {
    const record = (input ?? {}) as Record<string, unknown>;
    const issues = Object.entries(schema.fields)
      .filter(([key, type]) =>
        type === 'number' ? Number.isNaN(Number(record[key])) : typeof record[key] !== 'string',
      )
      .map(([key, type]) => ({ path: [key], message: `expected ${type}` }));
    if (issues.length > 0) return { ok: false, issues };
    const data = Object.fromEntries(
      Object.entries(schema.fields).map(([key, type]) => [
        key,
        type === 'number' ? Number(record[key]) : record[key],
      ]),
    );
    return { ok: true, data };
  },
  toJSONSchema(schema) {
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(schema.fields).map(([key, type]) => [key, { type }]),
      ),
      required: Object.keys(schema.fields),
    };
  },
};
