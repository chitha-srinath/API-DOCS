import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { standardSchemaAdapter } from '../../src/adapter/standard.js';

describe('standardSchemaAdapter (ADR-21, AC-035)', () => {
  it('validates via ~standard.validate, coercing through zod', () => {
    const schema = z.object({ id: z.coerce.number() });
    const result = standardSchemaAdapter.validate(schema, { id: '3' });
    expect(result).toEqual({ ok: true, data: { id: 3 } });
  });

  it('converts to draft 2020-12 JSON Schema with required fields', () => {
    const schema = z.object({ id: z.string() });
    const jsonSchema = standardSchemaAdapter.toJSONSchema(schema, 'input') as {
      $schema?: string;
      required?: string[];
    };
    expect(jsonSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(jsonSchema.required).toEqual(['id']);
  });

  it('differs between input and output for a defaulted field', () => {
    const schema = z.object({ name: z.string().default('x') });
    const input = standardSchemaAdapter.toJSONSchema(schema, 'input') as { required?: string[] };
    const output = standardSchemaAdapter.toJSONSchema(schema, 'output') as { required?: string[] };
    expect(input.required ?? []).not.toEqual(output.required ?? []);
  });

  it('has no zod import in standard.ts, standard-types.ts or errors.ts', () => {
    for (const file of ['standard.ts', 'standard-types.ts', 'errors.ts']) {
      const filePath = fileURLToPath(new URL(`../../src/adapter/${file}`, import.meta.url));
      const source = readFileSync(filePath, 'utf8');
      expect(source).not.toMatch(/from ['"]zod['"]/);
      expect(source).not.toMatch(/require\(['"]zod['"]\)/);
    }
  });
});
