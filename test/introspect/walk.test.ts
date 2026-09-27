// ST-005 (S-05): AC-023 (walk half), AC-030 (walk side), AC-031 (identity
// match), AC-032 (mounted-after-spec), AC-033 (own-path exclusion), ADR-44
// (META fallback).
import { describe, expect, it } from 'vitest';

import { installRecorder, introspect } from '../../src/introspect/index.js';
import { createRegistry } from '../../src/registry/registry.js';
import { META } from '../../src/core/types.js';
import { makeApp } from '../fixtures/apps.js';
import { makeLoggerSpy } from '../fixtures/logger.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('walk ($alias)', ({ major, express }) => {
  it('finds exactly one get and one post at /api/users/{id} with pathParams [id] (AC-023)', () => {
    installRecorder(express);
    const registry = createRegistry();
    const app = makeApp({ major, express });
    const detected = introspect(app, registry, makeLoggerSpy());

    const users = detected.filter((op) => op.path === '/api/users/{id}');
    expect(users).toHaveLength(2);
    expect(users.map((op) => op.method).sort()).toEqual(['get', 'post']);
    for (const op of users) expect(op.pathParams).toEqual(['id']);
  });

  it('finds a plain route added after the spec middleware is mounted (AC-032)', () => {
    installRecorder(express);
    const registry = createRegistry();
    const ex = express as { (): import('express').Application };
    const app = ex();

    const before = introspect(app, registry, makeLoggerSpy());
    expect(before.some((op) => op.path === '/late')).toBe(false);

    app.get('/late', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true }));

    const after = introspect(app, registry, makeLoggerSpy());
    expect(after.some((op) => op.path === '/late' && op.method === 'get')).toBe(true);
  });

  it('autoDetect: false hides plain routes but keeps registry routes (AC-030 walk side)', () => {
    installRecorder(express);
    const registry = createRegistry();
    const ex = express as { (): import('express').Application };
    const app = ex();

    const typedHandler = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true });
    registry.register({ method: 'get', localPath: '/typed', source: 'typed', meta: {}, handlerFn: typedHandler });
    (typedHandler as unknown as Record<PropertyKey, unknown>)[META] = { source: 'typed', method: 'get', meta: {} };
    app.get('/typed', typedHandler);
    app.get('/plain-hidden', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true }));

    const detected = introspect(app, registry, makeLoggerSpy(), { autoDetect: false });
    expect(detected.some((op) => op.path === '/plain-hidden')).toBe(false);
    expect(detected.some((op) => op.path === '/typed' && op.source === 'typed')).toBe(true);
  });

  it('a typed/plain identity match dedupes to one op carrying the typed meta (AC-031)', () => {
    installRecorder(express);
    const registry = createRegistry();
    const ex = express as { (): import('express').Application };
    const app = ex();

    const handlerFn = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true });
    registry.register({
      method: 'get',
      localPath: '/dup',
      source: 'typed',
      meta: { summary: 'typed one' },
      handlerFn,
    });
    app.get('/dup', handlerFn);

    const detected = introspect(app, registry, makeLoggerSpy());
    const matches = detected.filter((op) => op.path === '/dup' && op.method === 'get');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.source).toBe('typed');
    expect(matches[0]?.meta).toEqual({ summary: 'typed one' });
  });

  it('a findByHandle miss with a [META] tag still emits via the ADR-44 fallback', () => {
    installRecorder(express);
    const registry = createRegistry(); // empty: simulates a cross-copy miss
    const ex = express as { (): import('express').Application };
    const app = ex();

    const otherCopyHandler = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true });
    (otherCopyHandler as unknown as Record<PropertyKey, unknown>)[META] = {
      source: 'describe',
      meta: { summary: 'other copy' },
    };
    app.get('/other-copy', otherCopyHandler);

    const detected = introspect(app, registry, makeLoggerSpy());
    const op = detected.find((o) => o.path === '/other-copy');
    expect(op?.source).toBe('describe');
    expect(op?.meta).toEqual({ summary: 'other copy' });
  });

  it('omits the package own spec and docs paths (AC-033)', () => {
    installRecorder(express);
    const registry = createRegistry();
    const ex = express as { (): import('express').Application };
    const app = ex();
    app.get('/openapi.json', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));
    app.get('/docs', (_req: unknown, res: { send: (b: unknown) => void }) => res.send('<html/>'));
    app.get('/kept', (_req: unknown, res: { json: (b: unknown) => void }) => res.json({}));

    const detected = introspect(app, registry, makeLoggerSpy(), { ownPaths: ['/openapi.json', '/docs'] });
    expect(detected.some((op) => op.path === '/openapi.json')).toBe(false);
    expect(detected.some((op) => op.path === '/docs')).toBe(false);
    expect(detected.some((op) => op.path === '/kept')).toBe(true);
  });
});
