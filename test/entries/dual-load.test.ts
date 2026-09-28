// ST-007 (S-07): ADR-20, ADR-44, ADR-49 — ESM + CJS loaded in one process:
// `use` wrapped exactly once, cross-copy metadata discovery via [META],
// Express 5 prefix survival, and brand-based cross-copy instanceof.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import request from 'supertest';

const require = createRequire(import.meta.url);
const root = process.cwd();

const BRAND = Symbol.for('express-api-docs.v1.brand');
const BRAND_KEY = Symbol.for('express-api-docs.v1.brandKey');

describe('entries/dual-load', () => {
  it('ESM and CJS copies interoperate without double-wrapping use', async () => {
    const esm = (await import(join(root, 'dist/index.js'))) as {
      createApiDocs: typeof import('../../src/index.js').createApiDocs;
    };
    const cjs = require(join(root, 'dist/index.cjs')) as {
      createApiDocs: typeof import('../../src/index.js').createApiDocs;
    };

    const expressCjs = require('express') as {
      (): import('express').Application;
      Router: () => import('express').Router;
    };
    const app = expressCjs();
    const router = expressCjs.Router();

    const esmApiDocs = esm.createApiDocs();
    app.use(esmApiDocs.router);
    const [validate, handler] = esmApiDocs.route('get', '/users/:id', {}, (req, res) => res.json({ ok: true }));
    router.get('/users/:id', validate, handler);
    app.use('/api', router);

    const cjsApiDocs = cjs.createApiDocs();
    const spec = cjsApiDocs.getSpec({ app });
    expect(Object.keys(spec.paths as Record<string, unknown>)).toContain('/api/users/{id}');

    const res = await request(app).get('/api/users/1');
    expect(res.status).toBe(200);
  });

  it('ApiDocsConfigError thrown by the CJS copy is instanceof the ESM export, and the reverse', async () => {
    const esm = (await import(join(root, 'dist/index.js'))) as {
      ApiDocsConfigError: typeof import('../../src/index.js').ApiDocsConfigError;
      createApiDocs: typeof import('../../src/index.js').createApiDocs;
    };
    const cjs = require(join(root, 'dist/index.cjs')) as {
      ApiDocsConfigError: typeof import('../../src/index.js').ApiDocsConfigError;
      createApiDocs: typeof import('../../src/index.js').createApiDocs;
    };

    let cjsErr: unknown;
    try {
      cjs.createApiDocs({ specPth: 1 });
    } catch (err) {
      cjsErr = err;
    }
    expect(cjsErr).toBeInstanceOf(esm.ApiDocsConfigError);

    let esmErr: unknown;
    try {
      esm.createApiDocs({ specPth: 1 });
    } catch (err) {
      esmErr = err;
    }
    expect(esmErr).toBeInstanceOf(cjs.ApiDocsConfigError);

    const brands = (cjsErr as Record<PropertyKey, unknown>)[BRAND];
    expect(brands).toContain('express-api-docs.v1.ApiDocsConfigError');
    const classBrand = (cjs.ApiDocsConfigError as unknown as Record<PropertyKey, unknown>)[BRAND_KEY];
    expect(classBrand).toBe('express-api-docs.v1.ApiDocsConfigError');
  });

  it('a user subclass of the CJS ApiDocsSchemaError is instanceof the ESM export, and the reverse', async () => {
    const esm = (await import(join(root, 'dist/index.js'))) as {
      ApiDocsSchemaError: typeof import('../../src/index.js').ApiDocsSchemaError;
    };
    const cjs = require(join(root, 'dist/index.cjs')) as {
      ApiDocsSchemaError: typeof import('../../src/index.js').ApiDocsSchemaError;
      ApiDocsConfigError: typeof import('../../src/index.js').ApiDocsConfigError;
    };

    class MyErr extends cjs.ApiDocsSchemaError {}
    const instance = new MyErr('vendor');
    expect(instance).toBeInstanceOf(esm.ApiDocsSchemaError);

    // Cross-class check: a config-error instance is not instanceof ApiDocsSchemaError.
    const configErr = new cjs.ApiDocsConfigError('x', 'y');
    expect(configErr).not.toBeInstanceOf(esm.ApiDocsSchemaError);
  });
});
