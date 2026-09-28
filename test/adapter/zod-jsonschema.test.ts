import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodAdapter } from '../../src/adapter/zod.js';

describe('zodAdapter toJSONSchema (AC-016, R-7)', () => {
  it('produces a draft 2020-12 object schema with required fields', () => {
    const schema = z.object({ id: z.string() });
    const jsonSchema = zodAdapter.toJSONSchema(schema, 'input') as {
      $schema?: string;
      type?: string;
      required?: string[];
    };
    expect(jsonSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.required).toEqual(['id']);
  });

  it('makes a defaulted field optional in input and required in output', () => {
    const schema = z.object({ name: z.string().default('x') });
    const input = zodAdapter.toJSONSchema(schema, 'input') as { required?: string[] };
    const output = zodAdapter.toJSONSchema(schema, 'output') as { required?: string[] };
    expect(input.required ?? []).not.toContain('name');
    expect(output.required ?? []).toContain('name');
  });

  it('renders transforms and custom types as {} (unrepresentable: any) without throwing', () => {
    const schema = z.object({ weird: z.custom<unknown>() });
    expect(() => zodAdapter.toJSONSchema(schema, 'input')).not.toThrow();
    const jsonSchema = zodAdapter.toJSONSchema(schema, 'input') as { properties?: Record<string, unknown> };
    expect(jsonSchema.properties?.weird).toEqual({});
  });
});
