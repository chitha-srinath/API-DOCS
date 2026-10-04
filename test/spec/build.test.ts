// ST-006 (S-06, component C6): buildSpec unit tests. Every spec-producing
// test validates via `@apidevtools/swagger-parser` (ADR-14).
import SwaggerParser from '@apidevtools/swagger-parser';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import type { ApiDocsOptions } from '../../src/config/types.js';
import type { DetectedOperation } from '../../src/core/types.js';
import { assignOperationIds } from '../../src/spec/naming.js';
import type { SpecOperation } from '../../src/spec/build.js';
import { buildSpec } from '../../src/spec/build.js';

async function validates(spec: unknown): Promise<void> {
  await expect(SwaggerParser.validate(structuredClone(spec) as never)).resolves.toBeDefined();
}

function op(partial: Partial<SpecOperation> & Pick<SpecOperation, 'method' | 'path' | 'source'>): SpecOperation {
  return { pathParams: [], ...partial };
}

describe('spec/build: buildSpec', () => {
  it('openapi version is 3.1.x and validates (AC-015)', async () => {
    const spec = buildSpec(
      [op({ method: 'get', path: '/a', source: 'plain' })],
      DEFAULT_OPTIONS as ApiDocsOptions,
      standardSchemaAdapter,
    );
    expect(spec.openapi as string).toMatch(/^3\.1\./);
    await validates(spec);
  });

  it('typed /users/:id emits params, query, requestBody, responses (AC-016)', async () => {
    const params = z.object({ id: z.string() });
    const query = z.object({ q: z.string() });
    const body = z.object({ a: z.string() });
    const response = z.object({ ok: z.boolean() });
    const ops: SpecOperation[] = [
      op({
        method: 'get',
        path: '/users/{id}',
        source: 'typed',
        pathParams: ['id'],
        meta: { params, query, body, response },
      }),
    ];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(paths)).toContain('/users/{id}');
    const getOp = paths['/users/{id}']?.get as Record<string, unknown>;
    const parameters = getOp.parameters as Array<Record<string, unknown>>;
    expect(parameters.find((p) => p.name === 'id')).toEqual({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
    expect(parameters.find((p) => p.name === 'q')?.in).toBe('query');
    const requestBody = getOp.requestBody as { content: Record<string, { schema: unknown }> };
    expect(requestBody.content['application/json']?.schema).toEqual(standardSchemaAdapter.toJSONSchema(body, 'input'));
    const responses = getOp.responses as Record<string, { content: Record<string, { schema: unknown }> }>;
    expect(responses['200']?.content['application/json']?.schema).toEqual(
      standardSchemaAdapter.toJSONSchema(response, 'output'),
    );
    await validates(spec);
  });

  it('securitySchemes bearer, apiKey, oauth2 present; route references one (AC-017)', async () => {
    const config: ApiDocsOptions = {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer' },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
        oauth2: { type: 'oauth2', flows: {} },
      },
    };
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/secure', source: 'typed', meta: { security: [{ apiKey: [] }] } }),
    ];
    const spec = buildSpec(ops, config, standardSchemaAdapter);
    const schemes = (spec.components as Record<string, unknown>).securitySchemes as Record<string, unknown>;
    expect(Object.keys(schemes).sort()).toEqual(['apiKey', 'bearer', 'oauth2']);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(paths['/secure']?.get?.security).toEqual([{ apiKey: [] }]);
    await validates(spec);
  });

  it('global security inherited; route security [] kept empty (AC-039)', async () => {
    const config: ApiDocsOptions = {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
      security: [{ bearer: [] }],
    };
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/inherits', source: 'plain' }),
      op({ method: 'get', path: '/open', source: 'plain', meta: { security: [] } }),
    ];
    const spec = buildSpec(ops, config, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(paths['/inherits']?.get?.security).toEqual([{ bearer: [] }]);
    expect(paths['/open']?.get?.security).toEqual([]);
    await validates(spec);
  });

  it('typed route with a request schema gets auto-400; none without one (AC-011)', async () => {
    const ops: SpecOperation[] = [
      op({ method: 'post', path: '/with', source: 'typed', meta: { body: z.object({ a: z.string() }) } }),
      op({ method: 'get', path: '/without', source: 'typed', meta: {} }),
    ];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    const withResponses = paths['/with']?.post?.responses as Record<
      string,
      { content: Record<string, { schema: unknown }> }
    >;
    expect(withResponses['400']?.content['application/problem+json']?.schema).toEqual({
      $ref: '#/components/schemas/ProblemDetails',
    });
    expect((spec.components as Record<string, unknown>).schemas as Record<string, unknown>).toHaveProperty(
      'ProblemDetails',
    );
    const withoutResponses = paths['/without']?.get?.responses as Record<string, unknown>;
    expect(withoutResponses['400']).toBeUndefined();
    await validates(spec);
  });

  it('info, servers, tags overrides applied exactly (AC-038); ADR-08 default with none', async () => {
    const config: ApiDocsOptions = {
      openapi: {
        info: { title: 'My API', version: '1.2.3', description: 'desc' },
        servers: [{ url: 'https://example.com' }],
        tags: [{ name: 'things' }],
      },
    };
    const ops: SpecOperation[] = [op({ method: 'get', path: '/a', source: 'plain' })];
    const spec = buildSpec(ops, config, standardSchemaAdapter);
    expect(spec.info).toEqual({ title: 'My API', version: '1.2.3', description: 'desc' });
    expect(spec.servers).toEqual([{ url: 'https://example.com' }]);
    expect(spec.tags).toEqual([{ name: 'things' }]);
    await validates(spec);

    const defaultSpec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    expect(defaultSpec.info).toEqual({ title: 'API', version: '0.0.0' });
  });

  it('include /api/** plus detectedDefaultResponse (AC-041)', async () => {
    const config: ApiDocsOptions = {
      autoDetect: { include: ['/api/**'] },
      detectedDefaultResponse: { status: 204, description: 'No Content' },
    };
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/api/a', source: 'plain' }),
      op({ method: 'get', path: '/other', source: 'plain' }),
    ];
    const spec = buildSpec(ops, config, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(paths)).toEqual(['/api/a']);
    expect(paths['/api/a']?.get?.responses).toEqual({ '204': { description: 'No Content' } });
    await validates(spec);
  });

  it('default naming: GET /users/:id -> getUsersById, tag users (AC-042)', () => {
    const ops: SpecOperation[] = [op({ method: 'get', path: '/users/{id}', source: 'plain', pathParams: ['id'] })];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(paths['/users/{id}']?.get?.operationId).toBe('getUsersById');
    expect(paths['/users/{id}']?.get?.tags).toEqual(['users']);
  });

  it('custom operationIdStrategy/tagStrategy used when no explicit values; explicit values win (AC-042)', () => {
    const config: ApiDocsOptions = {
      operationIdStrategy: ({ method, path }) => `custom_${method}_${path}`,
      tagStrategy: () => ['customTag'],
    };
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/a', source: 'plain' }),
      op({ method: 'get', path: '/b', source: 'plain', meta: { operationId: 'explicitId', tags: ['explicitTag'] } }),
    ];
    const spec = buildSpec(ops, config, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(paths['/a']?.get?.operationId).toBe('custom_get_/a');
    expect(paths['/a']?.get?.tags).toEqual(['customTag']);
    expect(paths['/b']?.get?.operationId).toBe('explicitId');
    expect(paths['/b']?.get?.tags).toEqual(['explicitTag']);
  });

  it('A-3 collision suffixes follow RegistryEntry.id, not array position (AC-034)', () => {
    const entries = [
      { id: 5, base: 'getThing' },
      { id: 2, base: 'getThing' },
      { id: 9, base: 'getThing' },
    ];
    const forward = assignOperationIds(entries);
    const reversed = assignOperationIds([...entries].reverse());
    for (const entry of entries) {
      expect(reversed.get(entry.id)).toBe(forward.get(entry.id));
    }
    // id order (2, 5, 9): the base name, then numbered suffixes.
    expect(forward.get(2)).toBe('getThing');
    expect(forward.get(5)).toBe('getThing2');
    expect(forward.get(9)).toBe('getThing3');
  });

  it('registry consumed only via RouteRegistry.entries(); unmatched entries emitted at localPath (ADR-17)', async () => {
    const { specOperationsFromRegistry } = await import('../../src/spec/build.js');
    let calls = 0;
    const registry = {
      register: () => {
        throw new Error('unused');
      },
      entries: () => {
        calls += 1;
        return [
          {
            id: 1,
            method: 'get' as const,
            localPath: '/never/walked',
            source: 'describe' as const,
            meta: {},
            handlerFn: (): void => {},
          },
        ];
      },
      findByHandle: () => undefined,
    };
    const ops = specOperationsFromRegistry(registry);
    expect(calls).toBe(1);
    expect(ops).toEqual([
      { id: 1, method: 'get', path: '/never/walked', pathParams: [], source: 'describe', meta: {} },
    ]);
  });

  it('dedupe: typed beats plain, describe beats plain (AC-031)', () => {
    const ops: SpecOperation[] = [
      op({ id: 1, method: 'get', path: '/dup1', source: 'plain' }),
      op({ id: 2, method: 'get', path: '/dup1', source: 'typed', meta: { summary: 'typed wins' } }),
      op({ id: 3, method: 'get', path: '/dup2', source: 'plain' }),
      op({ id: 4, method: 'get', path: '/dup2', source: 'describe', meta: { summary: 'describe wins' } }),
    ];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(paths['/dup1'] ?? {})).toEqual(['get']);
    expect(paths['/dup1']?.get?.summary).toBe('typed wins');
    expect(paths['/dup2']?.get?.summary).toBe('describe wins');
  });

  it('self-excludes specPath (default and custom) (AC-033)', () => {
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/openapi.json', source: 'plain' }),
      op({ method: 'get', path: '/kept', source: 'plain' }),
    ];
    const spec = buildSpec(ops, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const paths = spec.paths as Record<string, unknown>;
    expect(paths['/openapi.json']).toBeUndefined();
    expect(paths['/kept']).toBeDefined();

    const custom: ApiDocsOptions = { specPath: '/custom-spec' };
    const ops2: SpecOperation[] = [
      op({ method: 'get', path: '/custom-spec', source: 'plain' }),
      op({ method: 'get', path: '/kept2', source: 'plain' }),
    ];
    const spec2 = buildSpec(ops2, custom, standardSchemaAdapter);
    const paths2 = spec2.paths as Record<string, unknown>;
    expect(paths2['/custom-spec']).toBeUndefined();
    expect(paths2['/kept2']).toBeDefined();
  });

  it('autoDetect false: no plain op; exclude /internal/**; typed ops unaffected (AC-030)', () => {
    const ops: SpecOperation[] = [
      op({ method: 'get', path: '/plain', source: 'plain' }),
      op({ method: 'get', path: '/typed', source: 'typed' }),
    ];
    const off = buildSpec(ops, { autoDetect: false }, standardSchemaAdapter);
    const offPaths = off.paths as Record<string, unknown>;
    expect(offPaths['/plain']).toBeUndefined();
    expect(offPaths['/typed']).toBeDefined();

    const withExclude: SpecOperation[] = [
      op({ method: 'get', path: '/internal/a', source: 'plain' }),
      op({ method: 'get', path: '/public', source: 'plain' }),
      op({ method: 'get', path: '/typed', source: 'typed' }),
    ];
    const excluded = buildSpec(withExclude, { autoDetect: { exclude: ['/internal/**'] } }, standardSchemaAdapter);
    const excludedPaths = excluded.paths as Record<string, unknown>;
    expect(excludedPaths['/internal/a']).toBeUndefined();
    expect(excludedPaths['/public']).toBeDefined();
    expect(excludedPaths['/typed']).toBeDefined();
  });

  it('purity: src/spec/*.ts sources contain no express, zod or registry/registry import', () => {
    const dir = fileURLToPath(new URL('../../src/spec/', import.meta.url));
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(new URL(file, `file://${dir.replace(/\\/g, '/')}/`), 'utf8');
      expect(source).not.toMatch(/from ['"]express['"]/);
      expect(source).not.toMatch(/from ['"]zod['"]/);
      expect(source).not.toMatch(/registry\/registry\.js/);
    }
  });

  it('operates on hand-built DetectedOperation[] input directly', () => {
    const detected: DetectedOperation[] = [{ method: 'get', path: '/x', pathParams: [], source: 'plain' }];
    const spec = buildSpec(detected, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    expect((spec.paths as Record<string, unknown>)['/x']).toBeDefined();
  });
});
