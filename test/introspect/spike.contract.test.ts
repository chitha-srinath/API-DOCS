// ST-005 (S-05), gate G-S05: this test must pass on express@5.2.1 and
// express4@npm:express@4.22.3 BEFORE any other auto-detect code is committed.
// It re-encodes the S-4b spike fixtures: a nested router, a mounted sub-app,
// a wrapped handler and a plain route.
import { describe, expect, it } from 'vitest';

import { installRecorder, introspect } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { makeApp } from '../fixtures/apps.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('G-S05 spike contract ($alias)', ({ major, express }) => {
  it('walks the S-4b fixture set with zero warns and the expected meta tags', () => {
    installRecorder(express);
    const log = makeLoggerSpy();
    const registry = createRegistry();
    const app = makeApp({ major, express });

    const detected = introspect(app, registry, log);
    const sorted = [...detected].sort((a, b) =>
      a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
    );

    expect(sorted.map((op) => ({ method: op.method, path: op.path, source: op.source }))).toEqual([
      { method: 'get', path: '/api/users/{id}', source: 'plain' },
      { method: 'post', path: '/api/users/{id}', source: 'plain' },
      { method: 'get', path: '/plain', source: 'plain' },
      { method: 'get', path: '/v1/items/{id}', source: 'plain' },
      { method: 'get', path: '/w', source: 'describe' },
    ]);

    const wrapped = sorted.find((op) => op.path === '/w');
    expect(wrapped?.meta).toEqual({ summary: 'wrapped handler' });

    const plain = sorted.find((op) => op.path === '/plain');
    expect(plain?.meta).toBeUndefined();

    expect(log.warns()).toEqual([]);
  });
});
