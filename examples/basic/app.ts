// examples/basic — the runnable example referenced by README's Quick start
// section and covered by test/docs/example-smoke.test.ts (AC-029).
//
// ADR-18: express-api-contract must be imported before any router is created or
// mounted, so its recorder can patch Express's Router/Layer prototypes before
// the app's own routes exist.
import { createApiDocs } from 'express-api-contract';

import { STATUS_CODES } from 'node:http';

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

  // In-memory widgets so the GET examples return real data.
  const widgets = [
    { id: 1, name: 'Blue widget' },
    { id: 2, name: 'Red widget' },
    { id: 3, name: 'Green widget' },
  ];

  app.post(
    '/widgets',
    ...route(
      'post',
      '/widgets',
      {
        summary: 'Create a widget',
        body: z.object({
          name: z.string().min(1).max(80),
          description: z.string().max(500).optional(),
          price: z.number().min(0).max(10000).optional(),
          quantity: z.number().int().min(1).optional(),
          tags: z.array(z.string()).optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          sku: z.string().min(3).max(12).regex(/^[A-Z0-9-]+$/).optional(),
          externalId: z.uuid().optional(),
          releaseDate: z.iso.date().optional(),
          rating: z.number().min(0).max(5).optional(),
        }),
        response: z.object({ id: z.string(), name: z.string() }),
      },
      (req, res) => {
        res.status(201).json({ id: '1', name: req.body.name });
      },
    ),
  );

  // Every field type the docs form supports, in one body: formats, lengths, number ranges, enums and a textarea.
  app.post(
    '/events',
    ...route(
      'post',
      '/events',
      {
        summary: 'Create an event',
        tags: ['events'],
        body: z.object({
          id: z.uuid(),
          title: z.string().min(3).max(80),
          description: z.string().min(10).max(1000).optional(),
          startDate: z.iso.date(),
          startTime: z.iso.time().meta({ format: 'time' }),
          startsAt: z.iso.datetime().optional(),
          capacity: z.number().int().min(1).max(500),
          price: z.number().min(0).max(10000).optional(),
          contactEmail: z.email(),
          visibility: z.enum(['public', 'private', 'unlisted']),
          isOnline: z.boolean().optional(),
        }),
        response: z.object({ id: z.string(), title: z.string() }),
        responses: { 201: { description: 'Event created' } },
      },
      (req, res) => {
        res.status(201).json({ id: req.body.id, title: req.body.title });
      },
    ),
  );

  // Query parameters: a text search, a number limit and an enum sort.
  app.get(
    '/widgets',
    ...route(
      'get',
      '/widgets',
      {
        summary: 'List widgets',
        query: z.object({
          q: z.string().max(100).optional(),
          limit: z.coerce.number().int().min(1).max(50).optional(),
          sort: z.enum(['id', 'name']).optional(),
        }),
        response: z.array(z.object({ id: z.number(), name: z.string() })),
      },
      (req, res) => {
        const q = (req.query.q ?? '').toLowerCase();
        const sorted = widgets
          .filter((w) => w.name.toLowerCase().includes(q))
          .sort((a, b) => (req.query.sort === 'name' ? a.name.localeCompare(b.name) : a.id - b.id));
        res.json(sorted.slice(0, req.query.limit ?? 10));
      },
    ),
  );


  // Dummy endpoints that always fail with 500, so the docs UI can show documented error responses.
  const problemBody = {
    'application/problem+json': {
      schema: {
        type: 'object',
        required: ['type', 'title', 'status', 'detail'],
        properties: {
          type: { type: 'string', example: 'about:blank' },
          title: { type: 'string', example: 'Internal Server Error' },
          status: { type: 'integer', example: 500 },
          detail: { type: 'string', example: 'simulated failure' },
        },
      },
    },
  };
  const serverError = { 500: { description: 'Internal Server Error (simulated)', content: problemBody } };

  // File upload: raw body, Content-Type is the file type. `?fail=1` simulates a storage outage.
  const uploadTypes = ['image/png', 'application/pdf', 'text/plain'];
  const uploadLimit = '1mb';
  app.post(
    '/uploads',
    apiDocs.describe('post', '/uploads', {
      summary: 'Upload a file (raw body, Content-Type is the file type)',
      tags: ['uploads'],
      responses: {
        201: {
          description: 'File stored',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id', 'name', 'size', 'type'],
                properties: {
                  id: { type: 'string', example: 'file_1' },
                  name: { type: 'string', example: 'report.pdf' },
                  size: { type: 'integer', example: 2048 },
                  type: { type: 'string', example: 'application/pdf' },
                },
              },
            },
          },
        },
        400: { description: 'Empty upload', content: problemBody },
        413: { description: 'File larger than 1 MB', content: problemBody },
        415: { description: 'Unsupported file type', content: problemBody },
        500: { description: 'Storage failed (simulated with ?fail=1)', content: problemBody },
      },
    }),
    express.raw({ type: () => true, limit: uploadLimit }),
    (req, res) => {
      if (req.query.fail === '1') {
        res.status(500).json({ type: 'about:blank', title: 'Internal Server Error', status: 500, detail: 'Storage unavailable (simulated)' });
        return;
      }
      const body = req.body as Buffer;
      const type = (req.headers['content-type'] ?? '').split(';')[0].trim();
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ type: 'about:blank', title: 'Bad Request', status: 400, detail: 'Empty upload' });
        return;
      }
      if (!uploadTypes.includes(type)) {
        res.status(415).json({ type: 'about:blank', title: 'Unsupported Media Type', status: 415, detail: `${type || 'no type'} is not allowed` });
        return;
      }
      res.status(201).json({ id: `file_${Date.now()}`, name: String(req.headers['x-file-name'] ?? 'upload'), size: body.length, type });
    },
  );

  // Protected endpoint: needs `Authorization: Bearer demo-token`, or it answers 401.
  const unauthorized = {
    401: { description: 'Missing or invalid bearer token', content: problemBody },
  };
  app.get(
    '/secure/whoami',
    apiDocs.describe('get', '/secure/whoami', { summary: 'Who am I (bearer token required)', responses: unauthorized }),
    (req, res) => {
      if (req.headers.authorization !== 'Bearer demo-token') {
        res.status(401).json({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Missing or invalid bearer token' });
        return;
      }
      res.json({ user: 'demo', scheme: 'bearer' });
    },
  );
  app.get(
    '/widgets/crash',
    apiDocs.describe('get', '/widgets/crash', { summary: 'Simulate a server error', responses: serverError }),
    () => {
      throw new Error('simulated failure');
    },
  );
  app.get(
    '/widgets/timeout',
    apiDocs.describe('get', '/widgets/timeout', { summary: 'Simulate a failed upstream call', responses: serverError }),
    () => {
      throw new Error('simulated upstream timeout');
    },
  );

  // Path parameter: registered after /widgets/crash and /widgets/timeout so those literal paths win.
  const notFound = { 404: { description: 'Widget not found', content: problemBody } };
  app.get(
    '/widgets/:id',
    ...route(
      'get',
      '/widgets/:id',
      {
        summary: 'Get one widget by id',
        params: z.object({ id: z.coerce.number().int().min(1) }),
        response: z.object({ id: z.number(), name: z.string() }),
        responses: notFound,
      },
      (req, res) => {
        const widget = widgets.find((w) => w.id === req.params.id);
        if (!widget) {
          res.status(404).json({ type: 'about:blank', title: 'Not Found', status: 404, detail: `widget ${req.params.id} not found` });
          return;
        }
        res.json(widget);
      },
    ),
  );

  // 1000 dummy endpoints, each documented with a 500 and failing on call, to exercise the docs UI at scale.
  for (let i = 1; i <= 1000; i++) {
    const dummyPath = `/dummy/${String(i).padStart(4, '0')}`;
    app.get(
      dummyPath,
      apiDocs.describe('get', dummyPath, { summary: `Dummy endpoint ${i}`, tags: ['dummy'], responses: serverError }),
      () => {
        throw new Error(`dummy endpoint ${i} failed`);
      },
    );
  }

  // A plain Express route with no typed helper and no describe() call, to
  // demonstrate zero-config route auto-detection (ADR-?): the recorder picks
  // this up on its own because express-api-contract was imported before any
  // router was created.
  app.get('/widgets-plain', (_req, res) => {
    res.json([]);
  });

  app.use(apiDocs.router);

  // Express error handler: any uncaught error becomes a JSON 500 instead of an HTML stack trace.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Errors thrown by middleware (e.g. body-parser's 413) carry their own status.
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ type: 'about:blank', title: STATUS_CODES[status] ?? 'Error', status, detail: err instanceof Error ? err.message : 'Unknown error' });
  });

  return app;
}
