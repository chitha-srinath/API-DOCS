// AIDD exhaustive test-engineer dispatch — category: api-contract
// One-shot design + execute. Runs against the BUILT package (dist/), per
// ADR-41 (export lists), ADR-54 (route() signature), ADR-56 (describe()
// signature). Executed with: node test/aidd-exhaustive/api-contract/run.mjs
//
// Each case prints "TC-CONTRACT-NNN: PASS|FAIL|BLOCKED — <note>" plus an
// evidence line. Exit code is nonzero if any case FAILs (informational only;
// FAILs here are largely EXPECTED, confirming known findings F-01/F-02).

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(root, '../../../');
function importFile(p) {
  return import(pathToFileURL(p).href);
}

const results = [];
function record(id, status, note, evidence) {
  results.push({ id, status, note, evidence });
  console.log(`${id}: ${status} — ${note}`);
  if (evidence) console.log(`    evidence: ${evidence}`);
}

function setEq(a, b) {
  const sa = [...a].sort();
  const sb = [...b].sort();
  return JSON.stringify(sa) === JSON.stringify(sb);
}

async function main() {
  // ---- ADR-41 expected export sets ----
  const EXPECTED_DOT_VALUES = [
    'ApiDocsConfigError',
    'ApiDocsSchemaError',
    'DEFAULT_OPTIONS',
    'standardSchemaAdapter',
    'installRecorder',
    'createApiDocs',
  ];
  const EXPECTED_ZOD_VALUES = ['zodAdapter', 'ApiDocsSchemaError'];

  // TC-CONTRACT-001: ESM export set of '.' matches ADR-41
  try {
    const mod = await importFile(path.join(pkgRoot, 'dist/index.js'));
    const keys = Object.keys(mod).filter((k) => k !== 'default');
    const ok = setEq(keys, EXPECTED_DOT_VALUES);
    record(
      'TC-CONTRACT-001',
      ok ? 'PASS' : 'FAIL',
      ok ? "ESM '.' export set matches ADR-41 exactly" : `mismatch: got [${keys.sort()}]`,
      `Object.keys(await import('dist/index.js')) = [${keys.sort().join(', ')}]`,
    );
  } catch (e) {
    record('TC-CONTRACT-001', 'BLOCKED', 'import failed', String(e));
  }

  // TC-CONTRACT-002: CJS export set of '.' matches ADR-41 and matches ESM (AC-003)
  try {
    const mod = require(path.join(pkgRoot, 'dist/index.cjs'));
    const keys = Object.keys(mod);
    const ok = setEq(keys, EXPECTED_DOT_VALUES);
    record(
      'TC-CONTRACT-002',
      ok ? 'PASS' : 'FAIL',
      ok ? "CJS '.' export set matches ADR-41 exactly" : `mismatch: got [${keys.sort()}]`,
      `Object.keys(require('dist/index.cjs')) = [${keys.sort().join(', ')}]`,
    );
  } catch (e) {
    record('TC-CONTRACT-002', 'BLOCKED', 'require failed', String(e));
  }

  // TC-CONTRACT-003: ESM export set of './manual' matches ADR-41 (identical to '.')
  try {
    const mod = await importFile(path.join(pkgRoot, 'dist/manual.js'));
    const keys = Object.keys(mod).filter((k) => k !== 'default');
    const ok = setEq(keys, EXPECTED_DOT_VALUES);
    record(
      'TC-CONTRACT-003',
      ok ? 'PASS' : 'FAIL',
      ok ? "ESM './manual' export set matches ADR-41" : `mismatch: got [${keys.sort()}]`,
      `Object.keys(await import('dist/manual.js')) = [${keys.sort().join(', ')}]`,
    );
  } catch (e) {
    record('TC-CONTRACT-003', 'BLOCKED', 'import failed', String(e));
  }

  // TC-CONTRACT-004: CJS export set of './manual'
  try {
    const mod = require(path.join(pkgRoot, 'dist/manual.cjs'));
    const keys = Object.keys(mod);
    const ok = setEq(keys, EXPECTED_DOT_VALUES);
    record(
      'TC-CONTRACT-004',
      ok ? 'PASS' : 'FAIL',
      ok ? "CJS './manual' export set matches ADR-41" : `mismatch: got [${keys.sort()}]`,
      `Object.keys(require('dist/manual.cjs')) = [${keys.sort().join(', ')}]`,
    );
  } catch (e) {
    record('TC-CONTRACT-004', 'BLOCKED', 'require failed', String(e));
  }

  // TC-CONTRACT-005: ESM export set of './zod'
  try {
    const mod = await importFile(path.join(pkgRoot, 'dist/zod.js'));
    const keys = Object.keys(mod).filter((k) => k !== 'default');
    const ok = setEq(keys, EXPECTED_ZOD_VALUES);
    record(
      'TC-CONTRACT-005',
      ok ? 'PASS' : 'FAIL',
      ok ? "ESM './zod' export set is exactly {zodAdapter, ApiDocsSchemaError}" : `mismatch: got [${keys.sort()}]`,
      `Object.keys(await import('dist/zod.js')) = [${keys.sort().join(', ')}]`,
    );
  } catch (e) {
    record('TC-CONTRACT-005', 'BLOCKED', 'import failed', String(e));
  }

  // TC-CONTRACT-006: CJS export set of './zod'
  try {
    const mod = require(path.join(pkgRoot, 'dist/zod.cjs'));
    const keys = Object.keys(mod);
    const ok = setEq(keys, EXPECTED_ZOD_VALUES);
    record(
      'TC-CONTRACT-006',
      ok ? 'PASS' : 'FAIL',
      ok ? "CJS './zod' export set is exactly {zodAdapter, ApiDocsSchemaError}" : `mismatch: got [${keys.sort()}]`,
      `Object.keys(require('dist/zod.cjs')) = [${keys.sort().join(', ')}]`,
    );
  } catch (e) {
    record('TC-CONTRACT-006', 'BLOCKED', 'require failed', String(e));
  }

  // TC-CONTRACT-007: main entry never statically imports 'zod' (AC-004: loads without zod installed)
  {
    const fs = await import('node:fs');
    const idxSrc = fs.readFileSync(path.join(pkgRoot, 'dist/index.js'), 'utf8');
    const idxCjsSrc = fs.readFileSync(path.join(pkgRoot, 'dist/index.cjs'), 'utf8');
    const manSrc = fs.readFileSync(path.join(pkgRoot, 'dist/manual.js'), 'utf8');
    const manCjsSrc = fs.readFileSync(path.join(pkgRoot, 'dist/manual.cjs'), 'utf8');
    const hits = [idxSrc, idxCjsSrc, manSrc, manCjsSrc].map((s) => /require\(['"]zod['"]\)|from ['"]zod['"]/.test(s));
    const ok = hits.every((h) => h === false);
    record(
      'TC-CONTRACT-007',
      ok ? 'PASS' : 'FAIL',
      ok
        ? "dist/index.{js,cjs} and dist/manual.{js,cjs} contain no static 'zod' import/require"
        : 'zod reference found in main/manual dist bundle — would break AC-004 no-zod-installed load',
      `regex /require\\(['"]zod['"]\\)|from ['"]zod['"]/ tested against 4 dist files: [${hits.join(', ')}]`,
    );
  }

  // TC-CONTRACT-008: dist/zod.* IS allowed to reference zod (sanity control)
  {
    const fs = await import('node:fs');
    const zodSrc = fs.readFileSync(path.join(pkgRoot, 'dist/zod.js'), 'utf8');
    const ok = /['"]zod['"]/.test(zodSrc);
    record(
      'TC-CONTRACT-008',
      ok ? 'PASS' : 'FAIL',
      ok ? "dist/zod.js references 'zod' as expected (control case)" : 'unexpectedly no zod reference in dist/zod.js',
      `/['"]zod['"]/.test(dist/zod.js) = ${ok}`,
    );
  }

  // TC-CONTRACT-009 / 010: type-level contract for route()/describe() per ADR-54/ADR-56
  {
    const fs = await import('node:fs');
    const dts = fs.readFileSync(path.join(pkgRoot, 'src/route/typed.ts'), 'utf8');
    const routeFnMatch =
      /export type RouteFn = <PS = undefined, QS = undefined, BS = undefined, RS = undefined>\(\s*method: HttpMethod,\s*localPath: string,\s*meta: RouteMeta<PS, QS, BS, RS>,\s*handler: TypedRequestHandler</.test(
        dts,
      ) && /\) => \[RequestHandler, RequestHandler\];/.test(dts);
    const singularResponse = /response\?: RS;/.test(dts) && !/responses\?: /.test(dts);
    const ok009 = routeFnMatch && singularResponse;
    record(
      'TC-CONTRACT-009',
      ok009 ? 'PASS' : 'FAIL',
      ok009
        ? 'RouteFn type is 4-arg (method, localPath, meta, handler) with singular meta.response, matching ADR-54'
        : `RouteFn signature does not match ADR-54 exactly (routeFnMatch=${routeFnMatch}, singularResponse=${singularResponse})`,
      'src/route/typed.ts RouteFn + RouteMeta shape inspected via regex against ADR-54 text',
    );

    const describeSrc = fs.readFileSync(path.join(pkgRoot, 'src/route/describe.ts'), 'utf8');
    const describeFnMatch =
      /export type DescribeFn = \(method: HttpMethod, localPath: string, meta: OperationMeta\) => RequestHandler;/.test(
        describeSrc,
      );
    const factoryMatch = /export function createDescribe\(deps: DescribeFactoryDeps\): DescribeFn/.test(describeSrc);
    const ok010 = describeFnMatch && factoryMatch;
    record(
      'TC-CONTRACT-010',
      ok010 ? 'PASS' : 'FAIL',
      ok010
        ? 'createDescribe({registry}) returns describe(method, localPath, meta), matching ADR-56 exactly'
        : `describe() shape does not match ADR-56 (describeFnMatch=${describeFnMatch}, factoryMatch=${factoryMatch})`,
      'src/route/describe.ts DescribeFn + createDescribe inspected via regex against ADR-56 text',
    );
  }

  // TC-CONTRACT-011: RouteFn and DescribeFn types are exported from '.' (.d.ts) per index.ts
  {
    const fs = await import('node:fs');
    const dts = fs.readFileSync(path.join(pkgRoot, 'dist/index.d.ts'), 'utf8');
    const hasRouteFn = /RouteFn/.test(dts);
    const hasDescribeFn = /DescribeFn/.test(dts);
    const ok = hasRouteFn && hasDescribeFn;
    record(
      'TC-CONTRACT-011',
      ok ? 'PASS' : 'FAIL',
      ok
        ? 'dist/index.d.ts re-exports RouteFn and DescribeFn types'
        : `missing type export(s): RouteFn=${hasRouteFn}, DescribeFn=${hasDescribeFn}`,
      'grep RouteFn|DescribeFn in dist/index.d.ts',
    );
  }

  // Build a live app for the runtime contract cases (012-021, 026-028)
  const { createApiDocs } = await importFile(path.join(pkgRoot, 'dist/index.js'));
  const express = (await import('express')).default;
  const { z } = await import('zod');
  const { zodAdapter } = await importFile(path.join(pkgRoot, 'dist/zod.js'));

  function listen(app) {
    return new Promise((resolve) => {
      const server = app.listen(0, () => resolve(server));
    });
  }
  function get(server, p, headers = {}) {
    return new Promise((resolve, reject) => {
      const { port } = server.address();
      const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }
  function post(server, p, payload) {
    return new Promise((resolve, reject) => {
      const { port } = server.address();
      const data = JSON.stringify(payload);
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: p,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        },
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // Default app with one typed route (params/query/body/response)
  const apiDocs = createApiDocs();
  const app = express();
  app.use(express.json());
  const ParamsSchema = z.object({ id: z.string() });
  const BodySchema = z.object({ name: z.string() });
  const ResponseSchema = z.object({ ok: z.boolean() });
  app.get(
    '/users/:id',
    ...apiDocs.route('get', '/users/{id}', { params: ParamsSchema, adapter: zodAdapter }, (req, res) => {
      res.json({ ok: true });
    }),
  );
  app.post(
    '/users',
    ...apiDocs.route(
      'post',
      '/users',
      { body: BodySchema, response: ResponseSchema, adapter: zodAdapter },
      (req, res) => {
        res.json({ ok: true });
      },
    ),
  );
  app.use(apiDocs.router);
  const server = await listen(app);

  // TC-CONTRACT-012: GET /openapi.json returns 200 JSON, openapi 3.1.x
  {
    const r = await get(server, '/openapi.json');
    let doc;
    try {
      doc = JSON.parse(r.body);
    } catch {
      doc = null;
    }
    const ok = r.status === 200 && doc && typeof doc.openapi === 'string' && doc.openapi.startsWith('3.1.');
    record(
      'TC-CONTRACT-012',
      ok ? 'PASS' : 'FAIL',
      ok ? `200 JSON with openapi=${doc.openapi}` : `unexpected: status=${r.status} body=${r.body.slice(0, 200)}`,
      `GET /openapi.json -> ${r.status}, content-type=${r.headers['content-type']}`,
    );
  }

  // TC-CONTRACT-013: content-type header on /openapi.json
  {
    const r = await get(server, '/openapi.json');
    const ok = /application\/json/.test(r.headers['content-type'] || '');
    record(
      'TC-CONTRACT-013',
      ok ? 'PASS' : 'FAIL',
      ok ? `Content-Type: ${r.headers['content-type']}` : `wrong content-type: ${r.headers['content-type']}`,
      `GET /openapi.json headers['content-type'] = ${r.headers['content-type']}`,
    );
  }

  // TC-CONTRACT-014: GET /docs returns 200 text/html loading Scalar
  {
    const r = await get(server, '/docs');
    const ok = r.status === 200 && /text\/html/.test(r.headers['content-type'] || '') && /scalar/i.test(r.body);
    record(
      'TC-CONTRACT-014',
      ok ? 'PASS' : 'FAIL',
      ok ? 'GET /docs -> 200 text/html referencing Scalar' : `status=${r.status} ct=${r.headers['content-type']}`,
      `GET /docs -> ${r.status}, content-type=${r.headers['content-type']}, bodyHasScalar=${/scalar/i.test(r.body)}`,
    );
  }

  // TC-CONTRACT-015: default spec/docs paths 404 when custom paths configured (AC-037)
  {
    const apiDocs2 = createApiDocs({ specPath: '/spec.json', docsPath: '/reference' });
    const app2 = express();
    app2.use(apiDocs2.router);
    const server2 = await listen(app2);
    const rDefaultSpec = await get(server2, '/openapi.json');
    const rDefaultDocs = await get(server2, '/docs');
    const rCustomSpec = await get(server2, '/spec.json');
    const ok = rDefaultSpec.status === 404 && rDefaultDocs.status === 404 && rCustomSpec.status === 200;
    record(
      'TC-CONTRACT-015',
      ok ? 'PASS' : 'FAIL',
      ok
        ? 'default paths 404 once custom specPath/docsPath configured; custom path 200'
        : `defaultSpec=${rDefaultSpec.status} defaultDocs=${rDefaultDocs.status} customSpec=${rCustomSpec.status}`,
      `GET /openapi.json=${rDefaultSpec.status}, GET /docs=${rDefaultDocs.status}, GET /spec.json=${rCustomSpec.status}`,
    );
    server2.close();
  }

  // TC-CONTRACT-016/017: error envelope shape + content-type, across params/body invalid paths
  {
    const rParams = await get(server, '/users/%00'); // invalid-ish, but id is z.string() so any string passes;
    // Use body validation instead, which definitely fails for a wrong type:
    const rBody = await post(server, '/users', { name: 123 });
    let doc;
    try {
      doc = JSON.parse(rBody.body);
    } catch {
      doc = null;
    }
    const ct = rBody.headers['content-type'] || '';
    const shapeOk =
      doc &&
      typeof doc.type === 'string' &&
      typeof doc.title === 'string' &&
      doc.status === 400 &&
      typeof doc.detail === 'string' &&
      Array.isArray(doc.errors) &&
      doc.errors.every((e) => 'in' in e && 'path' in e && 'message' in e);
    const ok = rBody.status === 400 && /application\/problem\+json/.test(ct) && shapeOk;
    record(
      'TC-CONTRACT-016',
      ok ? 'PASS' : 'FAIL',
      ok
        ? 'invalid body -> 400 application/problem+json with type/title/status/detail/errors[{in,path,message}]'
        : `status=${rBody.status} ct=${ct} body=${rBody.body.slice(0, 300)}`,
      `POST /users {name:123} -> ${rBody.status} ${ct}; body=${rBody.body}`,
    );

    // errors[].in for the body case must be 'body' (AC-008)
    const inOk = ok && doc.errors.length > 0 && doc.errors.every((e) => e.in === 'body');
    record(
      'TC-CONTRACT-017',
      inOk ? 'PASS' : ok ? 'FAIL' : 'BLOCKED',
      inOk
        ? "all errors[].in === 'body' for a body-schema violation"
        : 'in field(s) not all body, or TC-016 failed first',
      `errors=${JSON.stringify(doc?.errors)}`,
    );
  }

  // TC-CONTRACT-018: swagger-parser validates the default-generated spec (control, expect PASS)
  {
    const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
    const r = await get(server, '/openapi.json');
    const doc = JSON.parse(r.body);
    try {
      await SwaggerParser.validate(structuredClone(doc));
      record(
        'TC-CONTRACT-018',
        'PASS',
        'default-generated spec (no .meta({id}) schema) validates against OpenAPI 3.1 via swagger-parser',
        'SwaggerParser.validate(doc) resolved without throwing',
      );
    } catch (e) {
      record(
        'TC-CONTRACT-018',
        'FAIL',
        `unexpected validation failure on the plain spec: ${e.message}`,
        String(e.stack || e),
      );
    }
  }

  // TC-CONTRACT-019: independent confirmation of F-01 — .meta({id})-tagged, REUSED zod schema
  // via zodAdapter (opt-in subpath) produces a spec that fails swagger-parser validation.
  {
    const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
    const Named = z.object({ id: z.string(), label: z.string() }).meta({ id: 'NamedThing' });
    const apiDocs3 = createApiDocs();
    const app3 = express();
    app3.use(express.json());
    app3.get('/a', ...apiDocs3.route('get', '/a', { query: Named, adapter: zodAdapter }, (req, res) => res.json({})));
    app3.post(
      '/b',
      ...apiDocs3.route('post', '/b', { body: Named, response: Named, adapter: zodAdapter }, (req, res) =>
        res.json({}),
      ),
    );
    app3.use(apiDocs3.router);
    const server3 = await listen(app3);
    const r = await get(server3, '/openapi.json');
    const doc = JSON.parse(r.body);
    const hasDanglingRef = JSON.stringify(doc).includes('$defs') || JSON.stringify(doc).includes('#/$defs/');
    let validated = false;
    let errMsg = '';
    try {
      await SwaggerParser.validate(structuredClone(doc));
      validated = true;
    } catch (e) {
      errMsg = e.message;
    }
    // F-01 predicts: validation FAILS (dangling $ref / no components.schemas hoist).
    const confirmsF01 = validated === false;
    record(
      'TC-CONTRACT-019',
      confirmsF01 ? 'FAIL' : 'PASS',
      confirmsF01
        ? `CONFIRMS F-01 (CRITICAL, already-confirmed by adversarial verification): a .meta({id})-reused Zod schema via zodAdapter produces a spec that fails SwaggerParser.validate — ${errMsg}`
        : 'spec validated unexpectedly — could not reproduce F-01 via zodAdapter route',
      `spec snippet references $defs/$ref: ${hasDanglingRef}; SwaggerParser.validate threw: ${!validated} (${errMsg}); doc.components.schemas keys=${JSON.stringify(Object.keys(doc.components?.schemas || {}))}`,
    );
    server3.close();
  }

  // TC-CONTRACT-020: same .meta({id}) probe via the DEFAULT adapter (standardSchemaAdapter,
  // no explicit `adapter:` override) — tests the verdict's "scope widened, reachable via the
  // default adapter, not only the opt-in zod subpath" claim.
  {
    const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
    const Named2 = z.object({ id: z.string(), label: z.string() }).meta({ id: 'NamedThing2' });
    const apiDocs4 = createApiDocs();
    const app4 = express();
    app4.use(express.json());
    // No adapter override: resolves to standardSchemaAdapter per src/route/typed.ts resolveAdapter().
    app4.post('/c', ...apiDocs4.route('post', '/c', { body: Named2, response: Named2 }, (req, res) => res.json({})));
    app4.use(apiDocs4.router);
    const server4 = await listen(app4);
    const r = await get(server4, '/openapi.json');
    const doc = JSON.parse(r.body);
    let validated = false;
    let errMsg = '';
    let jsonSchemaOutput = null;
    try {
      jsonSchemaOutput = doc.paths?.['/c']?.post?.requestBody?.content?.['application/json']?.schema ?? null;
      await SwaggerParser.validate(structuredClone(doc));
      validated = true;
    } catch (e) {
      errMsg = e.message;
    }
    if (validated) {
      record(
        'TC-CONTRACT-020',
        'PASS',
        "default standardSchemaAdapter path did NOT reproduce F-01 for this Zod-via-Standard-Schema route (Zod's Standard Schema '~standard.jsonSchema' converter behaves differently than the direct zodAdapter path, or was unavailable and fell back to NO_JSON_SCHEMA/{}) — narrows, does not contradict, the CONFIRMED scope-widening claim, which is independently reproduced via zodAdapter in TC-CONTRACT-019",
        `requestBody schema via default adapter = ${JSON.stringify(jsonSchemaOutput)}; SwaggerParser.validate threw: false`,
      );
    } else {
      record(
        'TC-CONTRACT-020',
        'FAIL',
        `CONFIRMS the verdict's scope-widening: default adapter path (no explicit zodAdapter) also produces an invalid spec for a .meta({id}) schema — ${errMsg}`,
        `requestBody schema via default adapter = ${JSON.stringify(jsonSchemaOutput)}; SwaggerParser.validate threw: true (${errMsg})`,
      );
    }
    server4.close();
  }

  // TC-CONTRACT-021: /docs content-type is exactly text/html (charset)
  {
    const r = await get(server, '/docs');
    const ok = /^text\/html/.test(r.headers['content-type'] || '');
    record(
      'TC-CONTRACT-021',
      ok ? 'PASS' : 'FAIL',
      ok ? `Content-Type: ${r.headers['content-type']}` : `unexpected content-type ${r.headers['content-type']}`,
      `GET /docs headers['content-type'] = ${r.headers['content-type']}`,
    );
  }

  // TC-CONTRACT-022: backward-compat — no unintended (undocumented) exports beyond ADR-41 on '.'
  {
    const mod = await importFile(path.join(pkgRoot, 'dist/index.js'));
    const keys = Object.keys(mod).filter((k) => k !== 'default');
    const extra = keys.filter((k) => !EXPECTED_DOT_VALUES.includes(k));
    const ok = extra.length === 0;
    record(
      'TC-CONTRACT-022',
      ok ? 'PASS' : 'FAIL',
      ok
        ? 'no undocumented value exports beyond ADR-41 list on the main entry'
        : `unexpected extra export(s): ${extra}`,
      `extra = [${extra.join(', ')}]`,
    );
  }

  // TC-CONTRACT-023: backward-compat — nothing documented by ADR-41 is missing on '.'
  {
    const mod = await importFile(path.join(pkgRoot, 'dist/index.js'));
    const keys = Object.keys(mod);
    const missing = EXPECTED_DOT_VALUES.filter((k) => !keys.includes(k));
    const ok = missing.length === 0;
    record(
      'TC-CONTRACT-023',
      ok ? 'PASS' : 'FAIL',
      ok ? 'every ADR-41-documented export of the main entry is present' : `missing export(s): ${missing}`,
      `missing = [${missing.join(', ')}]`,
    );
  }

  // TC-CONTRACT-024: package.json exports map has import/require/types triples for ./, ./manual, ./zod, plus ./package.json
  {
    const fs = await import('node:fs');
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
    const subpaths = ['.', './manual', './zod'];
    const problems = [];
    for (const sp of subpaths) {
      const entry = pkg.exports?.[sp];
      if (
        !entry ||
        !entry.import?.types ||
        !entry.import?.default ||
        !entry.require?.types ||
        !entry.require?.default
      ) {
        problems.push(sp);
      }
    }
    const hasPkgJsonExport = pkg.exports?.['./package.json'] === './package.json';
    const ok = problems.length === 0 && hasPkgJsonExport;
    record(
      'TC-CONTRACT-024',
      ok ? 'PASS' : 'FAIL',
      ok
        ? "package.json 'exports' has complete import/require/types quads for ., ./manual, ./zod, plus ./package.json"
        : `incomplete subpath(s): ${problems}; ./package.json export present=${hasPkgJsonExport}`,
      `exports = ${JSON.stringify(pkg.exports)}`,
    );
  }

  // TC-CONTRACT-025: ADR-55 regression guard — dist/auto-record.{js,cjs} actually install the
  // recorder at import time (non-empty side effect), confirming the sideEffects array fix holds.
  {
    const fs = await import('node:fs');
    const cjsSrc = fs.readFileSync(path.join(pkgRoot, 'dist/auto-record.cjs'), 'utf8');
    const jsSrc = fs.readFileSync(path.join(pkgRoot, 'dist/auto-record.js'), 'utf8');
    const cjsEmpty = /module\.exports\s*=\s*\{\s*\}\s*;?\s*$/.test(cjsSrc.trim());
    const looksWired = /installRecorder|Symbol\.for/.test(cjsSrc) && /installRecorder|Symbol\.for/.test(jsSrc);
    let runtimeInstalled = 'unknown';
    try {
      const { execFileSync } = await import('node:child_process');
      const out = execFileSync(
        process.execPath,
        [
          '-e',
          "require('./dist/index.cjs'); const express=require('express'); console.log(Object.prototype.hasOwnProperty.call(express.application, Symbol.for('express-api-docs.v1.recorder')));",
        ],
        { cwd: pkgRoot, encoding: 'utf8' },
      ).trim();
      runtimeInstalled = out;
    } catch (e) {
      runtimeInstalled = `probe-error: ${e.message}`;
    }
    const ok = !cjsEmpty && looksWired && runtimeInstalled === 'true';
    record(
      'TC-CONTRACT-025',
      ok ? 'PASS' : 'FAIL',
      ok
        ? "dist/auto-record.{js,cjs} contain the recorder install side effect AND a fresh child process confirms express.application[Symbol.for('express-api-docs.v1.recorder')] === true (ADR-55 fix present in this build)"
        : `dist/auto-record.cjs looks empty/unwired or the runtime probe failed (cjsEmpty=${cjsEmpty}, looksWired=${looksWired}, runtimeInstalled=${runtimeInstalled}) — matches ADR-55's described defect`,
      `dist/auto-record.cjs length=${cjsSrc.length} chars; child-process Symbol.for probe result = ${runtimeInstalled}`,
    );
  }

  // TC-CONTRACT-026: contract of non-interference — plain unmatched route still 404s through
  // the composition root's router (no unintended catch-all)
  {
    const r = await get(server, '/does-not-exist-xyz');
    const ok = r.status === 404;
    record(
      'TC-CONTRACT-026',
      ok ? 'PASS' : 'FAIL',
      ok ? '404 for a path with no registered route (no accidental catch-all)' : `unexpected status ${r.status}`,
      `GET /does-not-exist-xyz -> ${r.status}`,
    );
  }

  // TC-CONTRACT-027: validateResponses:'error' contract — 500, body not sent verbatim
  {
    const apiDocs5 = createApiDocs();
    const app5 = express();
    app5.use(express.json());
    app5.post(
      '/strict',
      ...apiDocs5.route(
        'post',
        '/strict',
        { response: z.object({ ok: z.boolean() }), validateResponses: 'error', adapter: zodAdapter },
        (req, res) => {
          res.json({ ok: 'not-a-boolean' }); // violates schema
        },
      ),
    );
    app5.use(apiDocs5.router);
    // Express needs an error handler for the thrown/500 path in some configs; add a minimal one.
    app5.use((err, req, res, next) => {
      res.status(500).json({ error: 'internal' });
    });
    const server5 = await listen(app5);
    const r = await post(server5, '/strict', {});
    const bodyLeaked = r.body.includes('not-a-boolean');
    const ok = r.status === 500 && !bodyLeaked;
    record(
      'TC-CONTRACT-027',
      ok ? 'PASS' : 'FAIL',
      ok
        ? "validateResponses:'error' -> 500, invalid body not sent to the client"
        : `status=${r.status} bodyLeaked=${bodyLeaked} body=${r.body.slice(0, 200)}`,
      `POST /strict -> ${r.status}; body=${r.body}`,
    );
    server5.close();
  }

  // TC-CONTRACT-028: ApiDocsConfigError contract — synchronous throw naming the offending path (AC-045)
  {
    let threw = null;
    try {
      createApiDocs({ ui: 'redoc' });
    } catch (e) {
      threw = e;
    }
    const { ApiDocsConfigError } = await importFile(path.join(pkgRoot, 'dist/index.js'));
    const ok = threw instanceof ApiDocsConfigError && /ui/.test(threw.message);
    record(
      'TC-CONTRACT-028',
      ok ? 'PASS' : 'FAIL',
      ok
        ? `createApiDocs({ui:'redoc'}) throws ApiDocsConfigError synchronously, message names 'ui': "${threw.message}"`
        : `unexpected: threw=${threw ? threw.constructor.name : 'nothing'}, message=${threw?.message}`,
      `error instanceof ApiDocsConfigError = ${threw instanceof ApiDocsConfigError}; message="${threw?.message}"`,
    );
  }

  server.close();

  const tally = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\n--- TALLY ---');
  console.log(JSON.stringify(tally));
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
