import { z } from 'zod';
import type { JSONSchema, SchemaAdapter, SchemaIO, ValidationResult } from './types.js';

function pathToString(path: readonly PropertyKey[] | undefined): string {
  return (path ?? []).map(String).join('.');
}

// Subpath-only adapter (`express-api-docs/zod`). This is the only `src/**` file allowed
// to import `zod` (ADR-04, enforced by eslint.config.js).
export const zodAdapter: SchemaAdapter<z.ZodType> = {
  name: 'zod',

  isSchema(x): x is z.ZodType {
    return x instanceof z.ZodType;
  },

  validate(schema, input): ValidationResult<unknown> {
    const result = schema.safeParse(input);
    if (result.success) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({ path: pathToString(issue.path), message: issue.message })),
    };
  },

  toJSONSchema(schema, io: SchemaIO): JSONSchema {
    try {
      return z.toJSONSchema(schema, { target: 'draft-2020-12', io, unrepresentable: 'any' }) as JSONSchema;
    } catch {
      return {};
    }
  },
};
