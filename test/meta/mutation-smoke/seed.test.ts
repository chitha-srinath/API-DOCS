import { describe, expect, it } from 'vitest';
import { add } from './seed.js';

describe('mutation smoke seed', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
