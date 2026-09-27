import { describe, expectTypeOf, it } from 'vitest';
import type { Request } from 'express';
import { z } from 'zod';
import { createApiDocs } from '../../src/serve/router.js';

const api = createApiDocs();

describe('typed route inference (AC-006)', () => {
  it('infers params, query, body and response', () => {
    api.route(
      {
        params: z.object({ id: z.coerce.number() }),
        query: z.object({ q: z.string().optional() }),
        body: z.object({ name: z.string() }),
        responses: {
          200: z.object({ id: z.number() }),
          404: { description: 'x', schema: z.object({ error: z.string() }) },
        },
      },
      (req, res) => {
        expectTypeOf(req.params.id).toEqualTypeOf<number>();
        expectTypeOf(req.query.q).toEqualTypeOf<string | undefined>();
        expectTypeOf(req.body.name).toEqualTypeOf<string>();
        // @ts-expect-error params.id is a number
        const s: string = req.params.id;
        // @ts-expect-error body has no age
        void req.body.age;
        // @ts-expect-error wrong response body
        res.json({ id: 'x' });
        res.json({ error: 'missing' });
        res.json({ id: 1 });
        void s;
      },
    );
  });

  it('falls back to Express defaults without schemas', () => {
    api.route({}, (req, res) => {
      expectTypeOf(req.params).toEqualTypeOf<Request['params']>();
      expectTypeOf(req.body).toEqualTypeOf<unknown>();
      res.json({ anything: true });
    });
  });

  it('returns a spreadable handler pair', () => {
    const pair = api.route({}, () => undefined);
    expectTypeOf(pair).toMatchTypeOf<[unknown, unknown]>();
  });
});
