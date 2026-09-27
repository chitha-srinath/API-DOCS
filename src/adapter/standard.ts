import { ApiDocsSchemaError } from './errors.js';
import type { StandardSchemaV1 } from './standard-types.js';
import type { JSONSchema, SchemaAdapter, SchemaIO, ValidationResult } from './types.js';

// ADR-31(2): shared frozen sentinel returned when a schema has no `~standard.jsonSchema`
// converter (or it throws). Reference-compared by memo.ts to decide when to warn once.
export const NO_JSON_SCHEMA: JSONSchema = Object.freeze({});

function isStandardSchema(x: unknown): x is StandardSchemaV1 {
  if (!x || typeof x !== 'object') return false;
  const props = (x as { ['~standard']?: unknown })['~standard'];
  return !!props && typeof props === 'object' && typeof (props as { validate?: unknown }).validate === 'function';
}

function isThenable(x: unknown): x is Promise<unknown> {
  return !!x && typeof x === 'object' && typeof (x as { then?: unknown }).then === 'function';
}

function pathToString(path: StandardSchemaV1.Issue['path']): string {
  if (!path) return '';
  return path
    .map((segment) => (typeof segment === 'object' && segment !== null ? String(segment.key) : String(segment)))
    .join('.');
}

export const standardSchemaAdapter: SchemaAdapter<StandardSchemaV1> = {
  name: 'standard',
  isSchema: isStandardSchema,

  validate(schema, input): ValidationResult<unknown> {
    const result = schema['~standard'].validate(input);
    if (isThenable(result)) {
      result.catch(() => {});
      throw new ApiDocsSchemaError(schema['~standard'].vendor);
    }
    if (result.issues) {
      return {
        ok: false,
        issues: result.issues.map((issue) => ({ path: pathToString(issue.path), message: issue.message })),
      };
    }
    return { ok: true, data: result.value };
  },

  toJSONSchema(schema, io: SchemaIO): JSONSchema {
    try {
      const fn = schema['~standard'].jsonSchema?.[io];
      if (typeof fn !== 'function') return NO_JSON_SCHEMA;
      const out = fn({ target: 'draft-2020-12' });
      return (out ?? NO_JSON_SCHEMA) as JSONSchema;
    } catch {
      return NO_JSON_SCHEMA;
    }
  },
};
