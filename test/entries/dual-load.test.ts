import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const distUrl = new URL('../../dist/', import.meta.url);

describe('dual ESM/CJS load (AC-003, ADR-20)', () => {
  it('both formats expose the same named exports', async () => {
    const esm = await import(new URL('index.js', distUrl).href);
    const cjs = require(new URL('index.cjs', distUrl).pathname);
    const names = (m: object) =>
      Object.keys(m)
        .filter((k) => k !== 'default' && k !== '__esModule')
        .sort();
    expect(names(esm)).toEqual(names(cjs));
    expect(names(esm)).toEqual(
      [
        'ApiDocsConfigError',
        'DEFAULT_OPTIONS',
        'PROBLEM_MEDIA_TYPE',
        'ApiDocsSchemaError',
        'createApiDocs',
        'installRecorder',
        'standardSchemaAdapter',
      ].sort(),
    );
    const manualEsm = await import(new URL('manual.js', distUrl).href);
    expect(names(manualEsm)).toEqual(names(esm));
    const zodEsm = await import(new URL('zod.js', distUrl).href);
    const zodCjs = require(new URL('zod.cjs', distUrl).pathname);
    expect(names(zodEsm)).toEqual(['zodAdapter']);
    expect(names(zodCjs)).toEqual(['zodAdapter']);
  });

  it('a route defined through the ESM copy is found, with its prefix, by the CJS copy', async () => {
    const esm = await import(new URL('index.js', distUrl).href);
    const cjs = require(new URL('index.cjs', distUrl).pathname);
    const express = require('express');
    // `use` is owned one prototype up on Express 4 and two up on Express 5.
    let owner = Object.getPrototypeOf(express.Router());
    while (!Object.prototype.hasOwnProperty.call(owner, 'use'))
      owner = Object.getPrototypeOf(owner);
    expect(owner[Symbol.for('express-api-docs.recorder')]).toBe(true);
    expect(owner.use.name).toBe('recordedUse');

    const app = express();
    const router = express.Router();
    const esmApi = esm.createApiDocs({ logger: { debug() {}, warn() {} } });
    router.get(
      '/users/:id',
      ...esmApi.route({ summary: 'from esm' }, (_q: any, r: any) => r.end()),
    );
    app.use('/api', router);
    const cjsApi = cjs.createApiDocs({ logger: { debug() {}, warn() {} } });
    const spec = cjsApi.getSpec({ app });
    expect(spec.paths['/api/users/{id}'].get.summary).toBe('from esm');
  });
});
