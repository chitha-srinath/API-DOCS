// ST-006 (S-06), ADR-32: spec-side half of AC-023. For each `majors` entry,
// walk the nested fixture from `test/fixtures/apps.ts` then run `buildSpec`.
import * as OpenApiParser from '@readme/openapi-parser';
import { describe, expect, it } from 'vitest';

import { standardSchemaAdapter } from '../../src/adapter/standard.js';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import type { ApiDocsOptions } from '../../src/config/types.js';
import { installRecorder, introspect } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { buildSpec } from '../../src/spec/build.js';
import { makeApp } from '../fixtures/apps.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('spec/ac023 ($alias)', ({ major, express }) => {
  it('walks the mounted /api router and emits exactly one get and one post at /api/users/{id}', async () => {
    installRecorder(express);
    const registry = createRegistry();
    const app = makeApp({ major, express });
    const detected = introspect(app, registry, makeLoggerSpy());

    const spec = buildSpec(detected, DEFAULT_OPTIONS as ApiDocsOptions, standardSchemaAdapter);
    const paths = spec.paths as Record<string, Record<string, Record<string, unknown>>>;

    expect(Object.keys(paths)).toContain('/api/users/{id}');
    const usersPath = paths['/api/users/{id}'] as Record<string, Record<string, unknown>>;
    expect(Object.keys(usersPath).sort()).toEqual(['get', 'post']);

    for (const method of ['get', 'post'] as const) {
      const operation = usersPath[method] as Record<string, unknown>;
      expect(typeof operation.operationId).toBe('string');
      expect((operation.operationId as string).length).toBeGreaterThan(0);
      const parameters = operation.parameters as Array<Record<string, unknown>>;
      expect(parameters).toContainEqual({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
      expect(operation.responses as Record<string, unknown>).toHaveProperty('200');
      expect(operation.tags).toEqual(['api']);
    }

    await expect(OpenApiParser.validate(structuredClone(spec) as never)).resolves.toBeDefined();
  });
});
