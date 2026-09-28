// ST-007 (S-07): AC-004 — `./zod` exports `zodAdapter`; `.` does not.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();

describe('entries/zod-subpath', () => {
  it('./zod exports zodAdapter', () => {
    const mod = require(join(root, 'dist/zod.cjs')) as Record<string, unknown>;
    expect(typeof mod.zodAdapter).toBe('object');
  });

  it('. does not export zodAdapter', () => {
    const mod = require(join(root, 'dist/index.cjs')) as Record<string, unknown>;
    expect('zodAdapter' in mod).toBe(false);
  });
});
