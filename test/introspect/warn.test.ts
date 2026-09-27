// ST-005 (S-05), ADR-19: exactly one warn per case per walk, filtered by
// EAD_* code.
import { describe, expect, it } from 'vitest';

import { installRecorder, introspect } from '../../src/introspect/index.js';
import { CHILD, MOUNT } from '../../src/core/types.js';
import { createRegistry } from '../../src/registry/registry.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

/** ADR-27a: reading `app.router` on Express 4 throws — check `_router` first. */
function rootOf(app: { _router?: unknown; router?: unknown }): { stack: unknown[] } | undefined {
  if (Object.prototype.hasOwnProperty.call(app, '_router')) return app._router as { stack: unknown[] } | undefined;
  return app.router as { stack: unknown[] } | undefined;
}

describe('introspect() outer catch (EAD_WALK_FAILED)', () => {
  it('degrades to an empty result and warns once on an Error thrown mid-walk', () => {
    const log = makeLoggerSpy();
    const brokenRegistry = {
      register: () => {
        throw new Error('unused');
      },
      entries: () => {
        throw new Error('boom');
      },
      findByHandle: () => undefined,
    };
    const detected = introspect({}, brokenRegistry as never, log);
    expect(detected).toEqual([]);
    expect(log.warns('EAD_WALK_FAILED')).toHaveLength(1);
  });

  it('degrades to an empty result and warns once on a non-Error thrown value', () => {
    const log = makeLoggerSpy();
    const brokenRegistry = {
      register: () => undefined as never,
      entries: () => {
        throw 'not an error object';
      },
      findByHandle: () => undefined,
    };
    const detected = introspect({}, brokenRegistry as never, log);
    expect(detected).toEqual([]);
    expect(log.warns('EAD_WALK_FAILED')[0]?.[1]).toBe('not an error object');
  });
});

describe.each(majors)('warn ($alias)', ({ major, express }) => {
  it.skipIf(major !== 4)(
    'a regexp mount prefix that does not match the recognised pattern warns once (unrecoverable)',
    () => {
      installRecorder(express);
      const ex = express as { (): import('express').Application; Router: () => import('express').Router };
      const app = ex();
      const r = ex.Router();
      r.get('/x', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
      app.use('/api', r);
      const rootStack = rootOf(app)?.stack as Array<Record<PropertyKey, unknown>>;
      const layer = rootStack.find((l) => l['name'] === 'router');
      if (layer) {
        delete layer[MOUNT]; // simulate a pre-import mount with an unrecognisable regexp shape.
        layer['regexp'] = /totally-different-shape/;
      }

      const log = makeLoggerSpy();
      const detected = introspect(app, createRegistry(), log);
      expect(log.warns('EAD_MOUNT_PREFIX_UNRECOVERABLE')).toHaveLength(1);
      expect(detected.some((op) => op.path === '/x')).toBe(true);
    },
  );

  it.skipIf(major !== 4)('a regexp mount prefix using the bare "$" suffix form is recovered', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application; Router: () => import('express').Router };
    const app = ex();
    const r = ex.Router();
    r.get('/x', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/api', r);
    const rootStack = rootOf(app)?.stack as Array<Record<PropertyKey, unknown>>;
    const layer = rootStack.find((l) => l['name'] === 'router');
    if (layer) {
      delete layer[MOUNT];
      layer['regexp'] = /^\/api\/?$/;
    }

    const log = makeLoggerSpy();
    const detected = introspect(app, createRegistry(), log);
    expect(log.warns('EAD_MOUNT_PREFIX_UNRECOVERABLE')).toHaveLength(0);
    expect(detected.some((op) => op.path === '/api/x')).toBe(true);
  });

  it.skipIf(major !== 5)('an unrecoverable v5 mount prefix (mounted before install) warns once, local path', () => {
    const ex = express as { (): import('express').Application; Router: () => import('express').Router };
    const app = ex();
    const r = ex.Router();
    r.get('/x', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/before-install', r); // mounted BEFORE installRecorder: no [MOUNT] annotation, no regexp fallback on v5.

    installRecorder(express);
    const log = makeLoggerSpy();
    const detected = introspect(app, createRegistry(), log);
    expect(log.warns('EAD_MOUNT_PREFIX_UNRECOVERABLE')).toHaveLength(1);
    expect(detected.some((op) => op.path === '/x')).toBe(true);
  });

  it('a registry entry not found in the stack warns once, emitted at its local path', () => {
    installRecorder(express);
    const registry = createRegistry();
    const ex = express as { (): import('express').Application };
    const app = ex();
    const orphanHandler = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({});
    registry.register({ method: 'get', localPath: '/orphan', source: 'typed', meta: {}, handlerFn: orphanHandler });
    // never mounted on the app: findByHandle will never see it during the walk.

    const log = makeLoggerSpy();
    const detected = introspect(app, registry, log);
    expect(log.warns('EAD_REGISTRY_ENTRY_NOT_FOUND')).toHaveLength(1);
    expect(detected.some((op) => op.path === '/orphan' && op.source === 'typed')).toBe(true);
  });

  it('an unrecognised router layer shape warns once', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application; Router: () => import('express').Router };
    const app = ex();
    const r = ex.Router();
    r.get('/a', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/broken', r);
    const rootStack = rootOf(app)?.stack as Array<Record<PropertyKey, unknown>>;
    const layer = rootStack.find((l) => l['name'] === 'router' && l[MOUNT] === '/broken');
    // corrupt the handle so the walker cannot recurse into it.
    if (layer) layer['handle'] = {};

    const log = makeLoggerSpy();
    introspect(app, createRegistry(), log);
    expect(log.warns('EAD_LAYER_UNRECOGNISED')).toHaveLength(1);
  });

  it('a mounted_app without [CHILD] warns once', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application };
    const app = ex();
    const sub = ex();
    sub.get('/x', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/sub', sub);
    const rootStack = rootOf(app)?.stack as Array<Record<PropertyKey, unknown>>;
    const layer = rootStack.find((l) => l['name'] === 'mounted_app');
    if (layer) delete layer[CHILD];

    const log = makeLoggerSpy();
    introspect(app, createRegistry(), log);
    expect(log.warns('EAD_SUBAPP_UNRECORDED')).toHaveLength(1);
  });

  it('a layer whose inspection throws warns once and the walk does not throw', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application };
    const app = ex();
    app.get('/ok', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    const rootStack = rootOf(app)?.stack as Array<Record<PropertyKey, unknown>>;
    const layer = rootStack.find((l) => l['route']);
    Object.defineProperty(layer, 'route', {
      configurable: true,
      get(): never {
        throw new Error('boom');
      },
    });

    const log = makeLoggerSpy();
    expect(() => introspect(app, createRegistry(), log)).not.toThrow();
    expect(log.warns('EAD_LAYER_THREW')).toHaveLength(1);
  });
});
