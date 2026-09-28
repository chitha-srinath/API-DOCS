// ST-005 (S-05), AC-022.
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createRegistry } from '../../src/registry/registry.js';
import { createDescribe } from '../../src/route/describe.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('describe() ($alias)', ({ express }) => {
  it('calls next() untouched, registers with source describe, and never validates', async () => {
    const registry = createRegistry();
    const describeFn = createDescribe({ registry });
    const ex = express as { (): import('express').Application };
    const app = ex();

    const meta = { summary: 'gets a widget' };
    app.get(
      '/widgets/:id',
      describeFn('get', '/widgets/:id', meta),
      (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true }),
    );

    const entries = registry.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ method: 'get', localPath: '/widgets/:id', source: 'describe', meta });

    // an "invalid" request (describe never validates) still reaches the handler with 200.
    const response = await request(app).get('/widgets/not-a-number?bogus=true');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
