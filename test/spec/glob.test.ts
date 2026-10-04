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

  // QA Fix Loop iteration 1, F-02 (HIGH, widened): the module-level `/g`-flagged
  // REGEXP_METACHARS regex shared `lastIndex` across `.test()` calls in `escapeChar`,
  // causing every other consecutive metacharacter to go unescaped, AND (TC-EDGE-010)
  // certain metacharacter combinations to make `toRegExp` construct a syntactically
  // invalid regex that throws uncaught. Both must be fixed and verified independently.
  it('escapes every metacharacter in a run of 2+ consecutive metacharacters, no alternation (F-02a)', () => {
    // Before the fix: `/a..b` compiled to `^\/a\..b$` (first `.` escaped, second not),
    // so `/aXb` incorrectly matched.
    expect(matchGlob('/a..b', '/a..b')).toBe(true);
    expect(matchGlob('/a..b', '/aXXb')).toBe(false);
    expect(matchGlob('/a..b', '/aXb')).toBe(false);

    // A second independent consecutive-metacharacter pattern (three dots in a row).
    expect(matchGlob('/a...b', '/a...b')).toBe(true);
    expect(matchGlob('/a...b', '/aXXXb')).toBe(false);
  });

  it('a balanced run of every metacharacter class member does not throw and matches literally (F-02b, TC-EDGE-010)', () => {
    // One of every character in REGEXP_METACHARS, arranged so an unescaped run would
    // form an invalid character class / group (e.g. unterminated `[`) and crash
    // `new RegExp()`. Before the fix this threw `SyntaxError: Invalid regular
    // expression ... Unterminated character class`.
    const pattern = '/a.+?^${}()|[]\\b';
    expect(() => matchGlob(pattern, pattern)).not.toThrow();
    expect(matchGlob(pattern, pattern)).toBe(true);
    expect(matchGlob(pattern, '/aXb')).toBe(false);
  });
});
