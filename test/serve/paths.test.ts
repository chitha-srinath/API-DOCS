// ST-007 (S-07): AC-037 — custom specPath/docsPath/ui/cdnUrl.
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApiDocs } from '../../src/serve/router.js';
import { majors } from '../fixtures/majors.js';

describe.each(majors)('serve/paths ($alias)', ({ express }) => {
  it('serves at custom paths with swagger-ui and a custom cdnUrl; default paths 404', async () => {
    const ex = express as { (): import('express').Application };
    const app = ex();
    const customCdn = 'https://example.com/swagger-ui-bundle.js';
    const apiDocs = createApiDocs({
      specPath: '/spec.json',
      docsPath: '/reference',
      ui: 'swagger-ui',
      cdnUrl: customCdn,
    });
    app.use(apiDocs.router);

    const spec = await request(app).get('/spec.json');
    expect(spec.status).toBe(200);

    const docs = await request(app).get('/reference');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain(customCdn);
    expect(docs.text).toContain('/spec.json');

    const oldSpec = await request(app).get('/openapi.json');
    expect(oldSpec.status).toBe(404);

    const oldDocs = await request(app).get('/docs');
    expect(oldDocs.status).toBe(404);
  });
});
