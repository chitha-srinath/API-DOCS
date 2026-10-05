// Documented error responses: `describe(..., { responses })` adds those status codes to the
// OpenAPI operation, and the example's dummy 500 endpoints carry them.
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../examples/basic/app.js';

describe('declared responses in the spec', () => {
  it('documents the 500 response declared on the crash endpoint', async () => {
    const res = await request(createApp()).get('/openapi.json').expect(200);
    const r500 = res.body.paths['/widgets/crash'].get.responses['500'];
    expect(r500.description).toBe('Internal Server Error (simulated)');
    expect(r500.content['application/problem+json'].schema.required).toEqual(['type', 'title', 'status', 'detail']);
  });

  it('documents the 500 response on the timeout endpoint too', async () => {
    const res = await request(createApp()).get('/openapi.json').expect(200);
    expect(res.body.paths['/widgets/timeout'].get.responses).toHaveProperty(['500']);
  });

  it('documents 1000 dummy endpoints, each with a 500', async () => {
    const res = await request(createApp()).get('/openapi.json').expect(200);
    const dummy = Object.entries(
      res.body.paths as Record<string, Record<string, { responses: Record<string, unknown> }>>,
    ).filter(([p]) => p.startsWith('/dummy/'));
    expect(dummy).toHaveLength(1000);
    for (const [, methods] of dummy) expect(methods.get?.responses).toHaveProperty(['500']);
  });

  it('protected endpoint answers 401 without a token and 200 with the demo bearer token', async () => {
    const app = createApp();
    await request(app).get('/secure/whoami').expect(401);
    const ok = await request(app).get('/secure/whoami').set('Authorization', 'Bearer demo-token').expect(200);
    expect(ok.body).toEqual({ user: 'demo', scheme: 'bearer' });
  });

  describe('file upload endpoint', () => {
    const app = createApp();
    const bytes = Buffer.from('hello world');

    it('stores a supported file and answers 201 with its metadata', async () => {
      const res = await request(app)
        .post('/uploads')
        .set('Content-Type', 'text/plain')
        .set('X-File-Name', 'notes.txt')
        .send(bytes)
        .expect(201);
      expect(res.body).toMatchObject({ name: 'notes.txt', size: bytes.length, type: 'text/plain' });
      expect(res.body.id).toMatch(/^file_/);
    });

    it('answers 400 for an empty upload', async () => {
      await request(app).post('/uploads').set('Content-Type', 'text/plain').send(Buffer.alloc(0)).expect(400);
    });

    it('answers 413 for a file over 1 MB', async () => {
      const res = await request(app)
        .post('/uploads')
        .set('Content-Type', 'application/pdf')
        .send(Buffer.alloc(2 * 1024 * 1024))
        .expect(413);
      expect(res.body).toMatchObject({ status: 413, title: 'Payload Too Large' });
    });

    it('answers 415 for an unsupported file type', async () => {
      const res = await request(app)
        .post('/uploads')
        .set('Content-Type', 'application/x-msdownload')
        .send(bytes)
        .expect(415);
      expect(res.body.status).toBe(415);
    });

    it('answers 500 when storage fails (?fail=1)', async () => {
      const res = await request(app).post('/uploads?fail=1').set('Content-Type', 'text/plain').send(bytes).expect(500);
      expect(res.body.detail).toBe('Storage unavailable (simulated)');
    });
  });

  it('returns a JSON 500 from the dummy endpoint, matching the documented response', async () => {
    const res = await request(createApp()).get('/widgets/crash').expect(500);
    expect(res.body).toMatchObject({ status: 500, title: 'Internal Server Error' });
  });
});
