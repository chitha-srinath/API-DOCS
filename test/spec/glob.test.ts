// ST-006 (S-06): in-house glob matcher (ADR-10). `*` and `**` only.
import { describe, expect, it } from 'vitest';

import { matchAnyGlob, matchGlob } from '../../src/spec/glob.js';

describe('spec/glob', () => {
  it('`*` matches exactly one path segment', () => {
    expect(matchGlob('/users/*', '/users/1')).toBe(true);
    expect(matchGlob('/users/*', '/users/1/2')).toBe(false);
    expect(matchGlob('/users/*', '/users')).toBe(false);
  });

  it('`**` matches zero or more segments', () => {
    expect(matchGlob('/internal/**', '/internal')).toBe(true);
    expect(matchGlob('/internal/**', '/internal/a/b')).toBe(true);
    expect(matchGlob('/internal/**', '/internals')).toBe(false);
  });

  it('escapes regex metacharacters literally', () => {
    expect(matchGlob('/a.b', '/a.b')).toBe(true);
    expect(matchGlob('/a.b', '/aXb')).toBe(false);
  });

  it('matches `{id}`-style OpenAPI paths', () => {
    expect(matchGlob('/users/*', '/users/{id}')).toBe(true);
    expect(matchGlob('/api/**', '/api/users/{id}')).toBe(true);
  });

  it('matchAnyGlob is true when any pattern matches', () => {
    expect(matchAnyGlob(['/a/**', '/b/**'], '/b/x')).toBe(true);
    expect(matchAnyGlob(['/a/**', '/b/**'], '/c/x')).toBe(false);
  });
});
