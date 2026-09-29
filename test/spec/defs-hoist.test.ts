// ST-006 QA Fix Loop iteration 1, F-01 (CRITICAL): a `.meta({id})`-tagged (named/reused)
// Zod schema, when converted via `toJSONSchema`, lifts the named subschema into a sibling
// `$defs` bag with a `$ref` in its place. `pathParameters`/`queryParameters` used to
// extract only `schema.properties[name]` and silently drop `$defs`, leaving a dangling,
// unresolvable `$ref` that fails `SwaggerParser.validate()`. Confirmed reachable via BOTH
// the default `standardSchemaAdapter` (ADR-21 zero-config default) and the opt-in
// `./zod` subpath adapter (`zodAdapter`) — both are exercised here.
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import { zodAdapter } from '../../src/adapter/zod.js';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import type { ApiDocsOptions } from '../../src/config/types.js';
import type { SpecOperation } from '../../src/spec/build.js';
import { buildSpec } from '../../src/spec/build.js';

async function validates(spec: unknown): Promise<void> {
  await expect(SwaggerParser.validate(structuredClone(spec) as never)).resolves.toBeDefined();
}

function op(partial: Partial<SpecOperation> & Pick<SpecOperation, 'method' | 'path' | 'source'>): SpecOperation {
  return { pathParams: [], ...partial };
}

describe('spec/build: $defs hoisting for named/reused schemas (F-01)', () => {
  it('default standardSchemaAdapter: params with a .meta({id})-tagged schema resolves and validates', async () => {
    const userId = z.string().meta({ id: 'UserId' });
    const params = z.object({ id: userId });
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/users/{id}', source: 'typed', pathParams: ['id'], meta: { params } }),
    ];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const components = spec.components as { schemas: Record<string, unknown> };
    // The hoisted def must actually land in components.schemas under its name.
    expect(components.schemas.UserId).toBeDefined();
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    const parameters = paths['/users/{id}']?.get?.parameters as Array<Record<string, unknown>>;
    const idParam = parameters.find((p) => p.name === 'id');
    // No dangling `#/$defs/...` ref should remain anywhere in the parameter schema.
    expect(JSON.stringify(idParam)).not.toContain('#/$defs/');
    await validates(spec); // would throw "Missing $ref pointer" before the fix
  });

  it('default standardSchemaAdapter: query with a .meta({id})-tagged schema resolves and validates', async () => {
    const status = z.enum(['a', 'b']).meta({ id: 'Status' });
    const query = z.object({ status });
    const ops: SpecOperation[] = [op({ method: 'get', path: '/items', source: 'typed', meta: { query } })];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const components = spec.components as { schemas: Record<string, unknown> };
    expect(components.schemas.Status).toBeDefined();
    await validates(spec);
  });

  it('opt-in zodAdapter subpath: params with a .meta({id})-tagged schema resolves and validates', async () => {
    const userId = z.string().meta({ id: 'UserIdZod' });
    const params = z.object({ id: userId });
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/z/{id}', source: 'typed', pathParams: ['id'], meta: { params } }),
    ];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, zodAdapter);
    const components = spec.components as { schemas: Record<string, unknown> };
    expect(components.schemas.UserIdZod).toBeDefined();
    await validates(spec); // would throw "Missing $ref pointer" before the fix
  });

  // F-22 (MEDIUM, found during the F-01 fix-loop closure re-check): a naive
  // first-writer-wins hoist silently drops a colliding def under the same
  // name, producing a spec that validates but is semantically wrong.
  it('the SAME named schema reused across two routes hoists once, no duplication, no error', () => {
    const status = z.enum(['a', 'b']).meta({ id: 'Shared' });
    const ops: SpecOperation[] = [
      op({
        method: 'get',
        path: '/a',
        source: 'typed',
        meta: { query: z.object({ status } as { status: typeof status }) },
      }),
      op({
        method: 'get',
        path: '/b',
        source: 'typed',
        meta: { query: z.object({ status } as { status: typeof status }) },
      }),
    ];
    expect(() => buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter)).not.toThrow();
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const components = spec.components as { schemas: Record<string, unknown> };
    expect(components.schemas.Shared).toBeDefined();
  });

  it('two DIFFERENT schemas sharing the same .meta({id}) name throw a clear error instead of silently colliding', () => {
    const collideString = z.string().meta({ id: 'Collide' });
    const collideNumber = z.number().meta({ id: 'Collide' });
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/a', source: 'typed', meta: { query: z.object({ id: collideString }) } }),
      op({ method: 'get', path: '/b', source: 'typed', meta: { query: z.object({ id: collideNumber }) } }),
    ];
    expect(() => buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter)).toThrow(/Collide/);
  });
});
