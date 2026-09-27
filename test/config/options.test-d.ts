import { describe, expectTypeOf, it } from 'vitest';
import type {
  ApiDocsOptions,
  OptionPath,
  ResolvedOptions,
  RouteOptions,
} from '../../src/config/types.js';
import { createApiDocs } from '../../src/serve/router.js';

describe('ApiDocsOptions types (AC-046)', () => {
  it('all options are optional', () => {
    const empty: ApiDocsOptions = {};
    expectTypeOf(empty).toEqualTypeOf<ApiDocsOptions>();
    expectTypeOf<Record<string, never>>().toMatchTypeOf<ApiDocsOptions>();
    expectTypeOf<Partial<ApiDocsOptions>>().toEqualTypeOf<ApiDocsOptions>();
  });

  it('rejects unknown keys and wrong types', () => {
    // @ts-expect-error unknown key
    createApiDocs({ specPth: '/x' });
    // @ts-expect-error invalid ui
    createApiDocs({ ui: 'redoc' });
    // @ts-expect-error invalid validateResponses
    createApiDocs({ validateResponses: 'maybe' });
    // @ts-expect-error invalid validateRequests
    createApiDocs({ validateRequests: 'yes' });
    // @ts-expect-error nested unknown key
    createApiDocs({ openapi: { infoo: {} } });
    // @ts-expect-error wrong nested type
    createApiDocs({ detectedDefaultResponse: { status: '204' } });
  });

  it('per-route options reject unknown keys and wrong types', () => {
    const api = createApiDocs();
    // @ts-expect-error invalid per-route validateResponses
    api.route({ validateResponses: 'maybe' }, () => undefined);
    // @ts-expect-error unknown per-route key
    api.route({ validateResponse: 'warn' }, () => undefined);
    const ok: RouteOptions = { validateResponses: 'error', tags: ['c'], security: [] };
    expectTypeOf(ok).toMatchTypeOf<RouteOptions>();
  });

  it('OptionPath lists leaf paths', () => {
    expectTypeOf<'openapi.info.title'>().toMatchTypeOf<OptionPath<ResolvedOptions>>();
    expectTypeOf<'autoDetect.include'>().toMatchTypeOf<OptionPath<ResolvedOptions>>();
    expectTypeOf<'securitySchemes'>().toMatchTypeOf<OptionPath<ResolvedOptions>>();
    // @ts-expect-error groups are not leaf paths
    const group: OptionPath<ResolvedOptions> = 'openapi';
    void group;
  });
});
