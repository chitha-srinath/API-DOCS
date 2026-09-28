import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { standardSchemaAdapter } from '../../src/adapter/standard.js';

// ADR-47/AC-004: this must pass both on the devDependency zod and in the S-01
// peer-floor CI job, which installs zod@4.2.0 (the first release with ~standard.jsonSchema).
describe('standardSchemaAdapter zod floor (ADR-47, AC-004)', () => {
  it('produces non-empty properties for a Zod object', () => {
    const schema = z.object({ id: z.string() });
    const jsonSchema = standardSchemaAdapter.toJSONSchema(schema, 'input') as {
      properties?: Record<string, unknown>;
    };
    expect(jsonSchema.properties).toBeTruthy();
    expect(jsonSchema.properties).toHaveProperty('id');
  });
});
