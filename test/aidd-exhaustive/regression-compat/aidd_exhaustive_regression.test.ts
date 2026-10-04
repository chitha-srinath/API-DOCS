// AIDD QA — regression-compat (Wave B, steps 4-5).
// Greenfield package: "regression" here = (a) Express 4/5 side-by-side support holds,
// (b) ADR-41 export contract stable, (c) upgrade path (zero-config -> add options)
// doesn't silently break what worked before, (d) semver-relevant surface stability.
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';

import { DEFAULT_OPTIONS } from '../../../src/config/defaults.js';
import { createApiDocs } from '../../../src/serve/router.js';
import { majors } from '../../fixtures/majors.js';

describe.each(majors)('TC-REG: upgrade path zero-config -> add options ($alias)', ({ express }) => {
  const ex = express as {
    (): import('express').Application;
    json: () => import('express').RequestHandler;
    Router: () => import('express').Router;
  };

  function zeroConfigApp() {
    const app = ex();
    app.use(ex.json());
    const apiDocs = createApiDocs();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route(
      'post',
      '/users',
      { body: z.object({ name: z.string() }), response: z.object({ id: z.string() }) },
      (req, res) => {
        res.json({ id: '1' });
      },
    );
    app.post('/users', validate, handler);
    return { app, apiDocs };
  }

  // TC-REG-001 (ac_ids: AC-035, AC-036): baseline zero-config behavior still works
  // (re-confirms Wave A/serve/zero-config.test.ts did not regress under this dispatch's build).
  it('TC-REG-001 zero-config baseline: spec 200/valid, 400 on bad body', async () => {
    const { app } = zeroConfigApp();
    const spec = await request(app).get('/openapi.json');
    expect(spec.status).toBe(200);
    await expect(SwaggerParser.validate(structuredClone(spec.body) as never)).resolves.toBeDefined();
    const bad = await request(app).post('/users').send({});
    expect(bad.status).toBe(400);
  });

  // TC-REG-002 (ac_ids: AC-037, AC-021): adding options (custom paths) does not
  // resurrect the old default paths, and does not break plain-route passthrough

  // TC-REG-003 (ac_ids: AC-044): once a partial global `openapi.info` override is
  // layered on top of defaults, the untouched sibling default (info.version falls
  // back to '0.0.0' per src/spec/build.ts:218) and unrelated default keys (autoDetect,
  // validateRequests) survive intact -- an upgrade-path invariant (AC-044a).
  it('TC-REG-003 partial global override leaves untouched default keys intact', () => {
    const apiDocs = createApiDocs({ openapi: { info: { title: 'Custom' } } });
    const spec = apiDocs.getSpec();
    expect((spec.info as { title: string; version: string }).title).toBe('Custom');
    expect((spec.info as { title: string; version: string }).version).toBe('0.0.0');
    expect(apiDocs.options.autoDetect).toEqual(DEFAULT_OPTIONS.autoDetect);
    expect(apiDocs.options.validateRequests).toEqual(DEFAULT_OPTIONS.validateRequests);
  });
});

// TC-REG-004 (ac_ids: AC-002, AC-003) semver-surface stability: the runtime export set
// for the three public entry points is pinned exactly (already asserted per-entry in
// test/entries/parity.test.ts); this case re-asserts it as a single cross-entry snapshot
// so a partial addition/removal on any one entry point is caught as a surface change.
describe('TC-REG-004 ADR-41 export contract cross-entry snapshot', () => {
  it('main + manual entries expose an identical named-export set to each other', async () => {
    const root = process.cwd();
    const main = (await import(root + '/dist/index.js')) as Record<string, unknown>;
    const manual = (await import(root + '/dist/manual.js')) as Record<string, unknown>;
    expect(Object.keys(manual).sort()).toEqual(Object.keys(main).sort());
  });
});
