import type { StandardSchemaV1 } from './standard-types.js';

export type SchemaIO = 'input' | 'output';

export type JSONSchema = Record<string, unknown>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; issues: { path: string; message: string }[] };

/**
 * @remarks AC-047 "parse" = validate, "toJsonSchema" = toJSONSchema
 */
export interface SchemaAdapter<S> {
  readonly name: string;
  isSchema(x: unknown): x is S;
  validate(schema: S, input: unknown): ValidationResult<unknown>;
  toJSONSchema(schema: S, io: SchemaIO): JSONSchema;
}

/**
 * Type-level hook: infers the validated output type of a schema `S`. Works for any
 * Standard Schema V1-compliant schema (Zod v4 included) and for schemas that carry a
 * phantom `__infer` marker (e.g. the stub-adapter fixture).
 */
export type Infer<S> =
  S extends StandardSchemaV1<infer _I, infer O> ? O : S extends { readonly __infer?: infer O } ? O : unknown;
