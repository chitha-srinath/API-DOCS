import type { Infer, JSONSchema, SchemaAdapter, SchemaIO, ValidationResult } from '../../src/adapter/types.js';

// ADR-38 fixture: a non-Zod, non-Standard-Schema adapter over plain descriptors, used by
// S-04 and S-06 to prove the duck-typed adapter resolution and spec generation are
// adapter-agnostic. Uses neither Zod nor the Standard Schema protocol.
export interface StrSchema {
  readonly kind: 'str';
  readonly __infer?: string;
}

export interface ObjSchema<P extends Record<string, StubSchema> = Record<string, StubSchema>> {
  readonly kind: 'obj';
  readonly props: P;
  readonly required?: readonly (keyof P & string)[];
  readonly __infer?: { [K in keyof P]: Infer<P[K]> };
}

export type StubSchema = StrSchema | ObjSchema;

export function str(): StrSchema {
  return { kind: 'str' };
}

export function obj<P extends Record<string, StubSchema>>(
  props: P,
  required?: readonly (keyof P & string)[],
): ObjSchema<P> {
  return { kind: 'obj', props, required };
}

function isStubSchema(x: unknown): x is StubSchema {
  if (!x || typeof x !== 'object') return false;
  const kind = (x as { kind?: unknown }).kind;
  return kind === 'str' || kind === 'obj';
}

function validateStub(schema: StubSchema, input: unknown, path: string): ValidationResult<unknown> {
  if (schema.kind === 'str') {
    if (typeof input === 'string') return { ok: true, data: input };
    return { ok: false, issues: [{ path, message: 'expected string' }] };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, issues: [{ path, message: 'expected object' }] };
  }

  const record = input as Record<string, unknown>;
  const issues: { path: string; message: string }[] = [];
  const data: Record<string, unknown> = {};

  for (const key of Object.keys(schema.props)) {
    const childPath = path ? `${path}.${key}` : key;
    const present = Object.prototype.hasOwnProperty.call(record, key);
    if (!present) {
      if (schema.required?.includes(key)) {
        issues.push({ path: childPath, message: 'required' });
      }
      continue;
    }
    const childSchema = schema.props[key];
    if (!childSchema) continue;
    const childResult = validateStub(childSchema, record[key], childPath);
    if (childResult.ok) {
      data[key] = childResult.data;
    } else {
      issues.push(...childResult.issues);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, data };
}

function toJson(schema: StubSchema): JSONSchema {
  if (schema.kind === 'str') return { type: 'string' };
  const properties: Record<string, JSONSchema> = {};
  for (const key of Object.keys(schema.props)) {
    const childSchema = schema.props[key];
    if (childSchema) properties[key] = toJson(childSchema);
  }
  const out: JSONSchema = { type: 'object', properties };
  if (schema.required && schema.required.length > 0) {
    out.required = [...schema.required];
  }
  return out;
}

export const stubAdapter: SchemaAdapter<StubSchema> = {
  name: 'stub',
  isSchema: isStubSchema,
  validate(schema, input): ValidationResult<unknown> {
    return validateStub(schema, input, '');
  },
  toJSONSchema(schema, _io: SchemaIO): JSONSchema {
    return toJson(schema);
  },
};
