// ST-005 (S-05), AC-034: path conversion, skips and determinism.
import { describe, expect, it } from 'vitest';

import { convertExpressPath } from '../../src/introspect/paths.js';
import { majors } from '../fixtures/majors.js';
import { makeLoggerSpy } from '../fixtures/logger.js';

const v5 = majors.find((m) => m.major === 5);
const v4 = majors.find((m) => m.major === 4);

describe('paths', () => {
  it(':id becomes {id}', () => {
    const log = makeLoggerSpy();
    expect(convertExpressPath('/users/:id', log)).toEqual([{ path: '/users/{id}', pathParams: ['id'] }]);
  });

  it.skipIf(!v5)('/*rest becomes {rest} (v5 named wildcard)', () => {
    const log = makeLoggerSpy();
    expect(convertExpressPath('/files/*rest', log)).toEqual([{ path: '/files/{rest}', pathParams: ['rest'] }]);
  });

  it.skipIf(!v5)('{/:id} optional expands into two paths (v5)', () => {
    const log = makeLoggerSpy();
    const result = convertExpressPath('/users{/:id}', log);
    expect(result).toEqual([
      { path: '/users/{id}', pathParams: ['id'] },
      { path: '/users', pathParams: [] },
    ]);
  });

  it.skipIf(!v4)(':id? expands into two paths (v4)', () => {
    const log = makeLoggerSpy();
    const result = convertExpressPath('/users/:id?', log);
    expect(result).toEqual([
      { path: '/users/{id}', pathParams: ['id'] },
      { path: '/users', pathParams: [] },
    ]);
  });

  it.skipIf(!v4)('unnamed * (v4) is skipped with exactly one debug call and no throw', () => {
    const log = makeLoggerSpy();
    expect(() => convertExpressPath('/files/*', log)).not.toThrow();
    expect(convertExpressPath('/files/*', log)).toBeUndefined();
    expect(log.debugs('EAD_WILDCARD_SKIPPED')).toHaveLength(2);
  });

  it('a RegExp path is skipped with exactly one debug call and no throw', () => {
    const log = makeLoggerSpy();
    expect(() => convertExpressPath(/^\/foo/, log)).not.toThrow();
    expect(convertExpressPath(/^\/foo/, log)).toBeUndefined();
    expect(log.debugs('EAD_REGEXP_PATH_SKIPPED')).toHaveLength(2);
  });

  it.skipIf(!v5)('an optional segment whose expansions both hit an unrecoverable shape propagates undefined', () => {
    const log = makeLoggerSpy();
    expect(convertExpressPath('/files/*{/:id}', log)).toBeUndefined();
  });

  it.skipIf(!v4)('an optional param whose "without" expansion hits an unrecoverable shape propagates undefined', () => {
    const log = makeLoggerSpy();
    expect(convertExpressPath('/files/*:id?', log)).toBeUndefined();
  });

  it('a non-string, non-RegExp path is skipped with one debug call', () => {
    const log = makeLoggerSpy();
    expect(convertExpressPath(42, log)).toBeUndefined();
    expect(log.debugs('EAD_PATH_SKIPPED')).toHaveLength(1);
  });

  it('two walks (calls) give deep-equal output', () => {
    const log = makeLoggerSpy();
    const first = convertExpressPath('/a/:id/b', log);
    const second = convertExpressPath('/a/:id/b', log);
    expect(first).toEqual(second);
  });
});
