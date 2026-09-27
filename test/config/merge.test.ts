import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS } from '../../src/config/defaults.js';
import { mergeOptions } from '../../src/config/merge.js';

describe('mergeOptions', () => {
  it('AC-044a: global openapi.info.title keeps default info.version', () => {
    const merged = mergeOptions(DEFAULT_OPTIONS, { openapi: { info: { title: 'Mine' } } });
    expect(merged.openapi.info.title).toBe('Mine');
    expect(merged.openapi.info.version).toBe('0.0.0');
  });

  it("AC-044b: global tags ['a','b'] + route tags ['c'] gives ['c']", () => {
    expect(mergeOptions(DEFAULT_OPTIONS, { tags: ['a', 'b'] }, { tags: ['c'] }).tags).toEqual([
      'c',
    ]);
  });

  it('route security [] replaces global security', () => {
    expect(mergeOptions({ security: [{ bearer: [] }] }, { security: [] }).security).toEqual([]);
  });

  it('functions and primitives replace', () => {
    const a = () => 'a';
    const b = () => 'b';
    expect(mergeOptions({ f: a, n: 1, s: 'x' }, { f: b, n: 2, s: 'y' })).toEqual({
      f: b,
      n: 2,
      s: 'y',
    });
  });

  it('plain objects recurse across three layers', () => {
    expect(mergeOptions({ a: { b: 1, c: 1 } }, { a: { b: 2 } }, { a: { c: 3 } })).toEqual({
      a: { b: 2, c: 3 },
    });
  });

  it('undefined does not override; null does', () => {
    expect(mergeOptions({ a: 1, b: 1 }, { a: undefined, b: null })).toEqual({ a: 1, b: null });
    expect(mergeOptions({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it('an object replaces a primitive and vice versa', () => {
    expect(mergeOptions({ a: 1 } as Record<string, unknown>, { a: { b: 1 } })).toEqual({
      a: { b: 1 },
    });
    expect(mergeOptions({ a: { b: 1 } } as Record<string, unknown>, { a: false })).toEqual({
      a: false,
    });
  });

  it('does not mutate inputs', () => {
    const base = { a: { b: 1 }, list: [1] };
    const over = { a: { c: 2 }, list: [2] };
    const merged = mergeOptions(base, over);
    expect(base).toEqual({ a: { b: 1 }, list: [1] });
    expect(over).toEqual({ a: { c: 2 }, list: [2] });
    expect(merged).toEqual({ a: { b: 1, c: 2 }, list: [2] });
    expect(merged.a).not.toBe(base.a);
  });
});
