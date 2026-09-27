import { describe, expect, it } from 'vitest';
import {
  convertPath,
  expandOptionalGroups,
  joinPaths,
  normalizePath,
} from '../../src/introspect/paths.js';

describe('joinPaths / normalizePath', () => {
  it.each([
    ['/api', '/users/:id', '/api/users/:id'],
    ['', '/x', '/x'],
    ['/', '/x', '/x'],
    ['/api', '/', '/api'],
    ['/api/', 'x/', '/api/x'],
    ['', '', '/'],
  ])('join(%s, %s) = %s', (a, b, out) => expect(joinPaths(a, b)).toBe(out));

  it('normalizes', () => {
    expect(normalizePath('//a///b/')).toBe('/a/b');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('Express 5 paths', () => {
  it.each([
    ['/users/:id', '/users/{id}', ['id']],
    ['/files/*rest', '/files/{rest}', ['rest']],
    ['/*rest', '/{rest}', ['rest']],
    ['/a/:b-:c', '/a/{b}-{c}', ['b', 'c']],
    ['/q/:"quoted name"', '/q/{quoted name}', ['quoted name']],
    ['/lit\\:eral', '/lit:eral', []],
  ])('%s -> %s', (input, path, params) => {
    expect(convertPath(input, 5)).toEqual({ ok: true, paths: [{ path, params }] });
  });

  it('expands optional groups into two paths', () => {
    expect(convertPath('/users{/:id}', 5)).toEqual({
      ok: true,
      paths: [
        { path: '/users', params: [] },
        { path: '/users/{id}', params: ['id'] },
      ],
    });
  });

  it('expands nested optional groups', () => {
    expect(expandOptionalGroups('/a{/b{/c}}')).toEqual(['/a', '/a/b', '/a/b/c']);
    expect(expandOptionalGroups('/a\\{b')).toEqual(['/a\\{b']);
  });

  it('rejects unbalanced groups and unsupported syntax', () => {
    expect(expandOptionalGroups('/a{b')).toBeUndefined();
    expect(expandOptionalGroups('/a}b')).toBeUndefined();
    expect(expandOptionalGroups('/a{{b}')).toBeUndefined();
    expect(convertPath('/a{b', 5)).toEqual({ ok: false, reason: 'unsupported' });
    expect(convertPath('/a/(x)', 5)).toEqual({ ok: false, reason: 'unsupported' });
    expect(convertPath('/a/*', 5)).toEqual({ ok: false, reason: 'unnamed-wildcard' });
  });
});

describe('Express 4 paths', () => {
  it.each([
    ['/users/:id', '/users/{id}', ['id']],
    ['/users/:id(\\d+)', '/users/{id}', ['id']],
    ['/f/:name.:ext', '/f/{name}.{ext}', ['name', 'ext']],
  ])('%s -> %s', (input, path, params) => {
    expect(convertPath(input, 4)).toEqual({ ok: true, paths: [{ path, params }] });
  });

  it('expands :id? into two paths', () => {
    expect(convertPath('/opt/:id?', 4)).toEqual({
      ok: true,
      paths: [
        { path: '/opt', params: [] },
        { path: '/opt/{id}', params: ['id'] },
      ],
    });
  });

  it('skips wildcards and unsupported syntax', () => {
    expect(convertPath('*', 4)).toEqual({ ok: false, reason: 'unnamed-wildcard' });
    expect(convertPath('/files/*', 4)).toEqual({ ok: false, reason: 'unnamed-wildcard' });
    expect(convertPath('/*rest', 4)).toEqual({ ok: false, reason: 'unnamed-wildcard' });
    expect(convertPath('/a/:b?-x', 4)).toEqual({ ok: false, reason: 'unsupported' });
    expect(convertPath('/a/(b)', 4)).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('non-string paths', () => {
  it('RegExp and other values cannot be converted', () => {
    expect(convertPath(/^\/re/, 5)).toEqual({ ok: false, reason: 'regexp' });
    expect(convertPath(42, 4)).toEqual({ ok: false, reason: 'unsupported' });
  });
});
