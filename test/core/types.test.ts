import { describe, expect, it } from 'vitest';
import { META, MOUNT, CHILD, RECORDER, BRAND, BRAND_KEY } from '../../src/core/types.js';

describe('core/types symbols', () => {
  it('are versioned Symbol.for identities', () => {
    expect(META).toBe(Symbol.for('express-api-docs.v1.meta'));
    expect(MOUNT).toBe(Symbol.for('express-api-docs.v1.mount'));
    expect(CHILD).toBe(Symbol.for('express-api-docs.v1.child'));
    expect(RECORDER).toBe(Symbol.for('express-api-docs.v1.recorder'));
    expect(BRAND).toBe(Symbol.for('express-api-docs.v1.brand'));
    expect(BRAND_KEY).toBe(Symbol.for('express-api-docs.v1.brandKey'));
  });

  it('BRAND and BRAND_KEY are distinct', () => {
    expect(BRAND).not.toBe(BRAND_KEY);
  });

  it('no unversioned key equals any export', () => {
    const unversioned = Symbol.for('express-api-docs.meta');
    for (const sym of [META, MOUNT, CHILD, RECORDER, BRAND, BRAND_KEY]) {
      expect(sym).not.toBe(unversioned);
    }
  });
});
