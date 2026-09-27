import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { MOUNT, RECORDER } from '../../src/core/types.js';
import { installRecorder, isRecorded, useOwner } from '../../src/introspect/recorder.js';
import { majors } from '../fixtures/majors.js';

const require = createRequire(import.meta.url);

/** Load a fresh, never-patched copy of an Express major. */
function freshExpress(name: string): any {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`node_modules/${name}/`) || key.includes('node_modules/router/'))
      delete require.cache[key];
  }
  const fresh = require(name);
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`node_modules/${name}/`) || key.includes('node_modules/router/'))
      delete require.cache[key];
  }
  // restore the shared copies for other tests
  require(name);
  return fresh;
}

describe.each(majors)('installRecorder on Express $major', ({ name }) => {
  it('patches once, is idempotent and accepts an ESM namespace', () => {
    const express = freshExpress(name);
    expect(isRecorded(express.Router())).toBe(false);
    expect(installRecorder({ default: express })).toBe(true);
    expect(installRecorder(express)).toBe(false);
    const owner = useOwner(express.Router()) as Record<PropertyKey, unknown>;
    expect(owner[RECORDER]).toBe(true);
    expect(isRecorded(express.Router())).toBe(true);
  });

  it('annotates without changing dispatch', async () => {
    const express = freshExpress(name);
    installRecorder(express);
    const app = express();
    const router = express.Router();
    router.get('/x', (_req: any, res: any) => res.send('x'));
    const middleware = (_req: any, _res: any, next: any) => next();
    const result = app.use('/api', middleware, router);
    expect(result).toBe(app);
    // Express 4 keeps its root router at `_router` (reading `app.router` throws there).
    const stack = (app._router ?? app.router).stack;
    const [mw, mounted] = stack.slice(-2);
    expect(mw[MOUNT]).toEqual({ path: '/api' });
    expect(mounted[MOUNT]).toEqual({ path: '/api', target: router });
    const inner = express.Router();
    inner.use(router);
    expect(inner.stack[0][MOUNT]).toEqual({ path: '/', target: router });
    inner.use([router]);
    expect(inner.stack[1][MOUNT]).toEqual({ path: '/', target: router });
  });

  it('keeps working when annotation fails', () => {
    const express = freshExpress(name);
    installRecorder(express);
    const router = express.Router();
    Object.freeze(router.stack);
    expect(() => router.use(() => undefined)).toThrow();
  });
});

describe('installRecorder input checks', () => {
  it('rejects values that are not the express module', () => {
    expect(() => installRecorder({})).toThrow(TypeError);
    expect(() => installRecorder(null)).toThrow(/expects the express module/);
    expect(() => installRecorder(() => undefined)).toThrow(TypeError);
  });

  it('isRecorded is false for objects without a use owner', () => {
    expect(isRecorded(Object.create(null))).toBe(false);
  });
});
