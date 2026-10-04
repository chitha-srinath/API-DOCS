// ST-007 QA Fix Loop Iteration 1 — F-04 (HIGH): the composition root's resolved adapter
// must be wrapped in `memoizeAdapter` (ADR-03) before use, so `toJSONSchema` is computed
// once per schema identity even across repeated `getSpec()` rebuilds (no `ctx.app`, which
// bypasses the document-level `spec/cache.ts`).
import { describe, expect, it } from 'vitest';

import { createApiDocs } from '../../src/serve/router.js';
import { obj, str, stubAdapter } from '../../test/fixtures/stub-adapter.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('serve/adapter-memo ($alias)', ({ express }) => {
  it('memoizes toJSONSchema across multiple getSpec() rebuilds for the same schema', () => {
    const ex = express as unknown as () => import('express').Application;
    const app = ex();

    let toJsonSchemaCalls = 0;
    const spyAdapter = {
      ...stubAdapter,
      toJSONSchema(
        schema: Parameters<typeof stubAdapter.toJSONSchema>[0],
        io: Parameters<typeof stubAdapter.toJSONSchema>[1],
      ) {
        toJsonSchemaCalls += 1;
        return stubAdapter.toJSONSchema(schema, io);
      },
    };

    const apiDocs = createApiDocs({ schemaAdapter: spyAdapter });
    const bodySchema = obj({ name: str() }, ['name']);
    const [validate, handler] = apiDocs.route('post', '/things', { body: bodySchema }, (_req, res) => {
      res.json({ ok: true });
    });
    app.post('/things', validate, handler);

    // getSpec() with no ctx.app skips the document-level spec cache (src/spec/cache.ts)
    // entirely and rebuilds the document from the registry every call — so any repeated
    // `toJSONSchema` invocation for the *same* schema object across these calls can only be
    // avoided by adapter-level memoization (ADR-03 `memoizeAdapter`), not the spec cache.
    apiDocs.getSpec();
    apiDocs.getSpec();
    apiDocs.getSpec();

    expect(toJsonSchemaCalls).toBe(1);
  });
});
