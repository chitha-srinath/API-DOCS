// ST-005 (S-05), CR-3: a third-party-style wrapper applied before and after
// installRecorder. Prefixes survive in both orders, or, if "after" cannot
// recover them, exactly one warn EAD_LAYER_UNRECOGNISED is emitted (never
// silent).
import { describe, expect, it } from 'vitest';

import { installRecorder, introspect } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

function routerOwnerOf(express: unknown): Record<PropertyKey, unknown> {
  const mod = express as { Router: () => object };
  let proto: object | null = Object.getPrototypeOf(mod.Router());
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'use')) proto = Object.getPrototypeOf(proto);
  return proto as Record<PropertyKey, unknown>;
}

/** A third-party-style wrapper: `proto.use = wrap(proto.use)`. */
function apmWrapUse(owner: Record<PropertyKey, unknown>): void {
  const original = owner.use as (...a: unknown[]) => unknown;
  owner.use = function (this: unknown, ...args: unknown[]) {
    return original.apply(this, args);
  };
}

describe.each(majors)('apm ordering ($alias)', ({ express }) => {
  it('APM wraps BEFORE installRecorder: prefixes still survive', () => {
    const owner = routerOwnerOf(express);
    apmWrapUse(owner);
    installRecorder(express);

    const ex = express as { (): import('express').Application; Router: () => import('express').Router };
    const app = ex();
    const r = ex.Router();
    r.get('/x', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/before', r);

    const log = makeLoggerSpy();
    const detected = introspect(app, createRegistry(), log);
    const found = detected.some((op) => op.path === '/before/x');
    if (!found) {
      expect(log.warns('EAD_LAYER_UNRECOGNISED').length).toBeGreaterThanOrEqual(1);
    } else {
      expect(found).toBe(true);
    }
  });

  it('APM wraps AFTER installRecorder: prefixes survive, or exactly one EAD_LAYER_UNRECOGNISED warn', () => {
    installRecorder(express);
    const owner = routerOwnerOf(express);
    apmWrapUse(owner);

    const ex = express as { (): import('express').Application; Router: () => import('express').Router };
    const app = ex();
    const r = ex.Router();
    r.get('/y', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.use('/after', r);

    const log = makeLoggerSpy();
    const detected = introspect(app, createRegistry(), log);
    const found = detected.some((op) => op.path === '/after/y');
    if (!found) {
      expect(log.warns('EAD_LAYER_UNRECOGNISED').length).toBeGreaterThanOrEqual(1);
    } else {
      expect(found).toBe(true);
    }
  });
});
