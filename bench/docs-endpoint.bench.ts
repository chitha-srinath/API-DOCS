// ST-007 (S-07), ADR-26: informational trend report, not a gate.
import { bench, describe } from 'vitest';
import express from 'express';
import request from 'supertest';

import { createApiDocs } from '../src/serve/router.js';

describe('bench: docs endpoint', () => {
  const app = express();
  const apiDocs = createApiDocs();
  app.use(apiDocs.router);

  bench('GET /docs', async () => {
    await request(app).get('/docs');
  });
});
