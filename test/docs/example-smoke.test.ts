// ST-008 (S-08): AC-029 — examples/ contains a runnable example that starts
// and serves /openapi.json with status 200 and a valid OpenAPI 3.1 document.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as OpenApiParser from '@readme/openapi-parser';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../examples/basic/app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.resolve(here, '../../examples/basic/app.ts'), 'utf8');

describe('examples/basic smoke test (AC-029)', () => {
  it('serves a valid OpenAPI 3.1 document at /openapi.json', async () => {
    const app = createApp();
    const res = await request(app).get('/openapi.json').expect(200);
    expect(typeof res.body.openapi).toBe('string');
    expect(res.body.openapi.startsWith('3.1.')).toBe(true);
    await expect(OpenApiParser.validate(structuredClone(res.body))).resolves.toBeDefined();
  });

  it('exercises route auto-detection with a plain Express route (no route()/describe())', async () => {
    const app = createApp();
    const res = await request(app).get('/openapi.json').expect(200);
    expect(res.body.paths).toHaveProperty(['/widgets-plain']);
    expect(res.body.paths['/widgets-plain']).toHaveProperty('get');

    const plainRouteBlock = appSource.slice(
      appSource.indexOf('/widgets-plain') - 40,
      appSource.indexOf('/widgets-plain') + 200,
    );
    expect(plainRouteBlock).not.toMatch(/\.describe\(/);
    expect(plainRouteBlock).not.toMatch(/\.\.\.route\(/);
  });

  it('imports express-api-contract before creating a Router or calling app.use', () => {
    const importIdx = appSource.search(/from\s+['"]express-api-contract['"]/);
    expect(importIdx, 'app.ts must import express-api-contract').toBeGreaterThanOrEqual(0);

    const routerIdx = appSource.search(/Router\s*\(/);
    const useIdx = appSource.search(/\.use\(/);

    if (routerIdx >= 0) expect(importIdx).toBeLessThan(routerIdx);
    if (useIdx >= 0) expect(importIdx).toBeLessThan(useIdx);
  });
});
