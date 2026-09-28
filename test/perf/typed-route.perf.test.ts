import { describe, it } from 'vitest';
import express from 'express';
import { z } from 'zod';

import { createApiDocs } from '../../src/serve/router.js';
import { assertPerfBudget } from './harness.js';

describe('perf: typed route request validation', () => {
  it('p95 < 200ms', async () => {
    const app = express();
    app.use(express.json());
    const apiDocs = createApiDocs();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route('post', '/users', { body: z.object({ name: z.string() }) }, (req, res) =>
      res.json({ ok: true }),
    );
    app.post('/users', validate, handler);
    await assertPerfBudget(app, (agent) => agent.post('/users').send({ name: 'x' }), 'typed-route');
  });
});
