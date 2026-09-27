import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { makeRouteFactory } from './support.js';

describe('route/typed types (AC-006, ADR-36: shared Express 4/5 API only)', () => {
  it('infers params/query/body from the route schemas', () => {
    const { route } = makeRouteFactory();
    route(
      'post',
      '/typed/:id',
      {
        params: z.object({ id: z.string() }),
        query: z.object({ n: z.coerce.number() }),
        body: z.object({ a: z.string() }),
      },
      (req, res) => {
        expectTypeOf(req.params.id).toEqualTypeOf<string>();
        expectTypeOf(req.query.n).toEqualTypeOf<number>();
        expectTypeOf(req.body.a).toEqualTypeOf<string>();
        res.json({});
      },
    );
  });

  it('rejects a wrong assignment from the inferred params type', () => {
    const { route } = makeRouteFactory();
    route('get', '/typed2/:id', { params: z.object({ id: z.string() }) }, (req, res) => {
      // @ts-expect-error req.params.id is a string, not a number
      const n: number = req.params.id;
      void n;
      res.json({});
    });
  });
});
