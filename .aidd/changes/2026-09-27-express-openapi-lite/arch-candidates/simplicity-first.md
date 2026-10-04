# Architecture Candidate — simplicity-first

<!-- One per Architect lens run; judged via judge-scorecard.md. -->

**Precedent note:** the repo is greenfield (snapshot.md shows an empty tree, no manifests, no public API), so there is no repo precedent. Each choice below cites ecosystem precedent instead. Constitution: TS strict, vitest with coverage, eslint and prettier, GitHub Actions, 90% coverage.

Probe (environment, 2026-09-27):
```
$ node --version; npm --version; npm view zod@4 version | tail -1; npm view express@5 version | tail -1
v24.11.1
11.4.2
zod@4.6.5 '4.6.5'
express@5.2.1 '5.2.1'
exit 0
```

## Approach summary (≤10 lines)

1. This is a single flat package with about 10 source files and no monorepo. Runtime dependencies are zero (`dependencies: {}`). `express` and `zod` are peer dependencies only.
2. `createApiDocs(options)` returns one object, `{ router, route, describe, getSpec, options }`. It is the only stateful entry point, and all state lives in a closure-held registry (a plain `Map`).
3. The spec is a pure function: `buildSpec(registry, detectedRoutes, resolvedOptions)`. The spec router calls it lazily. The result is cached and keyed on the router-stack length (A-5).
4. Zod v4 native `z.toJSONSchema()` produces the JSON Schema. The build uses no zod-to-openapi or similar library, because OpenAPI 3.1 is JSON Schema 2020-12 compatible.
5. Options are validated by a small hand-written validator over a declarative key table. The same table produces `DEFAULT_OPTIONS`, the `ApiDocsOptions` type, and the README-table test, so there is one source of truth.
6. Build uses `tsup` (one command gives ESM, CJS and `.d.ts`). Tests use vitest with supertest. CI runs a matrix of Node 20/22/24 × Express 4/5, installing the Express version through `npm i express@4 --no-save`.

## Components

| # | Module (`src/`) | Responsibility | ACs | Ecosystem precedent |
|---|---|---|---|---|
| C1 | `options.ts` | An `OPTION_SPEC` table (key, default, validator, description); `DEFAULT_OPTIONS` deep-frozen from it; `resolveOptions()` deep merge (arrays replace, per-route > global > default); `ApiDocsConfigError`; unknown-key and value checks; A-9 cross-check | 036, 038–046 | `defu`/`deepmerge` semantics (arrays replaced, as in the `lodash.mergeWith` pattern); fastify's `ajv` option validation, done here by hand to avoid a runtime dependency |
| C2 | `adapter.ts` | The `SchemaAdapter<S>` interface: `parse(schema, input) → {ok, value} \| {ok:false, issues[]}` and `toJsonSchema(schema)`. `zodAdapter` implements it with `safeParse` and `z.toJSONSchema(s, { target: 'draft-2020-12', io: 'input' })` | 005, 016 | tRPC/`@standard-schema/spec` validator abstraction. The interface is Standard-Schema-shaped so that a future adapter is additive |
| C3 | `route.ts` | `api.route(router, { method, path, params, query, body, responses, security, tags, operationId, ...perRouteOpts }, handler)`. It registers metadata, mounts a validation middleware plus the handler, wraps an async handler with `.catch(next)` (Express 4 parity with 5), and wraps `res.json` for response validation (off/warn/error) | 006–014, 021, 024, 040, 044 | `express-zod-api`, `zod-express-middleware`, `@asteasolutions/zod-to-openapi` registry pattern |
| C4 | `describe.ts` | `api.describe(meta)` returns a no-op middleware tagged with a `Symbol` property that carries its metadata. The walker reads it, so it is docs only | 022, 031 | `express-openapi-validator`-style annotation, but passive |
| C5 | `detect.ts` | Walks the router stack of `app._router` (Express 4) or `app.router` (Express 5). It recovers mount prefixes (Express 4 from `layer.regexp` via a known-source parse; Express 5 from the `layer.matchers`/path stored on mount), normalizes `:id`→`{id}`, `*name`→`{name}`, expands optionals, skips RegExp or unnamed `*` with a debug log, applies include/exclude globs (a tiny in-house glob-to-RegExp, about 15 LOC), self-excludes spec and docs paths, and dedupes against the registry (the typed or described route wins) | 023, 030–034, 041, 042 | `express-list-endpoints` (the de-facto stack walker, about 150 LOC; reimplemented because it lacks Express 5 prefix recovery and wildcard rules) |
| C6 | `spec.ts` | Pure `buildSpec()`: paths, params, requestBody, responses, auto-400 problem+json `$ref`, `components.securitySchemes`, global `security` inheritance, `operationIdStrategy`/`tagStrategy` defaults (A-3/A-4, numeric suffix on collision), stable key ordering for byte-identical output | 011, 015–017, 034, 038, 039, 042 | `@asteasolutions/zod-to-openapi` `OpenApiGeneratorV31` |
| C7 | `problem.ts` | Default RFC 9457 formatter and the `ProblemDetails` JSON Schema component | 007, 008, 010, 011 | RFC 9457; `http-problem-details` |
| C8 | `ui.ts` | A `renderDocs(ui, cdnUrl, specUrl)` template-string HTML function with pinned default CDN URLs for docs UI (`docs-ui-package@<pin>`) and docs UI (`docs-ui-dist@<pin>`) | 018, 019, 020, 037, 043 | docs UI's official "CDN" HTML snippet; `docs-ui-dist` unpkg usage |
| C9 | `index.ts` | `createApiDocs()` validates options, then builds `router` (spec and docs GET handlers, honoring `serveSpec`/`serveDocs`) and binds the registry. Exports: `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, zodAdapter, types` | 001–004, 035, 043 | `docs-UI middleware` mount-as-router pattern |
| C10 | repo scaffolding | `package.json` (exports map, peers, engines, `files: ["dist"]`), `tsup.config.ts`, `vitest.config.ts` (v8 coverage, thresholds 90), `eslint.config.js`, `.github/workflows/ci.yml` + `release.yml` (`workflow_dispatch` only), README, CHANGELOG, LICENSE, `examples/basic.ts` | 001–004, 020, 025–029 | `tsup` dual-package convention (zod, hono and many others) |

Consumer usage: `const api = createApiDocs(opts); app.use(api.router); api.route(app, {...}, handler)`. Auto-detection gets the `app` from `req.app` on the first spec request, so the user does not pass it and needs no extra config.

Suggested story slicing (owner path): S1 scaffolding + options (C1, C9 skeleton, C10); S2 adapter + typed route + problem (C2, C3, C7); S3 spec + UI (C6, C8); S4 detection + describe (C4, C5); S5 docs, examples, CI hardening.

## Trade-offs accepted

- **Hand-rolled option validator instead of using Zod internally.** Using the peer Zod would work, but it would couple config validation to the adapter the user may swap out. The table-driven validator costs about 120 LOC, and in exchange the table also drives `DEFAULT_OPTIONS` and the README test. Risk: error-message quality depends on discipline, which is mitigated by one test per AC-045 example.
- **Reliance on Express internals (`_router`/`router`, `layer.regexp`, `layer.route`).** This is unavoidable for auto-detection (AC-023). It is isolated in `detect.ts` behind two small version shims. Express 4 mount-prefix recovery from compiled regexp is the fragile part; `express-list-endpoints` shows it is viable. This is the main risk and is the reason for the Express 4/5 CI matrix.
- **Cache keyed on the top-level stack length only (A-5, as specified).** Routes added to an already-mounted nested router after the first spec request are missed until the top-level stack changes. This is accepted per A-5 and documented. Scalability-first may argue for deep hashing.
- **No zod-to-openapi dependency.** Output from `z.toJSONSchema` is used nearly verbatim. Some Zod constructs (transforms, custom types) emit `{}` or throw unless `unrepresentable: 'any'` is set. We set it, and accept lossy docs for those types.
- **Response validation via `res.json` monkey-patch per request.** It is simple, but it does not cover `res.send` of raw strings or streams. This is documented as JSON-only.
- **Glob matching in-house (`*`, `**` only).** No `picomatch` dependency. Brace and extglob patterns are not supported, which is documented.
- **Single `Map` registry per `createApiDocs()` instance, no global singleton.** Multiple instances are independent. Nothing is plugin-extensible beyond `SchemaAdapter` and the strategy functions.
- **`openapi.info` from the consumer's `package.json`** is read once via `process.cwd()` in a try/catch, with fallback `API`/`0.0.0`. This is implicit, but it matches A-6.

## Sketch of verification strategy

- **Unit (vitest):** `options.test.ts` (AC-036, 044 a–d, 045, 046 runtime side), `spec.test.ts` (pure `buildSpec` snapshots, byte-identical double generation for AC-034), `detect.test.ts` (A-2/A-3/A-4 path mapping tables), `ui.test.ts`.
- **Integration (supertest):** one `app.test.ts` parameterized over `EXPRESS_MAJOR` (4 or 5), covering AC-007–014, 021–024, 030–033, 035, 037, 043. The spec is validated with `@readme/openapi-parser` `validate()` (devDependency) for AC-015.
- **Type tests:** `test/types.test-d.ts` using vitest `expectTypeOf` + `@ts-expect-error`, checked by `tsc --noEmit` (AC-006, 046).
- **Package tests:** after `npm run build`, `test/dist.test.ts` does `import()` of `dist/index.js` and `createRequire()` of `dist/index.cjs`, then compares export keys (AC-003). A script checks `npm pack --dry-run --json` for no `.css` or UI `.js` (AC-020). A grep test checks for `express-openapi-lite` (AC-001). A README-table test parses the markdown table against `Object.keys(DEFAULT_OPTIONS)` (AC-029).
- **Commands (to be probed at synthesis once scaffolded; not yet runnable because no package.json exists):** `npm run build`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm pack --dry-run`. CI matrix: node [20,22,24] × express [4,5].
