import { describe, it } from 'vitest';
import express from 'express';

import { createApiDocs } from '../../src/serve/router.js';
import { assertPerfBudget } from './harness.js';

describe('perf: spec endpoint (warm cache)', () => {
  it('p95 < 200ms', async () => {
    const app = express();
    const apiDocs = createApiDocs();
    app.use(apiDocs.router);
    const [validate, handler] = apiDocs.route('get', '/users/:id', {}, (req, res) => res.json({ ok: true }));
    app.get('/users/:id', validate, handler);
    await assertPerfBudget(app, (agent) => agent.get('/openapi.json'), 'spec-endpoint');
  });
});
