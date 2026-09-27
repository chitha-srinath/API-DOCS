import { describe, expect, it, vi } from 'vitest';
import { SpecCache } from '../../src/spec/cache.js';
import { globToRegExp, matchesAny } from '../../src/spec/glob.js';
import { defaultOperationId, defaultTags } from '../../src/spec/naming.js';
import { statusText } from '../../src/spec/status.js';

describe('glob', () => {
  it.each([
    ['/internal/**', '/internal', true],
    ['/internal/**', '/internal/a/b', true],
    ['/internal/**', '/internals', false],
    ['/api/*', '/api/users', true],
    ['/api/*', '/api/users/1', false],
    ['/a/**/c', '/a/b/x/c', true],
    ['/a.b', '/a.b', true],
    ['/a.b', '/axb', false],
    ['/{id}', '/{id}', true],
  ])('%s vs %s = %s', (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });

  it('matchesAny', () => {
    expect(matchesAny('/x', ['/y', '/x'])).toBe(true);
    expect(matchesAny('/x', [])).toBe(false);
  });
});

describe('naming (A-3, A-4)', () => {
  const op = (method: 'get' | 'post', path: string) => ({
    method,
    path,
    expressPath: path,
    source: 'plain' as const,
  });
  it.each([
    ['get', '/users/{id}', 'getUsersById'],
    ['post', '/users', 'postUsers'],
    ['get', '/', 'getRoot'],
    ['get', '/api/user-profiles/{profile_id}/posts', 'getApiUserProfilesByProfileIdPosts'],
    ['get', '/files/{name}.{ext}', 'getFilesByNameByExt'],
  ] as const)('%s %s -> %s', (method, path, id) => {
    expect(defaultOperationId(op(method, path))).toBe(id);
  });

  it('tags use the first static segment', () => {
    expect(defaultTags(op('get', '/api/users/{id}'))).toEqual(['api']);
    expect(defaultTags(op('get', '/{id}/x'))).toEqual(['x']);
    expect(defaultTags(op('get', '/'))).toEqual([]);
  });
});

describe('SpecCache', () => {
  it('rebuilds only when the key changes or after invalidate', () => {
    const cache = new SpecCache<number>();
    const build = vi.fn(() => 1);
    cache.get('a', build);
    cache.get('a', build);
    expect(build).toHaveBeenCalledTimes(1);
    cache.get('b', build);
    expect(build).toHaveBeenCalledTimes(2);
    cache.invalidate();
    cache.get('b', build);
    expect(build).toHaveBeenCalledTimes(3);
  });
});

describe('statusText', () => {
  it('knows common codes and falls back', () => {
    expect(statusText('204')).toBe('No Content');
    expect(statusText('default')).toBe('Default response');
    expect(statusText('299')).toBe('Response');
  });
});
