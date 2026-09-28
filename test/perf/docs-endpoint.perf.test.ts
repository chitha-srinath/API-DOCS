import { describe, it } from 'vitest';
import express from 'express';

import { createApiDocs } from '../../src/serve/router.js';
import { assertPerfBudget } from './harness.js';

describe('perf: docs endpoint', () => {
  it('p95 < 200ms', async () => {
    const app = express();
    const apiDocs = createApiDocs();
    app.use(apiDocs.router);
    await assertPerfBudget(app, (agent) => agent.get('/docs'), 'docs-endpoint');
  });
});
