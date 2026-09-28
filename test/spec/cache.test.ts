// ST-006 (S-06, component C7): a lazy cache keyed on the nested fingerprint
// (ADR-09); `invalidate()` clears it (ADR-02).
import { describe, expect, it, vi } from 'vitest';

import { createSpecCache } from '../../src/spec/cache.js';
import { installRecorder } from '../../src/introspect/index.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('spec/cache ($alias)', ({ express }) => {
  const ex = express as { (): import('express').Application; Router: () => import('express').Router };

  it('cache hit when fingerprint unchanged: builder called once for two gets', () => {
    installRecorder(express);
    const app = ex();
    app.get('/a', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    const cache = createSpecCache<number>();
    const build = vi.fn(() => 1);

    cache.get(app, build);
    cache.get(app, build);

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('route added to a nested router after mounting triggers re-walk (AC-032)', () => {
    installRecorder(express);
    const app = ex();
    const router = ex.Router();
    app.use('/api', router);
    const cache = createSpecCache<number>();
    let counter = 0;
    const build = vi.fn(() => {
      counter += 1;
      return counter;
    });

    const first = cache.get(app, build);
    router.get('/late', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    const second = cache.get(app, build);

    expect(second).not.toBe(first);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('invalidate() clears the cache: rebuild happens even with an equal fingerprint', () => {
    installRecorder(express);
    const app = ex();
    app.get('/a', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    const cache = createSpecCache<number>();
    let counter = 0;
    const build = vi.fn(() => {
      counter += 1;
      return counter;
    });

    cache.get(app, build);
    cache.invalidate();
    cache.get(app, build);

    expect(build).toHaveBeenCalledTimes(2);
  });
});
