import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { majors } from '../fixtures/majors.js';
import { freshExpress } from '../fixtures/fresh-express.js';

const req = createRequire(import.meta.url);
const EXPRESS4 = 'express4';

describe('test/fixtures/majors', () => {
  it('is non-empty with unique majors and the root express first', () => {
    expect(majors.length).toBeGreaterThan(0);
    const seen = new Set<number>();
    for (const entry of majors) {
      expect(seen.has(entry.major)).toBe(false);
      seen.add(entry.major);
    }
    expect(majors[0]?.alias).toBe('express');
  });
});

describe('test/fixtures/fresh-express', () => {
  it('returns a fresh module distinct from the cache, then restores it', () => {
    const cachedBefore = req(EXPRESS4);
    const { express, restore } = freshExpress('express4');
    expect(express).not.toBe(cachedBefore);

    const proto = (express as { Router: { prototype: { use: unknown } } }).Router.prototype;
    expect(Object.getOwnPropertyDescriptor(proto, Symbol.for('express-api-docs.v1.recorder'))).toBeUndefined();

    restore();
    const cachedAfter = req(EXPRESS4);
    expect(cachedAfter).toBe(cachedBefore);
  });
});
