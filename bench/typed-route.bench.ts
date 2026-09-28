// ST-007 (S-07), ADR-26: informational trend report, not a gate.
import { bench, describe } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApiDocs } from '../src/serve/router.js';

describe('bench: typed route validation', () => {
  const app = express();
  app.use(express.json());
  const apiDocs = createApiDocs();
  app.use(apiDocs.router);
  const [validate, handler] = apiDocs.route('post', '/users', { body: z.object({ name: z.string() }) }, (req, res) =>
    res.json({ ok: true }),
  );
  app.post('/users', validate, handler);

  bench('POST /users', async () => {
    await request(app).post('/users').send({ name: 'x' });
  });
});
