import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createApiDocs } from '../../src/serve/router.js';
import { spyLogger } from '../fixtures/majors.js';

const require = createRequire(import.meta.url);

describe('Express copy without the recorder (ADR-23)', () => {
  it('warns EAD_RECORDER_NOT_INSTALLED once and falls back to local paths', () => {
    const cached = Object.keys(require.cache).filter((k) => k.includes('node_modules/express4/'));
    for (const key of cached) delete require.cache[key];
    const express = require('express4');
    for (const key of Object.keys(require.cache).filter((k) =>
      k.includes('node_modules/express4/'),
    )) {
      delete require.cache[key];
    }
    require('express4');

    const logger = spyLogger();
    const api = createApiDocs({ logger });
    const app = express();
    const router = express.Router();
    router.get('/users/:id', (_q: any, r: any) => r.end());
    app.use('/api', router);
    const sub = express();
    sub.get('/items', (_q: any, r: any) => r.end());
    app.use('/sub', sub);

    const spec = api.getSpec({ app });
    // Express 4 still recovers the router prefix from layer.regexp; the sub-app is lost.
    expect(Object.keys(spec.paths)).toEqual(['/api/users/{id}']);
    expect(logger.count('warn', 'EAD_RECORDER_NOT_INSTALLED')).toBe(1);
    expect(logger.count('warn', 'EAD_SUBAPP_UNRECORDED')).toBe(1);
    api.invalidate();
    api.getSpec({ app });
    expect(logger.count('warn', 'EAD_RECORDER_NOT_INSTALLED')).toBe(2);
  });
});
