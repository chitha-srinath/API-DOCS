// ST-007 (S-07), ADR-26: informational trend report, not a gate.
import { bench, describe } from 'vitest';
import express from 'express';
import request from 'supertest';

import { createApiDocs } from '../src/serve/router.js';

describe('bench: spec endpoint (cold cache)', () => {
  const app = express();
  const apiDocs = createApiDocs();
  app.use(apiDocs.router);
  const [validate, handler] = apiDocs.route('get', '/users/:id', {}, (req, res) => res.json({ ok: true }));
  app.get('/users/:id', validate, handler);

  bench('GET /openapi.json (invalidated each time)', async () => {
    apiDocs.invalidate();
    await request(app).get('/openapi.json');
  });
});
