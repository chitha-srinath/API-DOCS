// ST-005 (S-05), CR-8: introspecting a mounted sub-app (app.parent set)
// warns once and walks from the topmost ancestor.
import { describe, expect, it } from 'vitest';

import { installRecorder, introspect } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('sub-app parent walk ($alias)', ({ express }) => {
  it('walks from the topmost ancestor and warns EAD_MOUNTED_IN_SUBAPP once', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application };
    const root = ex();
    const sub = ex();
    sub.get('/child-route', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    root.get('/root-route', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    root.use('/mounted', sub);

    const log = makeLoggerSpy();
    // introspecting the SUB-APP (which has .parent set once mounted).
    const detected = introspect(sub as unknown, createRegistry(), log);

    expect(log.warns('EAD_MOUNTED_IN_SUBAPP')).toHaveLength(1);
    expect(detected.some((op) => op.path === '/root-route')).toBe(true);
    expect(detected.some((op) => op.path === '/mounted/child-route')).toBe(true);
  });
});
