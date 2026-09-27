// ST-005 (S-05), ADR-23/ADR-34: an un-installed (fresh) express copy.
import { afterEach, describe, expect, it } from 'vitest';

import { introspect } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { freshExpress } from '../fixtures/fresh-express.js';
import { makeLoggerSpy } from '../fixtures/logger.js';

describe('recorder mismatch (express4, fresh, never installed)', () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it('warns EAD_RECORDER_NOT_INSTALLED once, router falls back to local paths, sub-app routes dropped', () => {
    const fresh = freshExpress('express4');
    restore = fresh.restore;
    const ex = fresh.express as { (): import('express').Application; Router: () => import('express').Router };

    const app = ex();
    const r = ex.Router();
    r.get('/nested', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/api', r);

    const sub = ex();
    sub.get('/child', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/sub', sub);

    const log = makeLoggerSpy();
    const detected = introspect(app, createRegistry(), log);

    expect(log.warns('EAD_RECORDER_NOT_INSTALLED')).toHaveLength(1);
    expect(
      String(log.warns('EAD_RECORDER_NOT_INSTALLED')[0]?.[1] ?? log.warns('EAD_RECORDER_NOT_INSTALLED')[0]?.join(' ')),
    ).toMatch(/installRecorder\(/);
    expect(detected.some((op) => op.path === '/nested')).toBe(true); // local path, no /api prefix.
    expect(detected.some((op) => op.path.includes('/api'))).toBe(false);

    expect(log.warns('EAD_SUBAPP_UNRECORDED')).toHaveLength(1);
    expect(detected.some((op) => op.path === '/child' || op.path === '/sub/child')).toBe(false);
  });

  it('EAD_RECORDER_NOT_INSTALLED count is 2 after one invalidate() and a second walk', () => {
    const fresh = freshExpress('express4');
    restore = fresh.restore;
    const ex = fresh.express as { (): import('express').Application };
    const app = ex();
    app.get('/plain', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));

    const log = makeLoggerSpy();
    introspect(app, createRegistry(), log);
    // "invalidate()" is a caller-side cache concept (S-06); this story only
    // guarantees the walk warns once per walk, so a second walk warns again.
    introspect(app, createRegistry(), log);

    expect(log.warns('EAD_RECORDER_NOT_INSTALLED')).toHaveLength(2);
  });
});
