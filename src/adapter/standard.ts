import { ApiDocsSchemaError } from './errors.js';
import type { StandardSchemaV1 } from './standard-types.js';
import type { JSONSchema, SchemaAdapter, SchemaIssue, SchemaValidationResult } from './types.js';

const TARGET = 'draft-2020-12';

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

export function toIssuePath(
  path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment> | undefined,
): Array<string | number> {
  return (path ?? []).map((segment) => {
    const key = typeof segment === 'object' && segment !== null ? segment.key : segment;
    return typeof key === 'number' ? key : String(key);
  });
}

/** Drop keys that only make sense at a document root (`$schema`). */
export function stripSchemaRoot(schema: JSONSchema): JSONSchema {
  if (!('$schema' in schema)) return schema;
  const rest = { ...schema };
  delete rest.$schema;
  return rest;
}

/**
 * The built-in default adapter. Uses the Standard Schema `~standard` hooks, so any
 * compliant library (Zod 4, Valibot, ArkType, ...) works without the package importing it.
 */
export const standardSchemaAdapter: SchemaAdapter<StandardSchemaV1> = {
  name: 'standard-schema',

  isSchema(value: unknown): value is StandardSchemaV1 {
    return (
      (typeof value === 'object' || typeof value === 'function') &&
      value !== null &&
      typeof (value as Partial<StandardSchemaV1>)['~standard']?.validate === 'function'
    );
  },

  validate(schema, input): SchemaValidationResult {
    const props = schema['~standard'];
    const result = props.validate(input);
    if (isThenable(result)) {
      result.then(undefined, () => undefined);
      throw new ApiDocsSchemaError(
        'EAD_ASYNC_SCHEMA',
        `A "${props.vendor}" schema validated asynchronously. Request and response schemas ` +
          'must validate synchronously (remove async refinements/transforms).',
      );
    }
    if (result.issues) {
      const issues: SchemaIssue[] = result.issues.map((issue) => ({
        path: toIssuePath(issue.path),
        message: issue.message,
      }));
      return { ok: false, issues };
    }
    return { ok: true, data: result.value };
  },

  toJSONSchema(schema, io, ctx): JSONSchema {
    const props = schema['~standard'];
    try {
      const converter = props.jsonSchema?.[io];
      if (typeof converter === 'function') return stripSchemaRoot(converter({ target: TARGET }));
    } catch {
      // fall through to the lossy default below
    }
    ctx?.warn(
      `A "${props.vendor}" schema has no usable Standard JSON Schema converter; it is ` +
        'documented as {} (any). Pass a library-specific adapter for accurate docs.',
      { code: 'EAD_SCHEMA_NO_JSONSCHEMA', vendor: props.vendor },
    );
    return {};
  },
};
