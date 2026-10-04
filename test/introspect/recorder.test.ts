// ST-005 (S-05), ADR-18/ADR-23/ADR-43, F-6.
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { CHILD, MOUNT, RECORDER } from '../../src/core/types.js';
import { annotateNewLayers, installRecorder } from '../../src/introspect/recorder.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

function routerOwnerOf(express: unknown): Record<PropertyKey, unknown> {
  const mod = express as { Router: () => object };
  let proto: object | null = Object.getPrototypeOf(mod.Router());
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'use')) proto = Object.getPrototypeOf(proto);
  return proto as Record<PropertyKey, unknown>;
}

/** ADR-27a: reading `app.router` on Express 4 throws — check `_router` first. */
function rootOf(app: { _router?: unknown; router?: unknown }): { stack: unknown[] } | undefined {
  if (Object.prototype.hasOwnProperty.call(app, '_router')) return app._router as { stack: unknown[] } | undefined;
  return app.router as { stack: unknown[] } | undefined;
}

describe.each(majors)('recorder ($alias)', ({ express }) => {
  it('installRecorder called twice wraps use once (RECORDER guard)', () => {
    installRecorder(express);
    const owner = routerOwnerOf(express);
    const wrappedOnce = owner.use;
    installRecorder(express);
    expect(owner.use).toBe(wrappedOnce);
  });

  it('the stored RECORDER value deep-equals { protocol: 1, packageVersion }', () => {
    installRecorder(express);
    const owner = routerOwnerOf(express);
    const tag = owner[RECORDER] as { protocol: number; packageVersion: string };
    expect(tag.protocol).toBe(1);
    expect(typeof tag.packageVersion).toBe('string');
    expect(tag.packageVersion.length).toBeGreaterThan(0);
  });

  it('a pre-existing same-protocol guard with a different packageVersion is reused, one debug', () => {
    const owner = routerOwnerOf(express);
    owner[RECORDER] = { protocol: 1, packageVersion: '0.0.0-stale' };
    const originalUse = owner.use;
    const log = makeLoggerSpy();
    installRecorder(express, log);
    expect(owner.use).toBe(originalUse); // not re-wrapped
    expect(log.debugs('EAD_RECORDER_VERSION_REUSED')).toHaveLength(1);
    delete owner[RECORDER];
  });

  it('a v2 recorder guard does not prevent v1 installation', () => {
    const owner = routerOwnerOf(express);
    const v2 = Symbol.for('express-api-contract.v2.recorder');
    (owner as Record<PropertyKey, unknown>)[v2] = { protocol: 2, packageVersion: '9.9.9' };
    installRecorder(express);
    expect(owner[RECORDER]).toBeDefined();
    delete (owner as Record<PropertyKey, unknown>)[v2];
  });

  it('only stack.slice(before) gets annotated (F-6), both wrappers', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application; Router: () => import('express').Router };
    const app = ex();
    app.get('/warm', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    const beforeStack = rootOf(app)?.stack as Array<Record<PropertyKey, unknown>>;
    const beforeLen = beforeStack.length;
    // snapshot whatever the pre-existing layers carry (built-ins may already
    // be annotated from lazyrouter's own internal `use` calls) so we can
    // assert F-6: a later `use()` must not touch them.
    const beforeSnapshot = beforeStack.map((layer) => layer[MOUNT]);

    const r1 = ex.Router();
    r1.get('/a', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/one', r1);

    const rootStack = rootOf(app)?.stack as Array<Record<PropertyKey, unknown>>;
    const untouched = rootStack.slice(0, beforeLen);
    expect(untouched.map((layer) => layer[MOUNT])).toEqual(beforeSnapshot);

    const newLayer = rootStack.slice(beforeLen).find((l) => l['name'] === 'router');
    expect(newLayer?.[MOUNT]).toBe('/one');
  });

  it('dispatch is unchanged: a supertest request still reaches the handler', async () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application; Router: () => import('express').Router };
    const app = ex();
    const r = ex.Router();
    r.get('/ping', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ pong: true }));
    app.use('/api', r);

    const response = await request(app).get('/api/ping');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ pong: true });
  });

  it('mount and child identities equal the imported versioned Symbol.for values', () => {
    expect(MOUNT).toBe(Symbol.for('express-api-contract.v1.mount'));
    expect(CHILD).toBe(Symbol.for('express-api-contract.v1.child'));
    expect(RECORDER).toBe(Symbol.for('express-api-contract.v1.recorder'));
  });

  it('throws if the express module has no prototype that owns `use`', () => {
    const brokenModule = {
      Router: () => Object.create(null),
      application: {},
    };
    expect(() => installRecorder(brokenModule)).toThrow(/could not locate the prototype that owns/);
  });
});

describe('annotateNewLayers (direct unit)', () => {
  it('warns EAD_MOUNTED_APP_NO_CHILD when no identifiable sub-app arg is found', () => {
    const log = makeLoggerSpy();
    const layer: Record<PropertyKey, unknown> = { name: 'mounted_app' };
    const stack: unknown[] = [layer];
    annotateNewLayers(stack, 0, ['/sub', 'not-a-function'], log);
    expect(log.warns('EAD_MOUNTED_APP_NO_CHILD')).toHaveLength(1);
    expect(layer[CHILD]).toBeUndefined();
    expect(layer[MOUNT]).toBe('/sub');
  });

  it('is a no-op when no new layers were pushed', () => {
    const log = makeLoggerSpy();
    expect(() => annotateNewLayers([], 0, ['/x'], log)).not.toThrow();
    expect(log.warns()).toHaveLength(0);
  });
});
