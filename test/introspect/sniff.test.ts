// ST-005 (S-05), ADR-27a: the version sniff is key-only and never reads
// `app.router` on Express 4 (reading it throws — spike S-4a).
import { describe, expect, it } from 'vitest';

import { installRecorder, introspect } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('sniff ($alias)', ({ major, express }) => {
  it.skipIf(major !== 4)('never reads app.router on Express 4', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application };
    const app = ex();
    app.get('/plain', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));

    let read = false;
    // express4's own `app.router` getter throws (non-configurable, cannot be
    // overridden directly); a Proxy re-creates the same trap for this test.
    const proxied = new Proxy(app, {
      get(target, prop, receiver): unknown {
        if (prop === 'router') {
          read = true;
          throw new Error('app.router is deprecated!');
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const detected = introspect(proxied, createRegistry(), makeLoggerSpy());
    expect(read).toBe(false);
    expect(detected.some((op) => op.path === '/plain')).toBe(true);
  });

  it.skipIf(major !== 5)('roots the walk from app.router on Express 5', () => {
    installRecorder(express);
    const ex = express as { (): import('express').Application };
    const app = ex();
    app.get('/plain', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));

    expect(app.router).toBeDefined();
    const detected = introspect(app, createRegistry(), makeLoggerSpy());
    expect(detected.some((op) => op.path === '/plain')).toBe(true);
  });
});
