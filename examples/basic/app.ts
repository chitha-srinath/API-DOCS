// examples/basic — the runnable example referenced by README's Quick start
// section and covered by test/docs/example-smoke.test.ts (AC-029).
//
// ADR-18: express-api-docs must be imported before any router is created or
// mounted, so its recorder can patch Express's Router/Layer prototypes before
// the app's own routes exist.
import { createApiDocs } from 'express-api-docs';

import express from 'express';
import { z } from 'zod';

export function createApp() {
  const app = express();
  app.use(express.json());

  const apiDocs = createApiDocs({
    openapi: {
      info: { title: 'Basic Example API', version: '1.0.0' },
    },
  });

  const { route } = apiDocs;

  app.get('/health', apiDocs.describe('get', '/health', { summary: 'Liveness probe' }), (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post(
    '/widgets',
    ...route(
      'post',
      '/widgets',
      {
        summary: 'Create a widget',
        body: z.object({ name: z.string().min(1) }),
        response: z.object({ id: z.string(), name: z.string() }),
      },
      (req, res) => {
        res.status(201).json({ id: '1', name: req.body.name });
      },
    ),
  );

  // A plain Express route with no typed helper and no describe() call, to
  // demonstrate zero-config route auto-detection (ADR-?): the recorder picks
  // this up on its own because express-api-docs was imported before any
  // router was created.
  app.get('/widgets-plain', (_req, res) => {
    res.json([]);
  });

  app.use(apiDocs.router);

  return app;
}
