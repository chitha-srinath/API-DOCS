import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { META } from '../../src/core/types.js';
import { makeRouteFactory } from './support.js';

describe('route/meta-tag: [META] on both validator and handler (ADR-44)', () => {
  it('both tuple elements carry [META] = {source, method, meta}', () => {
    const { route } = makeRouteFactory();
    const meta = { params: z.object({ id: z.string() }), summary: 'get one' };
    const [validator, handler] = route('get', '/tagged/:id', meta, (_req, res) => res.json({}));

    const validatorTag = (validator as unknown as Record<PropertyKey, unknown>)[META];
    const handlerTag = (handler as unknown as Record<PropertyKey, unknown>)[META];

    expect(validatorTag).toEqual({ source: 'typed', method: 'get', meta });
    expect(handlerTag).toEqual({ source: 'typed', method: 'get', meta });
  });
});
