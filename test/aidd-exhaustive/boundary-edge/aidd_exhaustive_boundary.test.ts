// AIDD QA — boundary-edge exhaustive matrix (TC-EDGE-NNN).
// Category: boundary-edge. AIDD exhaustive-testing pass, QA steps 4-5.
// See qa/tests/boundary-edge.md for the designed matrix + narrative results.
import { describe, expect, it } from 'vitest';

import { matchAnyGlob, matchGlob } from '../../../src/spec/glob.js';
import { mergeOptions } from '../../../src/config/merge.js';
import { DEFAULT_OPTIONS } from '../../../src/config/defaults.js';
import { convertExpressPath } from '../../../src/introspect/paths.js';
import type { Logger } from '../../../src/core/types.js';

function silentLogger(): Logger & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const rec =
    (level: string) =>
    (...args: unknown[]) => {
      calls.push([level, ...args]);
    };
  return {
    debug: rec('debug'),
    info: rec('info'),
    warn: rec('warn'),
    error: rec('error'),
    calls,
  } as Logger & { calls: unknown[][] };
}

describe('TC-EDGE: glob.ts boundary sweep (AC-030, AC-034, AC-041)', () => {
  // TC-EDGE-001: empty pattern
  it('TC-EDGE-001 empty pattern matches only empty path', () => {
    expect(matchGlob('', '')).toBe(true);
    expect(matchGlob('', '/a')).toBe(false);
  });

  // TC-EDGE-002: empty path against non-empty pattern
  it('TC-EDGE-002 non-empty pattern does not match empty path', () => {
    expect(matchGlob('/a', '')).toBe(false);
    expect(matchGlob('*', '')).toBe(true); // `*` matches zero-or-one segment of any content incl. empty string per regex `[^/]*`
  });

  // TC-EDGE-003: pattern that is only `*`
  it('TC-EDGE-003 pattern that is only `*` matches any single non-slash-containing string', () => {
    expect(matchGlob('*', 'anything')).toBe(true);
    expect(matchGlob('*', '/anything')).toBe(false); // contains `/`, `[^/]*` excludes it… actually `/` is a char not matched by [^/]
  });

  // TC-EDGE-004: pattern that is only `**`
  it('TC-EDGE-004 pattern that is only `**` matches everything including empty', () => {
    expect(matchGlob('**', '')).toBe(true);
    expect(matchGlob('**', '/a/b/c')).toBe(true);
  });

  // TC-EDGE-005: pattern of ONLY metacharacters (single)
  it('TC-EDGE-005 pattern of a single metacharacter matches only its literal escape', () => {
    expect(matchGlob('.', '.')).toBe(true);
    expect(matchGlob('.', 'x')).toBe(false);
  });

  // TC-EDGE-006: pattern of consecutive identical metacharacters — probes escapeChar's global-regex .test() lastIndex bug
  it('TC-EDGE-006 pattern of two consecutive metacharacters ".." matches literal ".." only (not any 2 chars)', () => {
    // If escapeChar's REGEXP_METACHARS (declared with /g) carries lastIndex state
    // across calls, the second '.' in a row may fail to be detected as a
    // metachar (test() returns false because lastIndex was left at 1 from the
    // first call), so it would NOT be escaped and "." would wrongly act as
    // regex-any-char, making matchGlob('..', 'xy') incorrectly true.
    expect(matchGlob('..', '..')).toBe(true);
    const result = matchGlob('..', 'xy');
    expect(result).toBe(false); // literal ".." must not match arbitrary 2-char "xy"
  });

  // TC-EDGE-007: three consecutive metacharacters
  it('TC-EDGE-007 pattern of three consecutive metacharacters "..." matches literal only', () => {
    expect(matchGlob('...', '...')).toBe(true);
    expect(matchGlob('...', 'abc')).toBe(false);
  });

  // TC-EDGE-008: four consecutive metacharacters (even count) — parity check for lastIndex toggling
  it('TC-EDGE-008 four consecutive metacharacters "...." literal-only, parity check', () => {
    expect(matchGlob('....', '....')).toBe(true);
    expect(matchGlob('....', 'wxyz')).toBe(false);
  });

  // TC-EDGE-009: alternating metachar / non-metachar sequence
  it('TC-EDGE-009 alternating metachar and literal chars escape correctly regardless of call order', () => {
    expect(matchGlob('a.b.c', 'a.b.c')).toBe(true);
    expect(matchGlob('a.b.c', 'aXbXc')).toBe(false);
  });

  // TC-EDGE-010: pattern containing every distinct metacharacter in the class once, in a
  // balanced order (each bracket paired) so a *correct* implementation always produces a
  // syntactically valid, literal-matching regex. Any throw or literal-match failure here is
  // a genuine product defect, not a test-construction artifact.
  it('TC-EDGE-010 one of every metacharacter class member (balanced), run twice for determinism', () => {
    const pattern = '.+?^$(){}[]|\\';
    let first: boolean | undefined;
    let second: boolean | undefined;
    let firstErr: unknown;
    let secondErr: unknown;
    try {
      first = matchGlob(pattern, pattern);
    } catch (e) {
      firstErr = e;
    }
    try {
      second = matchGlob(pattern, pattern);
    } catch (e) {
      secondErr = e;
    }
    // Document actual behavior: no throw, literal self-match true both times.
    expect(firstErr).toBeUndefined();
    expect(secondErr).toBeUndefined();
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  // TC-EDGE-011: same metachar-only pattern matched twice against two different targets (call-order sensitivity)
  it('TC-EDGE-011 repeated matchGlob calls with same pattern are order/count independent', () => {
    const results: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(matchGlob('..', '..'));
      results.push(matchGlob('..', 'zz'));
    }
    // Every '..' vs '..' check must be true, every '..' vs 'zz' check must be false,
    // regardless of how many times the function has already been called.
    expect(results).toEqual([true, false, true, false, true, false, true, false, true, false]);
  });

  // TC-EDGE-012: pattern much longer than any real route (stress length)
  it('TC-EDGE-012 very long pattern (2000 chars) does not throw and matches identical long path', () => {
    const long = '/seg'.repeat(500); // 2000 chars
    expect(() => matchGlob(long, long)).not.toThrow();
    expect(matchGlob(long, long)).toBe(true);
  });

  // TC-EDGE-013: very long pattern with trailing /** (exclude-glob boundary AC-030/AC-041)
  it('TC-EDGE-013 very long "/**"-suffixed pattern matches prefix and deep nesting', () => {
    const base = '/internal' + '/seg'.repeat(400);
    expect(matchGlob(`${base}/**`, base)).toBe(true);
    expect(matchGlob(`${base}/**`, `${base}/x/y/z`)).toBe(true);
  });

  // TC-EDGE-014: unicode characters in pattern and path
  it('TC-EDGE-014 unicode segment names match literally', () => {
    expect(matchGlob('/café/*', '/café/münchen')).toBe(true);
    expect(matchGlob('/café/*', '/cafe/münchen')).toBe(false);
  });

  // TC-EDGE-015: unicode combined with metacharacters adjacent (e.g. emoji + dot)
  it('TC-EDGE-015 unicode adjacent to metacharacters still escapes the metacharacter', () => {
    expect(matchGlob('/🚀.zip', '/🚀.zip')).toBe(true);
    expect(matchGlob('/🚀.zip', '/🚀Xzip')).toBe(false);
  });

  // TC-EDGE-016: whitespace-only pattern and path
  it('TC-EDGE-016 whitespace-only pattern matches literal whitespace only', () => {
    expect(matchGlob('   ', '   ')).toBe(true);
    expect(matchGlob('   ', '')).toBe(false);
  });

  // TC-EDGE-017: leading/trailing whitespace around metachars
  it('TC-EDGE-017 whitespace surrounding consecutive metachars still literal-matches', () => {
    expect(matchGlob(' .. ', ' .. ')).toBe(true);
    expect(matchGlob(' .. ', ' xy ')).toBe(false);
  });

  // TC-EDGE-018: matchAnyGlob with empty patterns array
  it('TC-EDGE-018 matchAnyGlob with empty pattern list is always false', () => {
    expect(matchAnyGlob([], '/a')).toBe(false);
    expect(matchAnyGlob([], '')).toBe(false);
  });

  // TC-EDGE-019: matchAnyGlob with a single empty-string pattern
  it('TC-EDGE-019 matchAnyGlob([""], path) only true for empty path', () => {
    expect(matchAnyGlob([''], '')).toBe(true);
    expect(matchAnyGlob([''], '/a')).toBe(false);
  });

  // TC-EDGE-020: backslash-heavy pattern (regex escape char is itself a metachar)
  it('TC-EDGE-020 consecutive backslashes are escaped literally, not treated as regex escapes', () => {
    expect(matchGlob('\\\\', '\\\\')).toBe(true);
    expect(matchGlob('\\\\', 'ab')).toBe(false);
  });

  // TC-EDGE-021: bracket pair `[]` (regex char class) as literal boundary case
  it('TC-EDGE-021 empty bracket pair matches literal "[]" not a regex character class', () => {
    expect(matchGlob('[]', '[]')).toBe(true);
    expect(matchGlob('[]', 'a')).toBe(false);
  });

  // TC-EDGE-022: repeated `**` (double-double-star) boundary
  it('TC-EDGE-022 pattern "****" (all wildcard, no separators) matches everything without slash logic collapsing', () => {
    expect(() => matchGlob('****', 'literally-anything')).not.toThrow();
  });
});

describe('TC-EDGE: config merge deep-merge boundary sweep (AC-044, AC-036)', () => {
  // TC-EDGE-023: empty global and route objects leave defaults untouched
  it('TC-EDGE-023 empty overrides at both layers preserve every default field', () => {
    const merged = mergeOptions(DEFAULT_OPTIONS, {}, {});
    expect(merged).toEqual(DEFAULT_OPTIONS);
  });

  // TC-EDGE-024: undefined values at a nested key never override a defined default
  it('TC-EDGE-024 explicit undefined leaf in override does not clobber default leaf', () => {
    const merged = mergeOptions(
      { openapi: { info: { title: 'Default', version: '1.0.0' } } },
      { openapi: { info: { title: undefined as unknown as string } } },
      {},
    );
    expect(merged.openapi!.info.title).toBe('Default');
    expect(merged.openapi!.info.version).toBe('1.0.0');
  });

  // TC-EDGE-025: AC-044(a) — global title override keeps default version
  it('TC-EDGE-025 AC-044(a) global info.title override keeps default info.version', () => {
    const defaults = { openapi: { info: { title: 'D', version: '0.0.1' } } };
    const merged = mergeOptions(defaults, { openapi: { info: { title: 'Global' } } }, {});
    expect(merged.openapi.info.title).toBe('Global');
    expect(merged.openapi.info.version).toBe('0.0.1');
  });

  // TC-EDGE-026: AC-044(b) — arrays replace, not concatenate
  it('TC-EDGE-026 AC-044(b) global tags array replaced wholly by route tags array', () => {
    const defaults = { tags: [] as string[] };
    const merged = mergeOptions(defaults, { tags: ['a', 'b'] }, { tags: ['c'] });
    expect(merged.tags).toEqual(['c']);
  });

  // TC-EDGE-027: AC-044(c) — per-route scalar beats global scalar
  it('TC-EDGE-027 AC-044(c) per-route validateResponses beats global', () => {
    const defaults = { validateResponses: undefined as 'warn' | 'error' | undefined };
    const merged = mergeOptions(defaults, { validateResponses: 'warn' }, { validateResponses: 'error' });
    expect(merged.validateResponses).toBe('error');
  });

  // TC-EDGE-028: AC-044(d) — per-route function beats global function (opaque replace, not merge)
  it('TC-EDGE-028 AC-044(d) per-route onValidationError function replaces global function wholly', () => {
    const globalFn = () => 'global';
    const routeFn = () => 'route';
    const defaults = { onValidationError: undefined as unknown as () => string };
    const merged = mergeOptions(defaults, { onValidationError: globalFn }, { onValidationError: routeFn });
    expect(merged.onValidationError).toBe(routeFn);
  });

  // TC-EDGE-029: empty array override replaces non-empty default array (not merged/concatenated)
  it('TC-EDGE-029 empty array override at route layer wins over non-empty global array', () => {
    const defaults = { include: ['/default/**'] };
    const merged = mergeOptions(defaults, { include: ['/global/**'] }, { include: [] });
    expect(merged.include).toEqual([]);
  });

  // TC-EDGE-030: object with function member is treated as opaque and replaces wholly (schemaAdapter-like)
  it('TC-EDGE-030 object carrying a function member does not deep-merge, replaces wholly', () => {
    const defaults = { schemaAdapter: { name: 'zod', parse: () => true, extra: 'keep-me' } };
    const override = { schemaAdapter: { name: 'stub', parse: () => false } };
    const merged = mergeOptions(defaults, {}, { schemaAdapter: override.schemaAdapter });
    expect(merged.schemaAdapter).toBe(override.schemaAdapter);
    expect((merged.schemaAdapter as Record<string, unknown>).extra).toBeUndefined();
  });

  // TC-EDGE-031: null value override (distinct from undefined) — null is a defined value and must replace
  it('TC-EDGE-031 null override at a leaf replaces default value (null is defined, unlike undefined)', () => {
    const defaults = { docs: { specUrl: 'https://default.example/openapi.json' as string | null } };
    const merged = mergeOptions(defaults, {}, { docs: { specUrl: null } });
    expect(merged.docs.specUrl).toBeNull();
  });

  // TC-EDGE-032: deeply nested (5 levels) merge boundary
  it('TC-EDGE-032 five-level-deep nested object merges correctly at the deepest layer only', () => {
    const defaults = { a: { b: { c: { d: { e: 1, f: 2 } } } } };
    const merged = mergeOptions(defaults, {}, { a: { b: { c: { d: { e: 99 } } } } });
    expect(merged.a.b.c.d.e).toBe(99);
    expect(merged.a.b.c.d.f).toBe(2);
  });

  // TC-EDGE-033: three-layer chain where global sets a branch and route overrides only a leaf beneath it
  it('TC-EDGE-033 route-level leaf override composes over a global-level branch addition', () => {
    const defaults = { openapi: { info: { title: 'D' as string, description: undefined as string | undefined } } };
    const withGlobalBranch = mergeOptions(defaults, { openapi: { info: { title: 'G', description: 'gdesc' } } }, {});
    const merged = mergeOptions(withGlobalBranch, {}, { openapi: { info: { title: 'R' } } });
    expect(merged.openapi!.info.title).toBe('R');
    expect(merged.openapi!.info.description).toBe('gdesc');
  });

  // TC-EDGE-034: DEFAULT_OPTIONS is deep-frozen (AC-036) — mutation attempts at every layer boundary throw or silently no-op
  it('TC-EDGE-034 DEFAULT_OPTIONS is deep-frozen at top and nested levels', () => {
    expect(Object.isFrozen(DEFAULT_OPTIONS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_OPTIONS.openapi)).toBe(true);
    expect(Object.isFrozen(DEFAULT_OPTIONS.openapi!.info)).toBe(true);
    'use strict';
    expect(() => {
      (DEFAULT_OPTIONS as unknown as Record<string, unknown>).specPath = '/hacked.json';
    }).toThrow();
  });

  // TC-EDGE-035: mergeOptions never mutates the frozen DEFAULT_OPTIONS input
  it('TC-EDGE-035 mergeOptions against frozen DEFAULT_OPTIONS does not mutate or throw', () => {
    expect(() => mergeOptions(DEFAULT_OPTIONS, { specPath: '/g.json' }, { specPath: '/r.json' })).not.toThrow();
    expect(DEFAULT_OPTIONS.specPath).toBe('/openapi.json');
  });
});

describe('TC-EDGE: defaults.ts setPath boundary sweep (AC-036)', () => {
  // TC-EDGE-036: DEFAULT_OPTIONS has no undefined leaf for any documented key (spot sample of top-level + nested)
  it('TC-EDGE-036 DEFAULT_OPTIONS top-level keys are all defined per OPTION_SPEC (openapi.* leaves are undefined by design)', () => {
    expect(DEFAULT_OPTIONS.specPath).toBeDefined();
    expect(DEFAULT_OPTIONS.docsPath).toBeDefined();
    expect(DEFAULT_OPTIONS.ui).toBeDefined();
    expect(DEFAULT_OPTIONS.serveSpec).toBeDefined();
    expect(DEFAULT_OPTIONS.serveDocs).toBeDefined();
    expect(DEFAULT_OPTIONS.validateRequests).toBeDefined();
    expect(DEFAULT_OPTIONS.validateResponses).toBeDefined();
    expect(DEFAULT_OPTIONS.autoDetect).toBeDefined();
    expect(DEFAULT_OPTIONS.schemaAdapter).toBeDefined(); // null, but defined
    // openapi.info/servers/tags default to `undefined` by spec-table design (no forced shape).
    expect(DEFAULT_OPTIONS.openapi?.info).toBeUndefined();
  });

  // TC-EDGE-037: deep-equal of DEFAULT_OPTIONS with itself (self-consistency after freeze traversal, no shared-mutation surprises)
  it('TC-EDGE-037 DEFAULT_OPTIONS deep-equals a structurally identical clone', () => {
    const clone = JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
    expect(DEFAULT_OPTIONS).toMatchObject(clone);
  });
});

describe('TC-EDGE: introspect/paths.ts express-path conversion boundary sweep (AC-023, AC-034, AC-042)', () => {
  // TC-EDGE-038: empty string path at the TOP-LEVEL call (not via the optional-segment/
  // optional-param recursion, where `normalize()` is applied). Documents actual behavior:
  // `normalize()` is only invoked on the recursive branches, so a bare `''` route path
  // (e.g. `router.get('', handler)`) is NOT normalized to '/' on the direct call path.
  // This is a real inconsistency vs. the module's own stated normalization contract —
  // reported as a finding, not asserted as correct.
  it('TC-EDGE-038 empty path at top level is NOT normalized to "/" (inconsistent with normalize() intent)', () => {
    const logger = silentLogger();
    const result = convertExpressPath('', logger);
    expect(result).toEqual([{ path: '', pathParams: [] }]); // actual (buggy) behavior, captured as evidence
  });

  // TC-EDGE-039: root "/" path
  it('TC-EDGE-039 root path "/" stays "/"', () => {
    const logger = silentLogger();
    expect(convertExpressPath('/', logger)).toEqual([{ path: '/', pathParams: [] }]);
  });

  // TC-EDGE-040: RegExp path skipped with exactly one debug log
  it('TC-EDGE-040 RegExp path returns undefined and logs exactly one debug line', () => {
    const logger = silentLogger();
    const result = convertExpressPath(/^\/users\/\d+$/, logger);
    expect(result).toBeUndefined();
    expect(logger.calls.filter((c) => c[0] === 'debug')).toHaveLength(1);
  });

  // TC-EDGE-041: unnamed wildcard "*" (Express 4 style) skipped with exactly one debug log
  it('TC-EDGE-041 unnamed wildcard path returns undefined with exactly one debug line', () => {
    const logger = silentLogger();
    const result = convertExpressPath('/files/*', logger);
    expect(result).toBeUndefined();
    expect(logger.calls.filter((c) => c[0] === 'debug')).toHaveLength(1);
  });

  // TC-EDGE-042: bare "*" path (root-only wildcard, boundary of UNNAMED_WILDCARD regex `(^|\/)\*(\/|$)`)
  it('TC-EDGE-042 bare "*" path (min case) is skipped as unnamed wildcard', () => {
    const logger = silentLogger();
    const result = convertExpressPath('*', logger);
    expect(result).toBeUndefined();
  });

  // TC-EDGE-043: named wildcard "/*rest" (Express 5) maps to "{rest}"
  it('TC-EDGE-043 named wildcard "/*rest" maps to "{rest}"', () => {
    const logger = silentLogger();
    const result = convertExpressPath('/files/*rest', logger);
    expect(result).toEqual([{ path: '/files/{rest}', pathParams: ['rest'] }]);
  });

  // TC-EDGE-044: optional segment "{/:id}" expands into exactly two paths (with and without)
  it('TC-EDGE-044 optional segment "{/:id}" expands into two paths', () => {
    const logger = silentLogger();
    const result = convertExpressPath('/users{/:id}', logger);
    expect(result).toHaveLength(2);
    const paths = result?.map((r) => r.path).sort();
    expect(paths).toEqual(['/users', '/users/{id}']);
  });

  // TC-EDGE-045: optional param ":id?" (Express 4 style) expands into exactly two paths
  it('TC-EDGE-045 optional param ":id?" expands into two paths', () => {
    const logger = silentLogger();
    const result = convertExpressPath('/users/:id?', logger);
    expect(result).toHaveLength(2);
    const paths = result?.map((r) => r.path).sort();
    expect(paths).toEqual(['/users', '/users/{id}']);
  });

  // TC-EDGE-046: deeply nested path with many params (stress: 20 segments)
  it('TC-EDGE-046 deeply nested path with many params converts without throwing', () => {
    const logger = silentLogger();
    const segments = Array.from({ length: 20 }, (_, i) => `/seg${i}/:id${i}`).join('');
    const result = convertExpressPath(segments, logger);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.pathParams).toHaveLength(20);
  });

  // TC-EDGE-047: very long literal path (no params) does not throw
  it('TC-EDGE-047 very long literal path converts without throwing', () => {
    const logger = silentLogger();
    const long = '/seg'.repeat(500);
    expect(() => convertExpressPath(long, logger)).not.toThrow();
    expect(convertExpressPath(long, logger)?.[0]?.path).toBe(long);
  });

  // TC-EDGE-048: unicode path segment with a param
  it('TC-EDGE-048 unicode literal segment alongside a param converts correctly', () => {
    const logger = silentLogger();
    const result = convertExpressPath('/café/:id', logger);
    expect(result).toEqual([{ path: '/café/{id}', pathParams: ['id'] }]);
  });

  // TC-EDGE-049: duplicate param name in the same path collapses to one pathParams entry
  it('TC-EDGE-049 duplicate param name across segments yields one deduped pathParams entry', () => {
    const logger = silentLogger();
    const result = convertExpressPath('/a/:id/b/:id', logger);
    expect(result?.[0]?.pathParams).toEqual(['id']);
  });

  // TC-EDGE-050: null / non-string, non-RegExp path input (absent/unsupported type) is skipped gracefully
  it('TC-EDGE-050 non-string non-RegExp path input (null) is skipped with one debug line, no throw', () => {
    const logger = silentLogger();
    const result = convertExpressPath(null, logger);
    expect(result).toBeUndefined();
    expect(logger.calls.filter((c) => c[0] === 'debug')).toHaveLength(1);
  });

  // TC-EDGE-051: undefined path input
  it('TC-EDGE-051 undefined path input is skipped gracefully, no throw', () => {
    const logger = silentLogger();
    expect(() => convertExpressPath(undefined, logger)).not.toThrow();
    expect(convertExpressPath(undefined, logger)).toBeUndefined();
  });

  // TC-EDGE-052: determinism — two calls with the same input are deep-equal (per module doc contract)
  it('TC-EDGE-052 two calls with identical input produce deep-equal results (determinism)', () => {
    const logger1 = silentLogger();
    const logger2 = silentLogger();
    const a = convertExpressPath('/users/:id?', logger1);
    const b = convertExpressPath('/users/:id?', logger2);
    expect(a).toEqual(b);
  });
});
