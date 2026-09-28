import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { memoizeAdapter } from '../../src/adapter/memo.js';
import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import type { SchemaAdapter } from '../../src/adapter/types.js';
import { zodAdapter } from '../../src/adapter/zod.js';
import { obj, str, stubAdapter, type StubSchema } from '../fixtures/stub-adapter.js';

const nestedZod = z.object({ user: z.object({ name: z.string() }) });
const nestedStub = obj({ user: obj({ name: str() }, ['name']) }, ['user']);

interface Case<S> {
  name: string;
  adapter: SchemaAdapter<S>;
  schema: S;
  validInput: unknown;
  invalidInput: unknown;
  nestedSchema: S;
  nestedInvalidInput: unknown;
}

const cases: Case<unknown>[] = [
  {
    name: 'standard (zod-backed)',
    adapter: standardSchemaAdapter as SchemaAdapter<unknown>,
    schema: z.object({ id: z.string() }),
    validInput: { id: 'x' },
    invalidInput: { id: 1 },
    nestedSchema: nestedZod,
    nestedInvalidInput: { user: { name: 1 } },
  },
  {
    name: 'zod',
    adapter: zodAdapter as SchemaAdapter<unknown>,
    schema: z.object({ id: z.string() }),
    validInput: { id: 'x' },
    invalidInput: { id: 1 },
    nestedSchema: nestedZod,
    nestedInvalidInput: { user: { name: 1 } },
  },
  {
    name: 'stub',
    adapter: stubAdapter as SchemaAdapter<unknown>,
    schema: obj({ id: str() }, ['id']),
    validInput: { id: 'x' },
    invalidInput: { id: 1 },
    nestedSchema: nestedStub,
    nestedInvalidInput: { user: { name: 1 } },
  },
  {
    name: 'memoized stub',
    adapter: memoizeAdapter(stubAdapter) as SchemaAdapter<unknown>,
    schema: obj({ id: str() }, ['id']),
    validInput: { id: 'x' },
    invalidInput: { id: 1 },
    nestedSchema: nestedStub,
    nestedInvalidInput: { user: { name: 1 } },
  },
];

describe.each(cases)(
  '$name adapter contract',
  ({ adapter, schema, validInput, invalidInput, nestedSchema, nestedInvalidInput }) => {
    it('isSchema is true for its own schema and false for non-schemas', () => {
      expect(adapter.isSchema(schema)).toBe(true);
      expect(adapter.isSchema({})).toBe(false);
      expect(adapter.isSchema(null)).toBe(false);
      expect(adapter.isSchema(42)).toBe(false);
      expect(adapter.isSchema('a foreign schema string')).toBe(false);
    });

    it('valid input yields ok:true with data', () => {
      const result = adapter.validate(schema, validInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(validInput);
      }
    });

    it('invalid input yields ok:false with non-empty issues', () => {
      const result = adapter.validate(schema, invalidInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.length).toBeGreaterThan(0);
        for (const issue of result.issues) {
          expect(typeof issue.path).toBe('string');
          expect(typeof issue.message).toBe('string');
        }
      }
    });

    it('nested invalid input produces a dotted path of user.name', () => {
      const result = adapter.validate(nestedSchema, nestedInvalidInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === 'user.name')).toBe(true);
      }
    });

    it('toJSONSchema returns plain objects for input and output', () => {
      const input = adapter.toJSONSchema(schema, 'input');
      const output = adapter.toJSONSchema(schema, 'output');
      expect(typeof input).toBe('object');
      expect(typeof output).toBe('object');
    });
  },
);

describe('stub-adapter fixture', () => {
  it('passes the ADR-38 duck-type check', () => {
    expect(typeof stubAdapter.isSchema).toBe('function');
    expect(typeof stubAdapter.validate).toBe('function');
    expect(typeof stubAdapter.toJSONSchema).toBe('function');
  });

  it('has no zod or ~standard in its source', () => {
    const filePath = fileURLToPath(new URL('../fixtures/stub-adapter.ts', import.meta.url));
    const source = readFileSync(filePath, 'utf8');
    expect(source.includes('zod')).toBe(false);
    expect(source.includes('~standard')).toBe(false);
  });

  it('exports a schema type usable outside this file', () => {
    const schema: StubSchema = str();
    expect(stubAdapter.isSchema(schema)).toBe(true);
  });
});

describe('adapter/types.ts', () => {
  it('carries the ADR-53 remarks line', () => {
    const filePath = fileURLToPath(new URL('../../src/adapter/types.ts', import.meta.url));
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain('@remarks AC-047 "parse" = validate, "toJsonSchema" = toJSONSchema');
  });
});
