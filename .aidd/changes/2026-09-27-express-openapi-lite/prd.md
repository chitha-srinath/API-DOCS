# PRD — 2026-09-27-express-openapi-lite

## Problem & goal

Express has no typed, low-config way to validate requests and produce accurate OpenAPI 3.1 docs from the same route definitions. The goal is to build `express-api-docs`, a TypeScript-first npm package in this greenfield repo. It provides:

- a typed route helper that validates requests and infers handler types;
- Zod schemas behind a pluggable `SchemaAdapter`;
- an OpenAPI 3.1 JSON endpoint and a CDN-loaded docs UI;
- incremental adoption on existing Express 4 and 5 routers, including auto-detection of plain routes;
- a single typed config object (`createApiDocs(options)`) in which every behavior has a documented default that the user can override.

It ships as a dual ESM+CJS build with `.d.ts` files, at least 90% test coverage, CI, and publish config. Nothing is published during this run.

## Acceptance criteria

| AC id | Criterion | Source |
|---|---|---|
| AC-001 | Given the package is built, When `package.json` is inspected, Then `name` is `express-api-docs`, `license` is `MIT`, a LICENSE file with copyright chitha_srinath exists, and the string `express-openapi-lite` appears in no file outside `.aidd/`. | Q1, Q10 |
| AC-002 | Given `npm run build`, When it finishes, Then it exits 0 and emits ESM (`.js`/`.mjs`), CJS (`.cjs`) and `.d.ts` outputs, and `exports` maps `import`, `require` and `types` to those files. | intent |
| AC-003 | Given the built package, When a test loads it with both `import` (ESM) and `require` (CJS), Then both expose the same named exports. | intent |
| AC-004 | Given `package.json`, When it is inspected, Then `peerDependencies` contains `express` `^4.21.0 \|\| ^5.0.0` and `zod` `^4.2.0`, `peerDependenciesMeta.zod.optional` is `true`, `engines.node` is `>=22`, and the package has no runtime dependency on any UI asset package. `exports` has a `./zod` subpath that exports the Zod adapter, and the main entry does not export it. Given a project without `zod` installed, When the main entry is loaded with `import` (ESM) and with `require` (CJS), Then both loads succeed. | Q3, Q4, Q5, Q6, pre-review (human Node floor, PF-2), rebuild (ADR-47) |
| AC-005 | Given a `SchemaAdapter` interface exported from the package, When a test implements it with a non-Zod stub adapter, Then routes defined with the stub validate requests and appear in the generated spec without any change to core code. | Q0b |
| AC-006 | Given a route defined with the typed helper and Zod schemas for params, query, body and response, When the handler is type-checked, Then `req.params`, `req.query` and `req.body` have the inferred types, and assigning a wrong type fails `tsc --noEmit` (verified by a type test with `@ts-expect-error`). | intent |
| AC-007 | Given a typed route with a body schema, When a request with an invalid body is sent, Then the response is 400 with `Content-Type: application/problem+json` and a body containing `type`, `title`, `status: 400`, `detail`, and `errors[]` where each entry has `in`, `path` and `message`, and the handler is not called. | Q8 |
| AC-008 | Given invalid params, query, or body (each tested separately), When the request is sent, Then each `errors[].in` value is `path`, `query` or `body` respectively. | Q8 |
| AC-009 | Given a valid request, When it is sent, Then the handler receives the parsed (coerced) values and the response is the one the handler produced. | intent |
| AC-010 | Given an `onValidationError` hook is configured, When validation fails, Then the hook's response replaces the default 400 problem body. | Q8 |
| AC-011 | Given any typed route with a request schema, When the spec is generated, Then that operation includes a `400` response that references the problem-details schema with media type `application/problem+json`. | Q8 |
| AC-012 | Given `validateResponses` is unset, When a handler returns a body that violates its response schema, Then the body is sent unchanged and nothing is logged. | Q7 |
| AC-013 | Given `validateResponses: 'warn'`, When a handler returns a body that violates its response schema, Then the body is sent unchanged and exactly one warning is written through the configured logger. | Q7 |
| AC-014 | Given `validateResponses: 'error'`, When a handler returns a body that violates its response schema, Then the client receives a 500 response and the invalid body is not sent. | Q7 |
| AC-015 | Given registered routes, When `GET` is called on the spec endpoint (default `/openapi.json`), Then the response is 200 JSON with `openapi` starting `3.1.` and passes validation by `@apidevtools/swagger-parser` (or an equivalent OpenAPI 3.1 validator). | intent |
| AC-016 | Given a route `/users/:id` with params, query, body and response schemas, When the spec is generated, Then the path appears as `/users/{id}` with a `path` parameter `id` (required), query parameters, a `requestBody` and response schemas derived from the Zod schemas. | intent |
| AC-017 | Given bearer, apiKey and oauth2 security schemes declared once in the config, and a route that references one, When the spec is generated, Then `components.securitySchemes` contains all three and that operation's `security` lists the referenced scheme. | intent |
| AC-018 | Given the docs endpoint (default `/docs`) with no UI option, When it is requested, Then the HTML loads Scalar from a version-pinned CDN URL and points it at the spec endpoint. | Q6 |
| AC-019 | Given `ui: 'swagger-ui'`, When the docs endpoint is requested, Then the HTML loads Swagger UI from a version-pinned CDN URL. Given a custom CDN URL option, Then that URL is used instead. | Q6 |
| AC-020 | Given the published file list (`npm pack --dry-run`), When it is inspected, Then it contains no bundled UI JS/CSS assets. | intent |
| AC-021 | Given an existing Express `Router` with plain routes, When one typed route is mounted on it, Then the plain routes still respond as before and only the typed route validates. | Q9 |
| AC-022 | Given a plain handler wrapped with the `describe()` middleware, When the spec is generated, Then the route appears with its declared metadata, and invalid requests to it are not rejected (docs only). | Q9 |
| AC-023 | Given plain routes registered without the typed helper or `describe()`, on Express 4 and on Express 5 (tested separately), including a nested router mounted with `app.use('/api', router)` that has `router.get('/users/:id')` and `router.post('/users/:id')`, When the spec is generated, Then auto-detection walks the router stack and the spec contains path `/api/users/{id}` with exactly one `get` and one `post` operation. Each has an `operationId`, a required `path` parameter `id` with schema `type: string`, a generic `200` response, and the tag `api`. | G1 revise #1 |
| AC-024 | Given the test suite runs against Express 4 and Express 5, When an async typed handler throws, Then the error reaches Express's error middleware in both versions. | Q4 |
| AC-025 | Given `npm test`, When it runs, Then all tests pass and line, branch, function and statement coverage are each at least 90%. | intent, constitution |
| AC-026 | Given `npm run lint` and `npx tsc --noEmit`, When they run, Then both exit 0. | constitution |
| AC-027 | Given the CI workflow, When it runs on push or pull request, Then it runs build, lint, typecheck and tests on Node 22 and 24, against Express 4 and 5. | Q2, Q4, Q5, pre-review (human Node floor) |
| AC-028 | Given the release workflow file, When it is inspected, Then its only trigger is `workflow_dispatch` and no workflow publishes on push or tag. No `npm publish` is executed during this run. | Q2 |
| AC-029 | Given the repo, When it is inspected, Then `README.md` documents install, quick start, SchemaAdapter, security, docs UI, response validation, the error shape, incremental adoption, route auto-detection (including the opt-out) and configuration. The configuration section contains a defaults table with one row for every key of `DEFAULT_OPTIONS`, giving the key, its default and its description; a test fails if a key is missing from the table. `CHANGELOG.md` has an entry for the first version, and an `examples/` directory contains at least one runnable example that starts and serves `/openapi.json` with status 200. | intent, G1 revise #1, #2 |
| AC-030 | Given `autoDetect: false`, When the spec is generated, Then no plain route appears in it. Given `autoDetect` is left at its default and `exclude: ['/internal/**']`, When the spec is generated, Then plain routes under `/internal/` are absent and other plain routes are present. | G1 revise #1, A-1 |
| AC-031 | Given the same method and path registered both as a typed route (or with `describe()`) and as a plain route that auto-detection would find, When the spec is generated, Then exactly one operation exists for that method and path, and it carries the typed or `describe()` metadata. | G1 revise #1 |
| AC-032 | Given the spec middleware is mounted before a plain route is added, When the first spec request arrives after that route was added, Then the route appears in the spec. | G1 revise #1, A-5 |
| AC-033 | Given auto-detection is enabled, When the spec is generated, Then the package's own spec endpoint and docs endpoint paths do not appear in it. | G1 revise #1 |
| AC-034 | Given plain routes registered with a `RegExp` path, an Express 4 `*` wildcard and an Express 5 named wildcard `/*rest`, When the spec is generated twice, Then generation does not throw; the RegExp and unnamed-wildcard routes are skipped with one debug log line each; the named wildcard maps to `{rest}`; and both generated specs are byte-identical. | G1 revise #1, A-2 |
| AC-035 | Given an Express app set up with `createApiDocs()` and no options, plus one typed route, When the app is started, Then `GET /openapi.json` returns 200 with a valid OpenAPI 3.1 spec (as in AC-015), `GET /docs` returns 200 HTML loading Scalar, an invalid request to the typed route returns 400 problem+json, and responses are not validated. | G1 revise #2, A-6, A-7 |
| AC-036 | Given the package exports, When `DEFAULT_OPTIONS` is imported, Then it is a deep-frozen object whose values deep-equal the resolved config of `createApiDocs()` with no options. It contains a default for every option listed in AC-037 to AC-042. | G1 revise #2 |
| AC-037 | Given `specPath: '/spec.json'`, `docsPath: '/reference'`, `ui: 'swagger-ui'` and a custom `cdnUrl`, When the app is started, Then the spec is served at `/spec.json`, the docs at `/reference` using Swagger UI from the custom URL and pointing at `/spec.json`, and the default paths return 404. | G1 revise #2 |
| AC-038 | Given overrides of `openapi.info` (title, version, description), `openapi.servers` and `openapi.tags`, When the spec is generated, Then the spec's `info`, `servers` and `tags` equal the overridden values. | G1 revise #2 |
| AC-039 | Given `securitySchemes` with a bearer scheme and a global `security: [{ bearer: [] }]`, When the spec is generated, Then every operation that has no route-level `security` inherits the global requirement, and a route declaring `security: []` has an empty `security` array in its operation. | G1 revise #2 |
| AC-040 | Given `validateRequests: false` globally, When an invalid request is sent to a typed route, Then the handler is called and no 400 is returned. Given a global `onValidationError` formatter with validation on, When validation fails, Then the formatter's status and body are returned. (`validateResponses` modes are covered by AC-012 to AC-014.) | G1 revise #2, A-7 |
| AC-041 | Given `autoDetect` with `include: ['/api/**']` and a custom `detectedDefaultResponse` (e.g. status `204`, description `No Content`), When the spec is generated, Then only plain routes under `/api/` are auto-detected, and each detected operation's responses equal the custom default. | G1 revise #2, A-1 |
| AC-042 | Given custom `operationIdStrategy` and `tagStrategy` functions, When the spec is generated, Then every operation without an explicit `operationId` or tags (both typed and auto-detected) uses the functions' return values. With neither option set, the defaults in A-3 and A-4 apply (e.g. `GET /users/:id` produces `getUsersById` with tag `users`). | G1 revise #2, A-3, A-4 |
| AC-043 | Given `serveDocs: false`, When the app is started, Then the docs path returns 404 and the spec is still served. Given `serveSpec: false` and `serveDocs: false`, When the app is started, Then the spec path returns 404 and the spec is still available programmatically (e.g. `apiDocs.getSpec()`). Given `serveSpec: false`, `serveDocs: true` and no `docs.specUrl`, When setup runs, Then it throws `ApiDocsConfigError` synchronously, naming `serveSpec` and `docs.specUrl`. Given `serveSpec: false`, `serveDocs: true` and `docs.specUrl: 'https://example.com/openapi.json'`, When the docs path is requested, Then it returns 200 HTML pointing at that URL, and the spec path returns 404. | G1 revise #2, A-9 |
| AC-044 | Given defaults, global options and per-route options that overlap, When the effective options for a route are resolved, Then the precedence is per-route over global over defaults, as a deep merge in which arrays are replaced, not concatenated. Tests cover all four of these cases: (a) a global `openapi.info.title` override keeps the default `info.version`; (b) global `tags: ['a','b']` with per-route `tags: ['c']` yields `['c']`; (c) per-route `validateResponses: 'error'` beats global `'warn'`; (d) a per-route `onValidationError` beats the global one. | G1 revise #2 |
| AC-045 | Given `createApiDocs()` called with an unknown key (e.g. `specPth`) or an invalid value (e.g. `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`), When setup runs, Then it throws synchronously, before mounting any route, an exported `ApiDocsConfigError` whose message contains the offending option path and the allowed values or type. | G1 revise #2, A-8 |
| AC-046 | Given a TypeScript consumer, When it passes an unknown key or a wrongly typed value to `createApiDocs()` or to per-route options, Then `tsc --noEmit` reports an error (verified by type tests with `@ts-expect-error`), and all options are optional in the exported `ApiDocsOptions` type. | G1 revise #2 |
| AC-047 | Given `schemaAdapter: stubAdapter` globally or per-route, When requests are validated and the spec is generated, Then the stub adapter's parse and toJsonSchema are used, and per-route overrides global. | rebuild (ADR-38) |

## Out of scope

- Publishing to npm during this run, and any CI auto-publish.
- Zod v3 support, and adapters other than Zod (the interface only; a test stub is allowed).
- Inferring request or response schemas for auto-detected routes. They get only minimal metadata, which can be configured through `detectedDefaultResponse` and the strategies.
- Loading config from files or environment variables. Configuration is code-only, through `createApiDocs(options)`.
- Bundled UI assets and self-hosted UI.
- OpenAPI 3.0 or 2.0 output.
- Other frameworks (Fastify, Koa).

## Assumptions

All original questions (Q0a–Q10) were resolved by the human. The G1 revisions add assumptions A-1 to A-9 from `intent.md`, all flagged for confirmation at G1:

- **A-1:** auto-detection is on by default, with `autoDetect: false`, `include` and `exclude` globs.
- **A-2:** regex and unnamed-wildcard routes are skipped with a debug log line; named wildcards map to `{name}`; optional segments produce two paths.
- **A-3 / A-4:** the default `operationId` is `getUsersById`-style and the default tag is the first static segment. Both can be overridden through strategies.
- **A-5:** detection is lazy and cached, and it re-walks the router stack when the stack length changes.
- **A-6:** the option names and default values are provisional; the architect may rename them, but the behavior binds.
- **A-7:** request validation is on by default.
- **A-8:** config errors throw `ApiDocsConfigError` synchronously.
- **A-9:** `serveSpec: false` with `serveDocs: true` throws `ApiDocsConfigError` at setup unless `docs.specUrl` is set explicitly.

## Affected flows

Greenfield: the pre-change baseline is empty, and the Evidence Capturer records "absent" for each flow.

| Flow id | Description | Kind (ui/cli/api) |
|---|---|---|
| F-1 | `npm run build` then `npm pack --dry-run` (dual outputs, file list) | cli |
| F-2 | `npm test` with coverage report | cli |
| F-3 | Example app: `GET /openapi.json` returns a valid 3.1 spec | api |
| F-4 | Example app: invalid request returns a 400 problem+json body | api |
| F-5 | Example app: `GET /docs` renders Scalar (and Swagger UI via option) | ui |
| F-6 | Example app: a plain (unannotated) route appears in `/openapi.json` through auto-detection | api |
| F-7 | Example app with zero-options `createApiDocs()` versus custom options: endpoints move or are disabled as configured | api |
