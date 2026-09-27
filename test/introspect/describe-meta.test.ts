// ST-005 (S-05), ADR-44: describe()'s middleware carries [META].
import { describe, expect, it } from 'vitest';

import { META } from '../../src/core/types.js';
import { createDescribe } from '../../src/route/describe.js';
import { createRegistry } from '../../src/registry/registry.js';

describe('describe [META] tag', () => {
  it('sets [META] with { source, method, meta }', () => {
    const registry = createRegistry();
    const describeFn = createDescribe({ registry });
    const middleware = describeFn('get', '/x', { summary: 'hi' });
    const tag = (middleware as unknown as Record<PropertyKey, unknown>)[META];
    expect(tag).toEqual({ source: 'describe', method: 'get', meta: { summary: 'hi' } });
  });
});
