import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ead-no-zod-'));
const pkgDir = join(dir, 'node_modules', 'express-api-docs');
mkdirSync(pkgDir, { recursive: true });
cpSync(join(repo, 'dist'), join(pkgDir, 'dist'), { recursive: true });
cpSync(join(repo, 'package.json'), join(pkgDir, 'package.json'));
symlinkSync(join(repo, 'node_modules', 'express'), join(dir, 'node_modules', 'express'), 'dir');
writeFileSync(join(dir, 'package.json'), '{"name":"consumer","private":true}');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (args: string[]) =>
  execFileSync(process.execPath, args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

describe('main entry without zod installed (AC-004)', () => {
  it('zod is not resolvable from the consumer', () => {
    expect(() => run(['-e', "require.resolve('zod')"])).toThrow();
  });

  it('require() of the main entry succeeds', () => {
    expect(run(['-e', "console.log(typeof require('express-api-docs').createApiDocs)"])).toBe(
      'function',
    );
  });

  it('import of the main entry succeeds', () => {
    expect(
      run([
        '--input-type=module',
        '-e',
        "const m = await import('express-api-docs'); console.log(typeof m.createApiDocs)",
      ]),
    ).toBe('function');
  });
});
