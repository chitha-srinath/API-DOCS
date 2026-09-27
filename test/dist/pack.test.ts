import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

describe('npm pack --dry-run (AC-020)', () => {
  const [packed] = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' }),
  ) as Array<{ files: Array<{ path: string }> }>;
  const files = packed!.files.map((f) => f.path).sort();

  it('ships dist, README, CHANGELOG, LICENSE and package.json only', () => {
    expect(files.every((f) => f.startsWith('dist/') || ['README.md', 'CHANGELOG.md', 'LICENSE', 'package.json'].includes(f))).toBe(true);
    for (const f of ['dist/index.js', 'dist/index.cjs', 'dist/zod.js', 'dist/auto-record.js', 'README.md', 'LICENSE']) {
      expect(files).toContain(f);
    }
  });

  it('contains no bundled UI assets', () => {
    expect(files.filter((f) => /\.css$|scalar|swagger-ui|\.html$/i.test(f))).toEqual([]);
  });
});
