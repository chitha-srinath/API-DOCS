// ST-006 (S-06), ADR-38: the stub-adapter (non-Zod) proves spec generation is
// adapter-agnostic, and that a per-route `meta.adapter` beats the `adapter`
// parameter.
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';

import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import type { ApiDocsOptions } from '../../src/config/types.js';
import { buildSpec } from '../../src/spec/build.js';
import type { SpecOperation } from '../../src/spec/build.js';
import { obj, str, stubAdapter } from '../fixtures/stub-adapter.js';

async function validates(spec: unknown): Promise<void> {
  await expect(SwaggerParser.validate(structuredClone(spec) as never)).resolves.toBeDefined();
}

describe('spec/stub-adapter (ADR-38)', () => {
  it('the stub schema appears in requestBody with the global adapter (AC-005, AC-047)', async () => {
    const bodySchema = obj({ name: str() }, ['name']);
    const ops: SpecOperation[] = [
      { method: 'post', path: '/stub', pathParams: [], source: 'typed', meta: { body: bodySchema } },
    ];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, stubAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    const requestBody = paths['/stub']?.post?.requestBody as { content: Record<string, { schema: unknown }> };
    expect(requestBody.content['application/json']?.schema).toEqual(stubAdapter.toJSONSchema(bodySchema, 'input'));
    await validates(spec);
  });

  it('per-route meta.adapter overrides the adapter parameter (AC-047)', async () => {
    const bodySchema = obj({ name: str() }, ['name']);
    const ops: SpecOperation[] = [
      {
        method: 'post',
        path: '/stub-override',
        pathParams: [],
        source: 'typed',
        meta: { body: bodySchema, adapter: stubAdapter },
      },
    ];
    // buildSpec is invoked with standardSchemaAdapter as the fallback; this op's
    // meta.adapter (stubAdapter) must win.
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    const requestBody = paths['/stub-override']?.post?.requestBody as { content: Record<string, { schema: unknown }> };
    expect(requestBody.content['application/json']?.schema).toEqual(stubAdapter.toJSONSchema(bodySchema, 'input'));
    await validates(spec);
  });
});
