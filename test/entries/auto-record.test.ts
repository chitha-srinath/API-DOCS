import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { loadExpress } from '../../src/auto-record.js';

const express = createRequire(import.meta.url)('express');
const repo = fileURLToPath(new URL('../../', import.meta.url));

describe('auto-record express resolution', () => {
  it('prefers import.meta.url', () => {
    const req = vi.fn();
    expect(loadExpress(import.meta.url, req, '/nowhere')).toBe(express);
    expect(req).not.toHaveBeenCalled();
  });

  it("falls back to a bundler's require, then the working directory", () => {
    const req = vi.fn(() => 'bundled');
    expect(loadExpress(undefined, req, '/nowhere')).toBe('bundled');
    expect(req).toHaveBeenCalledWith('express');
    expect(loadExpress(undefined, undefined, repo)).toBe(express);
  });
});
