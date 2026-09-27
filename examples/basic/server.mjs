// A runnable example: `npm run build && npm run example`, then open http://localhost:3000/docs
// Import express-api-docs before creating routers so mount paths are recorded.
import { createApiDocs } from 'express-api-docs';
import { zodAdapter } from 'express-api-docs/zod';
import express from 'express';
import { z } from 'zod';

export function createApp() {
  const api = createApiDocs({
    adapter: zodAdapter,
    openapi: { info: { title: 'Users API', version: '1.0.0' } },
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
    validateResponses: 'warn',
  });

  const app = express();
  app.use(express.json());
  app.use(api.router); // GET /openapi.json and GET /docs

  const User = z.object({ id: z.number().int(), name: z.string() });
  const users = new Map([[1, { id: 1, name: 'Ada' }]]);

  const router = express.Router();

  router.get(
    '/users/:id',
    ...api.route(
      {
        summary: 'Get a user',
        params: z.object({ id: z.coerce.number().int() }),
        responses: { 200: User, 404: { description: 'Not found' } },
      },
      (req, res) => {
        const user = users.get(req.params.id);
        if (!user) return res.status(404).end();
        res.json(user);
      },
    ),
  );

  router.post(
    '/users',
    ...api.route(
      {
        summary: 'Create a user',
        security: [{ bearer: [] }],
        body: z.object({ name: z.string().min(1) }),
        responses: { 201: User },
      },
      (req, res) => {
        const user = { id: users.size + 1, name: req.body.name };
        users.set(user.id, user);
        res.status(201).json(user);
      },
    ),
  );

  // A plain route: documented automatically, never validated.
  router.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', router);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createApp().listen(port, () => {
    const { port: actual } = server.address();
    console.log(`listening on http://localhost:${actual} (docs at /docs)`);
  });
}
