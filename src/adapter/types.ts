import type { LogDetails } from '../core/types.js';
import type { StandardSchemaV1 } from './standard-types.js';

export type JSONSchema = Record<string, unknown>;

export interface SchemaIssue {
  /** Path segments inside the validated value. */
  path: ReadonlyArray<string | number>;
  message: string;
}

export type SchemaValidationResult<T = unknown> =
  { ok: true; data: T } | { ok: false; issues: SchemaIssue[] };

/** Optional context passed to `toJSONSchema`, e.g. to report a lossy conversion. */
export interface SchemaContext {
  warn(message: string, details: LogDetails): void;
}

/**
 * The port between the package and a schema library. Implement it to use any
 * validation library; core code never depends on a specific one.
 */
export interface SchemaAdapter<S = unknown> {
  readonly name: string;
  isSchema(value: unknown): value is S;
  /** Synchronously validate (and coerce/transform) `input`. */
  validate(schema: S, input: unknown): SchemaValidationResult;
  /** JSON Schema (draft 2020-12) for the schema's input or output side. */
  toJSONSchema(schema: S, io: 'input' | 'output', ctx?: SchemaContext): JSONSchema;
}

/**
 * Type-level inference hook: the parsed (output) type of a schema. Works for any
 * Standard Schema (Zod 4, Valibot, ArkType, ...) and for schemas exposing `_output`.
 */
export type Infer<S> = S extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<S>
  : S extends { readonly _output: infer O }
    ? O
    : unknown;
