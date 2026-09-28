// ST-006 (S-06, component C6): recursive canonical key sort; arrays keep
// semantic order; `undefined` is never emitted.
import { describe, expect, it } from 'vitest';

import { canonicalize } from '../../src/spec/canonical.js';

describe('spec/canonical', () => {
  it('keys are recursively sorted', () => {
    expect(canonicalize({ b: 1, a: { d: 1, c: 2 } })).toEqual({ a: { c: 2, d: 1 }, b: 1 });
    expect(JSON.stringify(canonicalize({ b: 1, a: { d: 1, c: 2 } }))).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it('arrays keep semantic order, elements are recursively canonicalized', () => {
    expect(canonicalize([{ b: 1, a: 2 }, { z: 1 }])).toEqual([{ a: 2, b: 1 }, { z: 1 }]);
  });

  it('drops undefined values instead of emitting them', () => {
    expect(canonicalize({ a: 1, b: undefined })).toEqual({ a: 1 });
    expect(Object.keys(canonicalize({ a: 1, b: undefined }) as object)).toEqual(['a']);
  });

  it('passes through primitives and null', () => {
    expect(canonicalize('x')).toBe('x');
    expect(canonicalize(5)).toBe(5);
    expect(canonicalize(null)).toBe(null);
  });
});
