import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../../', import.meta.url));

describe('examples/basic (AC-029)', () => {
  it('starts and serves /openapi.json with status 200', async () => {
    const child = spawn(process.execPath, ['examples/basic/server.mjs'], {
      cwd: repo,
      env: { ...process.env, PORT: '0' },
    });
    try {
      const port = await new Promise<number>((resolve, reject) => {
        let out = '';
        child.stdout.on('data', (chunk) => {
          out += chunk;
          const match = /localhost:(\d+)/.exec(out);
          if (match) resolve(Number(match[1]));
        });
        child.on('exit', (code) => reject(new Error(`example exited with ${code}`)));
      });
      const spec = await fetch(`http://localhost:${port}/openapi.json`);
      expect(spec.status).toBe(200);
      const body = (await spec.json()) as { openapi: string; paths: Record<string, unknown> };
      expect(body.openapi).toBe('3.1.0');
      expect(Object.keys(body.paths)).toEqual(['/api/health', '/api/users', '/api/users/{id}']);
      const docs = await fetch(`http://localhost:${port}/docs`);
      expect(docs.status).toBe(200);
      const invalid = await fetch(`http://localhost:${port}/api/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(invalid.status).toBe(400);
    } finally {
      child.kill();
    }
  });
});
