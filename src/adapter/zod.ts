import { z } from 'zod';
import { toIssuePath } from './standard.js';
import type { JSONSchema, SchemaAdapter, SchemaValidationResult } from './types.js';
import { ApiDocsSchemaError } from './errors.js';

/**
 * Zod 4 adapter. The only module allowed to import `zod`; exposed at
 * `express-api-docs/zod`. Unrepresentable types (transforms, custom) become `{}`.
 */
export const zodAdapter: SchemaAdapter<z.ZodType> = {
  name: 'zod',

  isSchema(value: unknown): value is z.ZodType {
    return value instanceof z.ZodType;
  },

  validate(schema, input): SchemaValidationResult {
    let result: ReturnType<z.ZodType['safeParse']>;
    try {
      result = schema.safeParse(input);
    } catch (error) {
      if (error instanceof z.core.$ZodAsyncError) {
        throw new ApiDocsSchemaError(
          'EAD_ASYNC_SCHEMA',
          'A zod schema validated asynchronously. Request and response schemas must ' +
            'validate synchronously (remove async refinements/transforms).',
        );
      }
      throw error;
    }
    if (result.success) return { ok: true, data: result.data };
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        path: toIssuePath(issue.path),
        message: issue.message,
      })),
    };
  },

  toJSONSchema(schema, io): JSONSchema {
    const json = z.toJSONSchema(schema, {
      target: 'draft-2020-12',
      io,
      unrepresentable: 'any',
    }) as JSONSchema;
    const rest = { ...json };
    delete rest.$schema;
    return rest;
  },
};
