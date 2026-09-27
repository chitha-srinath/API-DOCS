# Architecture — 2026-09-27-express-openapi-lite

<!-- Synthesized from arch-candidates/ by the winning-candidate merge. -->
<!-- Winner: risk-first (judges 22 / 21 / 21, unanimous). Grafts from simplicity-first and scalability-first are recorded as ADR rows. -->
<!-- Precedent: greenfield repo (context/snapshot.md: empty tracked tree; `ls` of repo root shows only AGENTS.md). No repo file can be cited, so every decision cites ecosystem precedent or states why none exists. -->

## Approach

Package `express-api-docs`, a single flat TypeScript package with zero runtime `dependencies`. `express` (`^4.21.0 || ^5.0.0`) and `zod` (`^4.0.0`) are peer dependencies only. **[SUPERSEDED by ADR-21 → `zod` is an optional peer; the core never imports it; `zodAdapter` only at `express-api-docs/zod`.]** **[Node floor SUPERSEDED by ADR-22 → `engines.node >=22`.]** Every volatile boundary sits behind a small internal port, and each variant of a port has a contract test:

- `SchemaAdapter` (Zod v4 first) **[SUPERSEDED by ADR-21 → the core default is `standardSchemaAdapter`; Zod is at the subpath]**. The user's schema library is used **only** for route schemas. It is never used for the package's own config (ADR-04).
- `RouterIntrospector`, with separate Express 4 and Express 5 implementations. Express has no public route-list API, so this is the top risk.
- `DocsRenderer`, for Scalar (the default) and Swagger UI, loaded from a pinned CDN.
- `ConfigResolver`, which is table-driven, hand-validated and does not depend on any schema library.

The spec is produced by a pure function, `buildSpec(operations, config)`. It has no dependency on Express and does no IO. Its output is canonically sorted, so it is byte-deterministic (AC-034).

Typed routes, `describe()` routes and plain routes are all discovered by the same stack walk. Typed and `describe()` handlers carry a `Symbol` metadata tag, so mount prefixes are resolved in one place. **[SUPERSEDED by ADR-17 → typed and describe() routes are recorded in `RouteRegistry` at declaration; the walk only adds mount prefixes (via ADR-18/23 recorder) and finds plain routes. Symbols are `Symbol.for` per ADR-20.]** The walk runs lazily on the first spec request, against the app found through `req.app`, and never throws. Its result is cached on a fingerprint of the nested stacks. `invalidate()` is the escape hatch for cases the fingerprint misses.

Consumer usage:

```ts
const api = createApiDocs(opts);
app.use(api.router);
router.get('/users/:id', ...api.route({ params, query, responses }, handler));
```

`createApiDocs()` returns `{ router, route, describe, getSpec, invalidate, options }`. **[Amended by ADR-23/24 → the package also exports `installRecorder(expressModule)`; opt-out entry `express-api-docs/manual`.]**

## Components & data shapes

No repo precedent exists (greenfield), so each component cites ecosystem precedent. Owner stories are planned so that each story **owns a disjoint set of files**.

| # | Files (`src/…`) | Responsibility | ACs | Precedent | Owner story |
|---|---|---|---|---|---|
| C0 | `core/types.ts` | The shared contracts only: `HttpMethod`, `OperationMeta`, `DetectedOperation {method, path, pathParams[], source: 'typed'\|'describe'\|'plain', meta?}`, `Logger` (with stable `EAD_*` warn codes), the pinned `RegistryEntry`/`RouteRegistry` interfaces (ADR-27c, see Pinned seams), and the four cross-copy symbols `META`, `MOUNT`, `CHILD`, `RECORDER`, all `Symbol.for('express-api-docs.*')` (ADR-20). There is no logic here. **[was: "`META: unique symbol`" — SUPERSEDED by ADR-20 → `Symbol.for`; registry interface added by ADR-27c]** | — | Hexagonal "ports" module (zod-to-openapi's `types.ts`) | S-01 scaffold |
| C1 | `config/spec-table.ts`, `config/defaults.ts`, `config/validate.ts`, `config/merge.ts`, `config/errors.ts`, `config/types.ts` | `ApiDocsOptions` is a hand-written TS type in which every key is optional. `OPTION_SPEC` is a table of rows `{ path, default, check, allowed, description }`, keyed by dotted path, and is the single runtime source. It is compile-time locked to the type through `satisfies Record<OptionPath<ApiDocsOptions>, OptionRow>`. `DEFAULT_OPTIONS` is built from the table and deep-frozen. `validateOptions()` rejects unknown keys, rejects invalid values, and enforces the A-9 cross-field rule, throwing `ApiDocsConfigError(path, expected)`. `mergeOptions(defaults, global, route)`: plain objects recurse; arrays, functions and primitives replace. | 036, 038–046 | Table: simplicity-first C1. Merge semantics: `defu` / `lodash.mergeWith` with arrays replaced. Construction-time validation: `fastify()` | S-02 config |
| C2 | `adapter/types.ts`, `adapter/standard.ts`, `adapter/standard-types.ts`, `adapter/memo.ts`, `adapter/zod.ts`, `zod.ts` (subpath entry) | `SchemaAdapter<S> { name; isSchema(x): x is S; validate(s, input): {ok:true,data}\|{ok:false,issues:{path,message}[]}; toJSONSchema(s, io:'input'\|'output'); }` plus a type-level `Infer<S>` hook. **Core default:** `standardSchemaAdapter` via `~standard.validate` / `~standard.jsonSchema` with types vendored in `standard-types.ts` (ADR-21; edge behaviour ADR-31). **Subpath only:** `zodAdapter` (`adapter/zod.ts`, exposed through `src/zod.ts` → `express-api-docs/zod`) uses `safeParse` and `z.toJSONSchema(s, { target: 'draft-2020-12', io, unrepresentable: 'any' })`; it is the only file allowed to import `zod`. `memo.ts` wraps any adapter with `WeakMap<schema, JSONSchema>` memoization. **[was: files `adapter/types.ts, adapter/zod.ts, adapter/memo.ts` with Zod as the core adapter — SUPERSEDED by ADR-21]** | 005, 006, 016, 035 | Standard Schema (`~standard`) and Standard JSON Schema; memoization from scalability-first C2; `unrepresentable` from simplicity-first | S-03 adapter |
| C3 | `route/typed.ts`, `route/validate-request.ts`, `route/validate-response.ts`, `route/async.ts`, `route/problem.ts` | `route(meta, handler)` returns `[validator, wrapAsync(handler)]`. Per-route options are resolved once, at definition time. Validators are pre-bound. The handler is tagged with `[META]`. Request errors produce RFC 9457 `problem+json` with `errors[{in: path\|query\|body, path, message}]`, or the value of `onValidationError`. `res.json` is wrapped **only** when `validateResponses !== false`. Wrapping `res.json` also covers `res.send(object)`, because Express's `send` delegates objects to `json`; raw strings and streams are documented as not validated. `wrapAsync` sends rejections to `next(err)`, which gives the same behaviour on Express 4 and 5. | 006–014, 021, 024, 040, 044(c,d) | express-zod-api, `@ts-rest/express`, RFC 9457 | S-04 typed-route |
| C4 | `route/describe.ts` | `describe(meta)` returns a pass-through middleware tagged with `[META]`, `source: 'describe'`. It never validates. | 022, 031 | tsoa-style metadata, done with a Symbol instead of reflect-metadata | S-05 introspect |
| C5 | `introspect/recorder.ts` (`installRecorder`, ADR-18/23), `introspect/index.ts`, `introspect/express4.ts`, `introspect/express5.ts`, `introspect/paths.ts`, `auto-record.ts` (side-effect entry, ADR-24) | `introspect(app, registry, log): DetectedOperation[]`. The version sniff is key-only and never reads `app.router` on v4 (ADR-27a, see Pinned seams). If `req.app.parent` exists it walks from the topmost ancestor with a warn (ADR-29). Each layer is handled in its own try/catch. Unknown shapes, unrecoverable prefixes, unmatched registry entries and unpatched Express copies are logged once at `warn` with an `EAD_*` code (ADR-19/23). Mount prefixes come from recorder annotations `[MOUNT]`/`[CHILD]`; on v4 `layer.regexp` is the fallback for pre-import mounts. Registry entries are located by `RouteRegistry.findByHandle` (ADR-17). `paths.ts` handles path conversion: `:id` becomes `{id}`, `/*rest` becomes `{rest}`, and optional segments expand into two paths. RegExp routes and unnamed `*` are skipped with exactly one `debug` line each (AC-034). **[was: "sniffs `app._router` or `app.router`, falling back to the other" — SUPERSEDED by ADR-27a; was: "unknown shape skipped with a debug log" — SUPERSEDED by ADR-19; was: "v5 prefix from the layer matcher or path" — SUPERSEDED by ADR-18 (spike: impossible); was: "`[META]` tags are read here" as the primary key — SUPERSEDED by ADR-17]** | 023, 030, 032–034 | express-list-endpoints, vendored and extended for v5 | S-05 introspect |
| C6 | `spec/build.ts`, `spec/naming.ts`, `spec/glob.ts`, `spec/canonical.ts` | `buildSpec(ops, config, adapter)`. It dedupes with precedence typed = describe > plain (AC-031) and applies `include`/`exclude` through the in-house `glob.ts` (`*` and `**` only). It self-excludes `specPath` and `docsPath`. Default operationIds and tags follow A-3/A-4 in `naming.ts` and can be overridden by strategies. It adds the auto-400 `$ref` ProblemDetails, applies global security inheritance (route `[]` wins), applies `detectedDefaultResponse`, and applies `info`/`servers`/`tags`. Output goes through a canonical key sort. | 011, 015–017, 031, 033, 034, 038, 039, 041, 042 | zod-to-openapi `OpenApiGeneratorV31`; glob from simplicity-first | S-06 spec |
| C7 | `spec/cache.ts` | A lazy cache keyed on a fingerprint: the total layer count, summed recursively across nested router stacks. `invalidate()` clears it. | 032 | Nested fingerprint: risk-first C7 / scalability-first C1; `invalidate()` from scalability-first C10 | S-06 spec |
| C8 | `docs/render.ts`, `docs/cdn.ts` | Scalar and Swagger UI HTML templates. `cdn.ts` holds the pinned version constants (`@scalar/api-reference@1.72.1`, `swagger-ui-dist@5.33.0` at probe time), and a test asserts the pins. The spec URL is JSON-encoded and HTML-escaped. `docs.specUrl` overrides the spec URL. | 018–020, 037, 043 | Scalar's CDN snippet; swagger-ui-dist on unpkg/jsDelivr | S-07 serve |
| C9 | `serve/router.ts`, `index.ts`, `manual.ts` (opt-out entry, ADR-24) | The composition root. `createApiDocs(opts)` validates synchronously **before** building anything, then builds the Router (spec and docs GETs, gated by `serveSpec`/`serveDocs`), resolves the app through `req.app` on the first request, and wires the cache. `index.ts` starts with a bare `import './auto-record'`; `manual.ts` re-exports the same API without it. Public exports of `.` and `./manual`: `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, standardSchemaAdapter, installRecorder`, plus types. `zodAdapter` is exported **only** from `./zod` (C2). **[was: "Public exports: `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, zodAdapter`" — SUPERSEDED by ADR-21 (zodAdapter out of the main barrel) and ADR-23/24 (installRecorder, /manual)]** | 001–004, 035, 037, 043, 045 | swagger-ui-express mount-as-router | S-07 serve |
| C10 | `package.json`, `tsconfig*.json`, `tsup.config.ts` (entries: `index`, `manual`, `zod`, `auto-record`), `vitest.config.ts`, `vitest.perf.config.ts`, `eslint.config.js`, `.prettierrc`, `.nvmrc`, `stryker.config.mjs`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `LICENSE`, `.gitignore` | The dual build; exports `.`, `./manual`, `./zod`; `sideEffects: ["./dist/auto-record.js","./dist/auto-record.cjs"]` (ADR-24); peers `express` required, `zod` and `@types/express` optional (ADR-21/29); top-level `types` → `./dist/index.d.cts`, no `module` field (ADR-29); `engines.node >=22` (ADR-22); 90% coverage thresholds; Stryker scope per ADR-27d; CI matrix node {22,24} × express {4,5} plus `peer-floor` and one pinned `perf` cell (ADR-25/26); `release.yml` whose only trigger is `workflow_dispatch`. **[was: "CI matrix of node {20,22,24} × express {4,5}" — SUPERSEDED by ADR-22/25]** | 001–004, 020, 025–028 | tsup + attw + publint (as used by zod, hono and trpc) | S-01 scaffold |
| C12 | `registry/registry.ts` | Per-instance `RouteRegistry` for typed and `describe()` routes, populated at declaration (ADR-17) | 006, 022, 031, 043 | zod-to-openapi `OpenAPIRegistry` | S-04 typed-route |
| C11 | `README.md`, `CHANGELOG.md`, `examples/basic/*`, `test/docs/readme-table.test.ts` | The documentation. A test checks the README defaults table against `OPTION_SPEC` paths. The example is exercised by a smoke test. | 029 | — (none; bespoke) | S-08 docs-release |

**Test ownership mirrors source ownership.** Each story owns `test/<area>/**`, where `<area>` is the same folder name as its `src/` area. Shared fixtures (`test/fixtures/apps.ts`, the Express 4 and 5 app factories, and `test/fixtures/majors.ts` per ADR-25) are owned by S-05. `test/perf/**` is owned by S-07 (ADR-26); `test/meta/**` by S-01 (ADR-25). S-01 owns `test/dist/**`, which covers ESM/CJS parity (AC-003), the pack file list (AC-020) and the name grep (AC-001). **[SUPERSEDED by epic.md → S-01 keeps `test/dist/**` only for manifest, pack (`sideEffects`, no UI assets, no zod in dist), workflows and `global-setup.ts`; parity (AC-003), dual-load, bundle and no-zod-load tests moved to `test/entries/**`, owned by S-07.]**

**Story dependency order:**

- S-01 comes first.
- S-02 and S-03 then run in parallel.
- S-04 depends on S-02 and S-03.
- S-05 depends on S-01 and C0. **[SUPERSEDED by ADR-27b → S-05 depends on S-04 and S-01; gate G-S05 must pass first]**
- S-06 depends on S-02, S-03 and S-05 (and therefore transitively on S-04).
- S-07 depends on S-02 and S-06.
- S-08 comes last.

## Decisions (ADR list)

| # | Decision | Why | Alternatives rejected |
|---|---|---|---|
| ADR-01 | **Base design is risk-first.** It keeps per-port isolation, per-version introspectors, per-layer try/catch, a pure `buildSpec` and a canonical sort. | Unanimous judge win (22/21/21). It carries the most weight on the fragile ACs: 023, 031–034, 002/003, 006/046. | simplicity-first (19 avg), because of its single `detect.ts` and top-level-only cache. scalability-first (17 avg), because it over-builds for 1k-route scale. |
| ADR-02 | **GRAFT ACCEPTED (scalability-first): public `invalidate()`** on the `createApiDocs()` result. | The nested fingerprint still misses a layer replaced in place with equal counts (scalability-first's trade-offs §2). A one-line escape hatch makes that failure recoverable and testable. | Deep structural hashing of every layer on every request (cost for little gain), and documenting the gap with no remedy. |
| ADR-03 | **GRAFT ACCEPTED, partial (scalability-first): WeakMap memoization and definition-time work.** It covers a `WeakMap<schema, JSONSchema>` in `adapter/memo.ts`, validators pre-bound per route, per-route options resolved once at definition time, and no `res.json` wrap when `validateResponses` is false. **REJECTED** from the same candidate: the ETag/304 layer, the per-operation fragment cache, structural-hash component hoisting and the `WeakMap<Router, …>` registry. | The accepted parts are cheap and keep the request hot path O(1). Memoizing in a wrapper keeps adapters trivial, which helps AC-005 stubs. The rejected parts were flagged by all three judges as out of v1 scope, and hash hoisting endangers AC-016 output shape and AC-034 byte identity. A router-keyed registry is replaced by `[META]` handler tags read during the walk (ADR-07). | — |
| ADR-04 | **[Coupling rationale extended by ADR-21: the core also never imports zod for route schemas.]** **Config validation uses simplicity-first's `OPTION_SPEC` table, not risk-first's internal Zod schema.** A hand-written `ApiDocsOptions` type is compile-time locked to the table with `satisfies Record<OptionPath<ApiDocsOptions>, OptionRow>`. The same table drives runtime validation, `DEFAULT_OPTIONS` and the README parity test. **`config/**` must not import `zod` or `adapter/**`**, and an ESLint `no-restricted-imports` rule on `src/config/**` enforces this. | All three judges flagged the risk-first coupling: validating config with Zod ties core to the peer that `SchemaAdapter` abstracts (Q0b). A user on a future non-Zod adapter must not need Zod in order to configure the package. Risk-first's real goal, types and runtime that cannot drift (AC-045/046), is kept: the `satisfies` lock fails `tsc` if a key is added to the type but not the table, or the reverse. `@ts-expect-error` type tests cover AC-046. | (a) An internal Zod `.strict()` schema, which couples config to the peer and would break the future non-Zod path. (b) Generating the table from a Zod schema (judge 3's fallback), which has the same coupling. (c) A standalone JSON-Schema/ajv validator, which adds a runtime dependency. |
| ADR-05 | **[Scope SUPERSEDED by ADR-27d → adds `src/registry/**`, `src/adapter/**`.]** **Stryker mutation testing is REQUIRED**, via `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` 10.0.0. It runs on `src/config/**`, `src/introspect/**`, `src/spec/**` and `src/route/**`, with `thresholds.break: 70`. | The constitution's quality bar is a 70% mutation floor (Stryker), so this is not optional. Only scalability-first named it, and judges 1, 2 and 3 all asked for it to be grafted. The scope is widened from scalability-first's `config/introspect/registry` to the logic-dense folders of this layout. `docs/` and `serve/` are thin templates and wiring. | Leaving mutation to CI only (it must be locally runnable), and whole-repo mutation (slow for no extra signal on templates). |
| ADR-06 | **[The "tag registry" SUPERSEDED by ADR-17 → `RouteRegistry` in `src/registry/registry.ts`.]** **GRAFT ACCEPTED (simplicity-first): `req.app` discovery.** The spec handler walks `req.app` on the first request; the user never passes `app`. `getSpec()` called before any request, or without a mounted router, returns the typed-only spec from the tag registry of routes created by the instance, and accepts an optional `getSpec({ app })` argument. | Near-zero config (intent), and it matches lazy detection (A-5). Express always sets `req.app`, on v4 and v5. | Requiring `createApiDocs({ app })`, which adds config and chicken-and-egg ordering, and monkey-patching `app.get` (risk-first rejects it as invasive, and it misses earlier routes). |
| ADR-07 | **[SUPERSEDED by ADR-17 (hybrid discovery) and ADR-20 (`Symbol.for`).]** **One discovery path.** Typed and `describe()` routes are found by the same stack walk as plain routes, via a `[META]` symbol on the handler. The walk supplies the full mounted path. | Typed routes defined on a `Router` that is mounted later at `/api` only learn their prefix from the stack. One path avoids two sources of path truth and makes AC-031 dedupe trivial. | risk-first's `WeakMap<Router, OpDef[]>`, which would need prefix recovery anyway. |
| ADR-08 | **REJECTED (simplicity-first): reading the consumer's `package.json` for `openapi.info`.** The default is the static `{ title: 'API', version: '0.0.0' }`. | Reading from `process.cwd()` makes the resolved defaults depend on the environment, so `DEFAULT_OPTIONS` could not deep-equal the resolved zero-option config (AC-036). Judges 1 and 3 flagged the nondeterminism. **This deviates from A-6's "from package.json when readable"**: G2 must confirm it. The behaviour AC-036 binds on wins over the provisional default in A-6. | A `process.cwd()` read in try/catch, and an opt-in `info: 'package.json'` sentinel (deferred, not in scope). |
| ADR-09 | **Cache key is a nested fingerprint** (total layer count across nested stacks) plus `invalidate()`. | This is a stricter form of A-5 that keeps its behaviour (lazy, cached, re-walk on change) and fixes the nested-router gap (AC-032). All judges preferred it. | A top-level length key (simplicity-first), which misses nested routes. |
| ADR-10 | **Glob matcher is in-house**, supporting `*` and `**` only (from simplicity-first). There is no `picomatch`. | Zero runtime deps, and the constitution requires a clean audit. The only patterns the PRD uses are `/internal/**` and `/api/**`. | `picomatch` as a runtime dependency (scalability-first), which widens the supply-chain surface. |
| ADR-11 | **Build uses `tsup` 8.5.1** (ESM `.js` with `"type": "module"`, CJS `.cjs`, `.d.ts` and `.d.cts`). **Package gates** are `publint` 0.3.24 and `attw --pack` 0.18.5. | This is the dual-package tooling zod, hono and trpc use. attw catches `.d.ts` resolution errors that AC-003 runtime parity cannot see. | `tsc` with two tsconfigs (manual `.cjs` rename, and it misses the types-condition hazard), and `unbuild`. |
| ADR-12 | **devDependency TypeScript is pinned to `~5.9.3`**, not `latest` (7.0.2). The consumer floor stays TS >= 5.4 (Q5). | Probe: `typescript-eslint@8.70.1` peers `typescript >=4.8.4 <6.1.0`, so TS 7 would break lint (AC-026). 5.9 is the newest stable 5.x release and is within the range tsup's dts step is known to handle. A type-test job also compiles the `.d.ts` files against the 5.4 floor. | TS 7.0.2 (peer conflict), and TS 6.0.3 (inside the peer range, but a transition release that adds risk for no AC gain; to be revisited in a later change). |
| ADR-13 | **[Amended by ADR-23 (express4 via `installRecorder`) and ADR-25 (dedupe by installed major).]** **Express 4 and 5 are both tested in one local run.** The devDeps are `express@^5.2.1` and `express4: npm:express@^4.22.3`, and fixtures are parameterized over both. CI also swaps the peer per matrix cell. | This covers AC-023/024 on both majors locally. It was proposed by risk-first and scalability-first and endorsed by judge 2. | `npm i express@4 --no-save` per cell (simplicity-first), which gives no local dual coverage. |
| ADR-14 | **Spec validity oracle:** every spec-producing test calls `@apidevtools/swagger-parser` 13.1.0 `validate()`. | AC-015 names it, and it supports OpenAPI 3.1. | A snapshot-only check, which cannot catch invalid specs. |
| ADR-15 | **[Node support SUPERSEDED by ADR-22 → Node 22/24; `vite` and `@types/node` added.]** **Tests use vitest 5.0.2 with `@vitest/coverage-v8` 5.0.2** (peer pinned to the same version), `supertest` 7.3.0, and `vitest --typecheck` for `*.test-d.ts`. Coverage thresholds are 90 for lines, branches, functions and statements. | These are the constitution's tools, and the coverage floor comes from the constitution and AC-025. | jest, and `tsd` (duplicates `--typecheck`). |
| ADR-16 | **Lint uses eslint 10.11.0 flat config with `typescript-eslint` 8.70.1 and prettier 3.9.9.** | Constitution standards. The probe confirms that `typescript-eslint` peers `eslint ^10`. | — |
| ADR-17 | **AMENDS ADR-06 and ADR-07 (Independent Thinker, argument 3): hybrid discovery.** A per-instance `RouteRegistry` records typed and `describe()` routes at declaration, as `{method, localPath, meta, validatorFn, handlerFn}`. It lives in **`src/registry/registry.ts` (new component C12, owned by S-04 typed-route)**; `describe.ts` (S-05) only calls its `register()` API. The stack walk (C5) does exactly two things: (a) attach mount prefixes by matching layer handles by identity against the registered `validatorFn` **or** `handlerFn`; (b) find plain routes. A registry entry that the walk cannot locate is still emitted with its local path, plus one `warn` (ADR-19). `getSpec()` before any request returns the registry at local paths. `getSpec({ app })` walks and returns full paths. ADR-06's "tag registry" now has an owner. ADR-07's `[META]` tag stays only as a secondary match key. | The ADR-06 registry had no owner, and relying on tags alone loses schemas silently when a handler is wrapped. Spike S-4b (below): with the hybrid, the typed route whose validator a user wrapped was still found (matched on `handlerFn`) on both majors, `registry-missing-from-walk: none`. A failed walk now leaves a correct schema under a wrong prefix, instead of losing the schema. | ADR-07 kept as-is (spike S-1: tags alone lose the wrapped route). "`getSpec()` requires `{app}`" alone, which makes build-script usage worse. |
| ADR-18 | **[Amended by ADR-20 (`Symbol.for` guard), ADR-23 (`installRecorder`), ADR-24 (`auto-record` entry, opt-out), ADR-27a (sniff).]** **AMENDS C5 (spike result, a design change): a record-only mount recorder.** Spike S-1/S-2 showed that Express 5 layers keep **no mount-path string**: the keys are `handle, keys, name, params, path, slash, matchers, route`, `path` is undefined until a request arrives, and `matchers[0]` is a closure over a private `regexp`. On both majors a mounted sub-app is an opaque `mounted_app` closure. So a static walk cannot produce `/api/users/{id}` on Express 5 (AC-023) or reach sub-app routes at all. The fix: when `express-api-docs` is imported, `src/introspect/recorder.ts` (S-05) wraps the `use` method on the prototype that **owns** it. Because of Express 5's two-level router prototype, this is found by walking the prototype chain. It also wraps `express.application.use`. The wrappers call the original first, then only **annotate** the newly pushed layers with `[MOUNT]=path` and `[CHILD]=subApp`. They never change dispatch. The recorder is idempotent (guarded by a symbol) and is installed per resolved Express module instance. Express 4 falls back to `layer.regexp` for mounts made before the import. Express 5 mounts made before the import get the local path and a `warn`. Version access is by key: `app._router` on v4 and `app.router` on v5. **On Express 4, reading `app.router` THROWS** (spike S-4a), so the sniff must never read it. | This is the only mechanism the spike showed to work for the nested Router, the sub-app and the wrapped handler on both majors (S-4b). It differs from the `app.get` monkey-patch rejected in risk-first: it wraps `use` only, it only annotates, and it runs at import, so the order in which routes are defined does not matter as long as the package is imported first. The README must document "import express-api-docs before mounting routers". | Probing `matchers[0]` with candidate strings (the prefix is unknowable). Requiring an explicit `api.mount(prefix, router)` helper (fails AC-023, which covers plain routes). Documenting Express 5 nested mounts as unsupported (fails AC-023). |
| ADR-19 | **AMENDS C5 and C6 logging (Independent Thinker, argument 2).** These are logged at **`warn`** through the configured logger, once per layer or route per walk: a registry entry not found in the stack, an unrecognised layer shape, a mount whose prefix cannot be recovered, a `mounted_app` without `[CHILD]`, and a layer skipped because it threw. Only the AC-034 skips stay at `debug`: `RegExp` paths and unnamed `*` wildcards, which the spec expects. | Silent degradation was the Thinker's failure scenario: valid but wrong OpenAPI with only a debug trace. A warn makes it visible without throwing. This keeps "detection never throws", and AC-034's "one debug log line each" is unaffected. | Throwing (breaks `/openapi.json` for one odd layer), and keeping everything at debug. |
| ADR-20 | **AMENDS C0, ADR-17 and ADR-18 (resolves PF-1, CR-1, F-3): cross-copy identities use `Symbol.for`.** There are exactly four, defined in `src/core/types.ts` (S-01): `META = Symbol.for('express-api-docs.meta')`, `MOUNT = Symbol.for('express-api-docs.mount')`, `CHILD = Symbol.for('express-api-docs.child')` and `RECORDER = Symbol.for('express-api-docs.recorder')` (the idempotency guard stored on each patched prototype). Local `Symbol()` is **banned** for any value that crosses module boundaries. An ESLint `no-restricted-syntax` rule on `src/**` enforces this, with an allow-list comment for purely local symbols. New test `test/dist/dual-load.test.ts` (S-01, run after build) **[location SUPERSEDED by epic.md → `test/entries/dual-load.test.ts`, owned by S-07]** loads `dist/index.js` via `import` **and** `dist/index.cjs` via `require` in one process. It asserts that `use` is wrapped exactly once (via the guard), that a route defined through the ESM copy is found with its metadata by the CJS copy's `getSpec({app})`, and that the Express 5 mount prefix survives the mix. | tsup emits one copy of each module per format, so module-local symbols differ between the ESM and CJS copies (the dual-package hazard). `Symbol.for` uses the process-wide registry, so both copies agree on it. | Forcing ESM-only (breaks AC-002/003). A shared-state `globalThis` object (a weaker convention than `Symbol.for`). |
| ADR-21 | **AMENDS ADR-04, C2 and C9 (resolves PF-2; the PRD is amended in parallel).**<br>• **Peers:** `zod` becomes an **optional peer**: `peerDependencies.zod: ^4.0.0` plus `peerDependenciesMeta.zod.optional: true`. The core (`.` entry) **never imports `zod`**. An ESLint `no-restricted-imports` rule on `src/**` except `src/adapter/zod.ts` enforces this, and a pack test greps `dist/index.{js,cjs}` for `zod`. **[Plus a load test with `zod` unresolvable: `test/entries/no-zod-load.test.ts`, owned by S-07 per epic.md.]**<br>• **Default adapter:** the core ships `standardSchemaAdapter` (`src/adapter/standard.ts`, S-03). It validates via `schema['~standard'].validate` and converts via `schema['~standard'].jsonSchema.{input,output}({ target: 'draft-2020-12' })`. The Standard Schema type definitions are vendored as types only, in `src/adapter/standard-types.ts`, so there is no runtime dependency.<br>• **Result:** zero-options `createApiDocs()` accepts Zod v4 schemas (AC-035) with no zod import in core.<br>• **Zod subpath:** `zodAdapter` lives **only** at the subpath export `express-api-docs/zod` (`src/zod.ts` → `adapter/zod.ts`). It adds Zod-specific handling: `unrepresentable: 'any'` and typed `z.infer`.<br>• **Exports map:** `.` and `./zod`, each with `import`/`require`/`types`. | ADR-04's rationale says a non-Zod user must not need Zod. PF-2 showed that a barrel export of `zodAdapter` breaks at startup when zod is absent. Moving it after the first publish would be a semver-major change, so it is fixed now. **Probe (below):** zod 4.6.5 exposes `~standard.{validate,vendor,version,jsonSchema}`, `validate({id:'3'})` gives `{"value":{"id":3}}`, and `jsonSchema.input({target:'draft-2020-12'})` emits a draft 2020-12 schema. So the core default works on Zod without importing it. | Making zod a required peer with `zodAdapter` in the barrel (PF-2). Dynamic `import('zod')` in the core (async, and still couples the core to zod). |
| ADR-22 | **AMENDS Q5, ADR-15 and C10 (resolves F-1, F-2, PF-7; the human dropped Node 20).**<br>• **Floor and CI:** `engines.node` is `>=22`. The CI matrix is node {22, 24} × express {4, 5}. `actions/setup-node` uses `node-version: 22` and `24`, which resolve to the latest minors.<br>• **Dev-tooling floor:** Node >= 22.19, which contributors and CI need. It is set by the highest engine among the pinned tools (probes below): `@apidevtools/swagger-parser` `>=22.19.0`, `eslint` `^22.13.0`, `vitest` `^22.12.0`, Stryker `>=22.0.0`. `.nvmrc` = `24`.<br>• **Pre-declared devDependencies** (S-01 is the only `package.json` owner): add `vite@^8.3.1` (vitest peer `^6.4\|\|^7\|\|^8`) and `@types/node@~22.20.4`. The latter satisfies the vitest peer `^22.0.0\|\|>=24.0.0` and pins the typing floor to the engines floor, so a Node 24-only API fails typecheck (PF-7).<br>• **Unchanged pins:** all other pins from ADR-11/12/15/16 stay; their engines are satisfied (below). | vitest 5.0.2 and Stryker 10 cannot run on Node 20 (F-1). The human resolved this by dropping Node 20. Every tool pin was re-probed for `engines`. | F-1 options (a) and (b): Node 20 smoke-only, or downgrading to vitest 3.x. Both became moot when the human dropped Node 20. |
| ADR-23 | **AMENDS ADR-18 and R-8 (resolves CR-2, F-5, test-strategy #1): a public `installRecorder(expressModule)`.**<br>• **Export:** exported from `.` (and re-exported from `./manual`, see ADR-24). It is idempotent through `RECORDER` on the owner prototypes.<br>• **Default install:** `src/introspect/auto-record.ts` resolves `express` from the package's own location (`createRequire(import.meta.url)` in ESM, `require` in CJS; tsup shims) and calls `installRecorder()` on it. A resolution failure is swallowed with one `warn`.<br>• **Explicit install:** users with a second Express copy (pnpm, monorepos, bundlers that inline Express) call `installRecorder(require('express'))` from their own code.<br>• **Mismatch warning:** at the first walk, if the app's router owner prototype lacks `RECORDER`, the package emits exactly one `warn` with code `EAD_RECORDER_NOT_INSTALLED`. The message names the fix (`installRecorder(<your express>)`).<br>• **Repo tests:** fixtures call `installRecorder(require('express4'))` explicitly. This is the **documented public path for a second copy**, not a test-only shortcut. The root `express` copy exercises the default auto path. `test/introspect/recorder-mismatch.test.ts` builds an app from a copy that has *not* been installed (a fresh `express4` module instance, isolated with `vi.resetModules`) and asserts the single warn and local-path fallback. | This makes the "second copy" case supported and testable instead of documented as a hole. It also stops the dual-major tests from proving a path users never run (test-strategy #1): the express4 path is exactly what a monorepo user does. | Auto-patching every `express` found in `require.cache` (magic, and it misses ESM-only loads). Test-only private hooks (they prove a path users cannot use). |
| ADR-24 | **AMENDS ADR-18 and C10 (resolves PF-4, F-4, CR-10): an import-time patch opt-out and a scoped `sideEffects`.**<br>• **Entries:** the import-time side effect is isolated in its own tsup entry, `src/auto-record.ts` → `dist/auto-record.{js,cjs}`. `src/index.ts` begins with a bare `import './auto-record'`.<br>• **Opt-out:** the entry `express-api-docs/manual` (`src/manual.ts`) re-exports the identical public API **without** that import. Users who import from `/manual` get no global patch until they call `installRecorder()` themselves. This suits hot-reload, many-instances and APM-ordering-sensitive setups. It is code-only, which keeps "config is code-only" (PRD out-of-scope).<br>• **`sideEffects`:** `package.json` has `"sideEffects": ["./dist/auto-record.js", "./dist/auto-record.cjs"]`. It is **never `false` and never `true`**.<br>• **Tests (S-01; see marker for the S-07 move):** `test/dist/pack.test.ts` asserts the exact `sideEffects` array. `test/dist/bundle.test.ts` bundles a fixture **[location SUPERSEDED by epic.md → `test/entries/bundle.test.ts`, owned by S-07; `pack.test.ts` stays in `test/dist/` (S-01)]** that imports from `dist/index.js` with esbuild (`--bundle --platform=node --external:express`) and asserts the Express 5 `/api/users/{id}` prefix. `esbuild` is already a transitive dependency of tsup; S-01 adds it as an explicit devDependency, pinned at scaffold time with a probe. | Express middleware is conventionally inert until mounted (PF-4), so an escape hatch is required. Listing only the recorder files keeps the rest of the package tree-shakeable, and bundlers cannot drop the patch. | An environment-variable opt-out (process-global, and it would be the only non-code config). `sideEffects: true` (defeats tree-shaking). |
| ADR-25 | **AMENDS ADR-13 (resolves test-strategy #2 and #8; partly CR-9).**<br>• **Fixture parameterization:** fixtures are parameterized by the **detected installed major**, not by a package name. `test/fixtures/majors.ts` (S-05) reads the `version` from `express/package.json` and `express4/package.json`, **dedupes by major**, and exports `majors: Array<{ major: 4\|5, express }>`.<br>• **Matrix cells:** in the CI cell `express: 5`, both majors run. In the cell `express: 4` the step `npm i --no-save express@4.22.3` swaps the root, so both entries are v4. After deduping, only v4 runs, and it runs through the **default auto-record path**.<br>• **Major-specific cases:** Express 5-only cases (the `/*rest` named wildcard in AC-034, `{/:id}` optionals, the `app.router` sniff) use `it.skipIf(major !== 5)`. Express 4-only cases (`*`, `:id?`) use `skipIf(major !== 4)`.<br>• **Typecheck:** it runs only in the `express: 5` cell, which matches `@types/express` 5.<br>• **Workflow test:** `test/meta/workflows.test.ts` asserts that the install step references `${{ matrix.express }}` (test-strategy #8). One real green CI run is required as Delivery evidence.<br>• **Peer-floor job (CR-9):** a separate blocking job `peer-floor` on node 24 installs `express@4.21.0`, then `express@5.0.0` with `router@2.0.0`, and runs `test/introspect/**` so the layer shapes at the bottom of the peer range are verified. | In the old design, the "Express 5" tests ran on v4 in the v4 cell, which gave red CI for a correct implementation. The peer range claims versions that nothing verified. | Dropping the root swap and relying only on the alias (the v4 default auto path would never be tested). Narrowing the peer range (a user-facing restriction with no evidence of need). |
| ADR-26 | **AMENDS "Bench Commands & budgets" (resolves test-strategy #3): the perf gate becomes enforceable.**<br>• **Harness:** perf tests are ordinary vitest tests in `test/perf/*.perf.test.ts` (S-07). They are excluded from `npm test` and run by `npm run perf` (`vitest run --config vitest.perf.config.ts`), which fails on budget breach.<br>• **Method:** for each scenario, 50 warm-up requests via an in-process `http.Server` and supertest, then **N = 300** timed samples. p95 is computed by nearest-rank.<br>• **Noise policy:** the budget is p95 < 200 ms (the constitution). A scenario fails only if p95 exceeds the budget in **2 of 3** consecutive in-process measurement rounds. There are no retries beyond that, and the measured numbers are printed for evidence.<br>• **CI:** runs in exactly one pinned, blocking cell: ubuntu-latest, node 24, express 5. Local Windows results are informational only (Defender scanning `node_modules` makes them noisy).<br>• **`vitest bench`:** files remain informational trend reports and are **not** the gate. | `vitest bench --run` never fails on latency, so labelling it "gate" was false. The 200 ms budget is about 2 orders of magnitude above the expected cost, so a 2-of-3 rule removes runner jitter without masking real regressions. | Downgrading to report-only (the constitution has a real budget, and it is cheap to enforce). Asserting inside `vitest bench` (unsupported and flaky). |
| ADR-27 | **Fixes contradictions (resolves CR-4, CR-5, CR-6, test-strategy #6).**<br>**(a) CR-4. The C5 text "falling back to the other" is VOID.** The sniff is key-only and throw-free: (code: see "Pinned seams (ADR-27)" below) `app.router` is **never** read when `isV4`.<br>**(b) CR-5.** S-05 **depends on S-04 and S-01**, as in `epic.md`, because `describe.ts` and the walker call the S-04 registry. The line "S-05 depends on S-01 and C0" is superseded.<br>**(c) CR-6.** The `RouteRegistry` interface is **pinned in `src/core/types.ts` (S-01)**. S-04 implements it in `src/registry/registry.ts`, and S-05 and S-06 consume it: (code: see "Pinned seams (ADR-27)" below) **(d) Test-strategy #6.** The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**` and `src/adapter/**`. `thresholds.break` stays at 70. | The builder was handed two contradictory instructions (CR-4). The scheduler could have run S-05 before S-04 (CR-5). A prose-only seam between three stories (CR-6). Unmeasured logic in the registry and adapter (test-strategy #6). | — |
| ADR-28 | **Constitution deviations, recorded for the human at G2. `constitution.md` is NOT edited.** (1) The build is `tsup` (ADR-11), while the constitution says `npm run build (tsc)`. `npm run build` stays the canonical command name, and `tsc --noEmit` remains the typecheck. (2) `engines.node` is `>=22`, with CI on 22 and 24 (ADR-22), while the constitution says "Node.js (v24)". (3) The canonical commands `check:pack`, `mutation`, `perf` and `audit` are added. The G2 reviewer is asked to amend the constitution or to reject these deviations (resolves PF-5 and PF-7 as recorded deviations). | Supervision requires deviations from standing law to be explicit, not silent. | Editing the constitution from a change artifact (not the architect's authority). |
| ADR-29 | **Cheap test and shape obligations (resolves CR-3, CR-7, CR-8, F-6, PF-3, PF-6, test-strategy #4, #5, #7, #9).**<br>• **CR-3:** `test/introspect/apm-order.test.ts` applies a third-party-style wrapper (`proto.use = wrap(proto.use)` plus a layer-handle wrapper) **before and after** `installRecorder`. It asserts that prefixes survive in both orders, and the result is documented in the README. If "after" fails, it must emit `warn` `EAD_LAYER_UNRECOGNISED`, not fail silently.<br>• **CR-7:** `test/route/send-delegation.test.ts` asserts, on both majors, that `res.send(invalidObject)` is validated when `validateResponses: 'error'`.<br>• **CR-8:** if `req.app.parent` exists, the walk emits one `warn` `EAD_MOUNTED_IN_SUBAPP` and walks from the topmost ancestor (`while (app.parent) app = app.parent`).<br>• **F-6:** the recorder computes "new layers" from `stack.length` **captured before** calling the original `use`. This applies in both wrappers, and the rule is stated in ST-005.<br>• **PF-3:** `@types/express` (`^4.17.21 \|\| ^5.0.0`) is added as an **optional** peer through `peerDependenciesMeta`.<br>• **PF-6:** the top-level `"types"` field is `./dist/index.d.cts`, and the `"module"` field is dropped, so that attw's `node10` profile passes.<br>• **Test-strategy #4:** the AC-024 test asserts that the error middleware is called **exactly once** on both majors, plus a direct unit test of `wrapAsync`, which forwards rejections to `next` and does not call it again after headers are sent.<br>• **Test-strategy #5:** `test/dist/**` runs `npm run build` **unconditionally** in `globalSetup`. **[Per epic.md: `test/dist/global-setup.ts` (S-01) is registered suite-wide so `test/entries/**` (S-07) also gets a fresh build.]**<br>• **Test-strategy #7:** every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient.<br>• **Test-strategy #9:** each fixture gets a dedicated logger spy, and warn assertions filter by the stable message `code` (`EAD_*`). | Each obligation is small, closes a silent-failure path the reviewers named, and has an owning story file. | — |
| ADR-30 | **Findings deferred or not actioned.**<br>• **F-7:** n/a (informational, nothing blocks).<br>• **CR-9 residual:** covering *every* minor version between the floor and the latest is deferred to a follow-up change. The floor and latest are covered by ADR-25, and covering every minor would multiply CI cost for little extra signal.<br>No findings were rejected. | — | — |
| ADR-31 | **Standard Schema adapter edge behaviour (derived by the ST-003 author; one accepted, one amended).**<br>• **(1) Async `validate`: AMENDED.** The author derived: "`~standard.validate` returning a Promise yields an error result". The amended rule: `standardSchemaAdapter.validate` **throws** `ApiDocsSchemaError` (exported, code `EAD_ASYNC_SCHEMA`, naming the route and the schema vendor). Before throwing, it attaches a no-op `.catch` to the returned Promise, so there is no unhandled rejection. The C3 validator already runs inside `wrapAsync`, so the error reaches `next(err)` and the client gets a **500**. The same error is raised at definition time if an optional probe detects an async refinement. `ApiDocsSchemaError` lives in `src/adapter/errors.ts` (S-03).<br>• **(2) Missing `jsonSchema`: ACCEPTED.** When `~standard.jsonSchema` is absent (or its `input`/`output` call throws), `toJSONSchema` returns `{}` and emits exactly one `warn` per schema identity, code `EAD_SCHEMA_NO_JSONSCHEMA`, through the configured logger. The `WeakMap` memo in `memo.ts` guarantees the once-per-schema rule. | (1) An `{ok:false}` result would be turned into a **400 problem+json that blames the client** for a server-side schema choice (AC-007 semantics), and it would retry on every request without surfacing the defect. A 500 with a named error is the honest outcome, and it matches the AC-024 async-error path. Sync-only validation keeps the hot path allocation-free (ADR-03).<br>(2) `{}` is a valid JSON Schema, so AC-015 still passes. It degrades docs, not runtime, which is consistent with R-7 (`unrepresentable: 'any'`) and R-9. The `warn` keeps it visible per ADR-19. | (1) Supporting async validation by awaiting in the validator (changes the `SchemaAdapter.validate` contract pinned in C2 and adds a per-request Promise; deferred to a later additive `validateAsync?` method). The author's `{ok:false}` 400 mapping (blames the client). (2) Throwing at spec time (breaks `/openapi.json` for one schema). Omitting the schema from the operation (hides that a body exists). |

## Pinned seams (ADR-27)

(a) Version sniff (key-only, never throws, CR-4):

```ts
const isV4 = Object.prototype.hasOwnProperty.call(app, '_router') || typeof app.lazyrouter === 'function';
const root = isV4 ? (app.lazyrouter?.(), app._router) : app.router;
```

(c) `RouteRegistry` contract in `src/core/types.ts` (owner: S-01; implementation: S-04 `src/registry/registry.ts`; consumers: S-05, S-06):

```ts
export interface RegistryEntry {
  readonly id: number;                 // registration order, for A-3 collision suffixes
  readonly method: HttpMethod;
  readonly localPath: string;          // Express syntax, as declared
  readonly source: 'typed' | 'describe';
  readonly meta: OperationMeta;
  readonly validatorFn?: RequestHandler; // typed only
  readonly handlerFn: RequestHandler;
}
export interface RouteRegistry {
  register(entry: Omit<RegistryEntry, 'id'>): RegistryEntry;
  entries(): readonly RegistryEntry[];                    // registration order
  findByHandle(fn: unknown): RegistryEntry | undefined;   // identity match on validatorFn OR handlerFn
}
```

## Introspection spike — gate G-S05 (must pass before S-05 auto-detect is committed)

**Gate.** Before S-05 is committed, `test/introspect/spike.contract.test.ts` must pass on `express@5.2.1` and `express4@npm:express@4.22.3`. It re-encodes the S-4b fixtures below: a nested Router, a mounted sub-app, a wrapped handler and a plain route. S-05 owns the test, and S-05's first task is to run it. **Status as of 2026-09-27: PASS, via the throwaway spike below** (run outside the repo, in `%TEMP%\aidd-spike`).

```
$ cd "$TEMP/aidd-spike" && npm init -y && npm i express5@npm:express@5.2.1 express4@npm:express@4.22.3   exit 0
found 0 vulnerabilities
```

S-1: static walk, tag on handler (`spike.cjs`). Fixtures: `app.use('/api', r)` with `r.get('/users/:id')`; `app.use('/v1', subApp)`; `app.get('/w', wrap(tagged))`, where `wrap = fn => (req,res,next) => fn(req,res,next)`. Exit code 0.
```
== express4 root=_router
{"name":"router",...,"regexp":"/^\\/api\\/?(?=\\/|$)/i","sub":"router"}      <- v4 prefix recoverable
{"name":"mounted_app",...,"regexp":"/^\\/v1\\/?(?=\\/|$)/i"}                   <- sub-app opaque
{"name":"bound dispatch",...,"route":"/w","metaDirect":[null]}                 <- tag LOST by wrapper
== express5 root=router
{"name":"router","keys":["handle","keys","name","params","path","slash","matchers","route"],"sub":"router"}  <- NO prefix string
{"name":"mounted_app",...}                                                      <- sub-app opaque
{"name":"handle",...,"route":"/w","metaDirect":[null]}                          <- tag LOST
```
Verdict for S-1: v4 nested PASS. v5 nested FAIL. Sub-app FAIL on both majors. Wrapper FAIL on both majors. **ADR-07 as written does not hold.**

S-2: Express 5 matcher and sub-app reachability (`spike2.cjs`). Exit code 0.
```
express5 {"matcherProps":["length","name","prototype"],"matcherSrc":"function match(input) {\n        const m = regexp.exec(input)","probeApi":true,"subMountpath":"/v1","subParentIsApp":true,"mountedAppHandleProps":["length","name","prototype"]}
```
The matcher is an opaque closure. The sub-app knows its own `mountpath`, but the parent cannot enumerate it.

S-3: hybrid registry plus a recorder patched on the wrong prototype level (`spike3.cjs`). Exit code 0, result FAIL:
```
== express5
GET ?/users/:id meta=nested
registry-missing-from-walk: subapp,wrapped
```
Cause: an Express 5 `Router()` is a function whose prototype is a Router *instance*, so `use` lives two levels up (`sameProto false hasOwnUse false`). Hence ADR-18 says "the prototype that owns `use`".

S-4a: first run of `spike4.cjs`. Exit code 1:
```
Error: 'app.router' is deprecated!  at app.get (express4/lib/application.js:131)
```
Reading `app.router` on Express 4 throws, so the sniff must use keys (ADR-18).

S-4b: `spike4.cjs` with the ADR-17 hybrid plus the ADR-18 recorder (owner-prototype `use` and `application.use`). Exit code 0, result **PASS**:
```
== express4
GET /api/users/:id meta=nested
GET /v1/items/:id meta=subapp
GET /w meta=wrapped
GET /plain meta=none
registry-missing-from-walk: none
== express5
GET /api/users/:id meta=nested
GET /v1/items/:id meta=subapp
GET /w meta=wrapped
GET /plain meta=none
registry-missing-from-walk: none
```
Remaining cases that the ADRs handle rather than solve:

- If a user wraps **both** our validator and the handler, identity matching fails. The route is emitted at its local path with a `warn` (ADR-17/19).
- Express 5 mounts made before the package is imported fall back the same way (ADR-18).

## Verification Commands

Canonical. Every downstream agent runs these verbatim. **Status: the package-script commands are "probe after scaffold story (S-01)", NOT passing.** The repo has no `package.json`, and the evidence below proves only that the tools exist and resolve.

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`, probe after scaffold story (the CLIs themselves were probed below)
- e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`.
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`), probe after scaffold story (the CLI was probed below)
- audit: `npm audit --audit-level=critical`, probe after scaffold story
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`), probe after scaffold story
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

### Probe evidence (2026-09-27, run from a temp dir, Git Bash on win32)

```
$ node --version            → v24.11.1        exit 0
$ npm --version             → 11.4.2          exit 0
```

```
$ npm view <pkg> version    (each exit 0)
typescript 7.0.2      (typescript@5 → 5.9.3; typescript@6 → 6.0.3)
tsup 8.5.1            vitest 5.0.2          @vitest/coverage-v8 5.0.2
supertest 7.3.0       @types/supertest 7.2.1 @types/express 5.0.6
eslint 10.11.0        typescript-eslint 8.70.1 prettier 3.9.9
publint 0.3.24        @arethetypeswrong/cli 0.18.5
@stryker-mutator/core 10.0.0  @stryker-mutator/vitest-runner 10.0.0
@apidevtools/swagger-parser 13.1.0
zod 4.6.5   express 5.2.1   express@4 → 4.22.3
@scalar/api-reference 1.72.1 (CDN pin)   swagger-ui-dist 5.33.0 (CDN pin)
```

```
$ npm view typescript-eslint peerDependencies   exit 0
{ eslint: '^8.57.0 || ^9.0.0 || ^10.0.0', typescript: '>=4.8.4 <6.1.0' }   ← drives ADR-12
$ npm view tsup peerDependencies                exit 0
{ ..., typescript: '>=4.5.0' }
$ npm view @vitest/coverage-v8 peerDependencies exit 0
{ vitest: '5.0.2', ... }
$ npm view @stryker-mutator/vitest-runner peerDependencies exit 0
{ vitest: '>=2.0.0', '@stryker-mutator/core': '10.0.0' }
```

```
$ npx --yes publint --help | head -5                         exit 0
  Usage
    $ publint <command> [options]
$ npx --yes -p @arethetypeswrong/cli attw --help | head -4   exit 0
ATTW CLI (v0.18.5)
Usage: attw [options] [file-directory-or-package-spec]
$ npx --yes -p @stryker-mutator/core stryker --version       exit 0
10.0.0
$ npx --yes -p @apidevtools/swagger-parser node -e "1"       exit 0
```

```
$ ls "C:/sai/code practice/Package/API-DOCS"   exit 0
AGENTS.md          ← no package.json: package scripts cannot be probed yet
```


### Probe evidence: amendment round 2 (pre-review)

```
$ npm view <pkg> engines --json   (each exit 0)
vitest {"node":"^22.12.0||^24.0.0||>=26.0.0"}   vite {"node":"^20.19.0||>=22.12.0"}
tsup {"node":">=18"}   eslint {"node":"^20.19.0||^22.13.0||>=24"}
typescript-eslint {"node":"^18.18.0||^20.9.0||>=21.1.0"}   prettier {"node":">=14"}
publint {"node":">=18"}   @arethetypeswrong/cli {"node":">=20"}
@stryker-mutator/core {"node":">=22.0.0"}   @stryker-mutator/vitest-runner {"node":">=22.0.0"}
supertest {"node":">=14.18.0"}   @apidevtools/swagger-parser {"node":">=22.19.0"}   <- dev floor 22.19
$ npm view vite version            -> 8.3.1                exit 0
$ npm view @types/node@22 version  -> 22.20.4 (latest 26.6.3)   exit 0
$ npm view vitest peerDependencies  exit 0
{"vite":"^6.4.0||^7.0.0||^8.0.0", ..., "@types/node":"^22.0.0||>=24.0.0", ...}
```

```
$ cd "$TEMP/aidd-spike" && npm i zod@4.6.5 && node -e "<~standard probe>"   exit 0
keys [ 'validate', 'vendor', 'version', 'jsonSchema' ]
validate {"value":{"id":3}}
jsonSchema [ 'input', 'output' ]
{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"id":{"type":"number"}},"required":["id"]}
```

## Bench Commands & budgets

> **Superseded in part by ADR-26:** the "gate" rows below are enforced by `npm run perf` (`test/perf/*.perf.test.ts`: N=300 after 50 warm-up requests, nearest-rank p95 < 200 ms, fail if 2 of 3 rounds exceed the budget, one pinned CI cell). `vitest bench` commands are informational trend reports only.

The constitution's budget is p95 endpoint latency of 200ms. That budget is the gate. The tighter library targets are informational, so they are non-blocking until a baseline exists (grafted from scalability-first's bench idea, reduced in scope). The files live in `bench/*.bench.ts`, owned by S-07. All benches are probed after the scaffold story.

| Bench id | Command | Budget |
|---|---|---|
| B-1 spec-endpoint | `npx vitest bench --run bench/spec-endpoint.bench.ts` (GET `/openapi.json`, 200 mixed routes, warm cache) | p95 < 200 ms (**gate**, constitution); informational target < 5 ms |
| B-2 spec-cold | `npx vitest bench --run bench/spec-cold.bench.ts` (first request after `invalidate()`, 200 routes, Express 4 and 5) | p95 < 200 ms (**gate**) |
| B-3 typed-route | `npx vitest bench --run bench/typed-route.bench.ts` (valid POST through validator vs plain handler) | p95 < 200 ms (**gate**); informational overhead < 50 µs |
| B-4 docs-endpoint | `npx vitest bench --run bench/docs-endpoint.bench.ts` | p95 < 200 ms (**gate**) |

## Risks

1. **R-1 (high): reliance on Express private internals** (`_router`, `router.stack`, `layer.regexp`, and the v5 matchers). Mitigations:
   - one module per major version;
   - a try/catch around each layer;
   - degradation to "undocumented" instead of an exception;
   - fixture contract tests on both majors;
   - CI pinned to specific minor versions.

   Express 6 will need a new adapter, which is an additive change.
2. **R-2 (medium): heuristic recovery of Express 4 mount prefixes from `layer.regexp`.** Unusual mounts (regexp or array mounts) are skipped and logged, not guessed.
3. **R-3 (medium): ADR-08 deviates from A-6** by not reading `info` from `package.json`. This needs human confirmation at G2.
4. **R-4 (medium): `OPTION_SPEC` has hand-written validators,** so the quality of error messages depends on discipline. Mitigations are one test per AC-045 example and Stryker on `config/**`.
5. **R-5 (low): TS devDependency pin (ADR-12).** The `.d.ts` output must still type-check for consumers on TS 6 and 7. A follow-up adds a consumer type-check matrix.
6. **R-6 (low): response validation covers only `res.json` and `res.send(object)`.** Raw strings and streams are not validated, and this is documented.
7. **R-7 (low): `z.toJSONSchema` with `unrepresentable: 'any'`** emits `{}` for transforms and custom types, so the docs are lossy by design. This is documented in the README.

8. **[Mitigated further by ADR-23 (`installRecorder`, `EAD_RECORDER_NOT_INSTALLED`) and ADR-24 (opt-out).]** **R-8 (high, added by ADR-18/19): mount-path recording depends on import order and on the Express module instance.**
   - Mounts made before the package is imported, or on a second copy of Express, cannot be recorded. Express 4 falls back to `layer.regexp`; Express 5 gets the local path.
   - Lost handler identity (a user wrapping both functions), unrecognised layers and unrecoverable prefixes are **logged at `warn`**, never at `debug` and never thrown. Only the AC-034 RegExp and wildcard skips stay at `debug`.
   - Mitigations: gate G-S05; the README rule "import before mounting"; a test asserting that exactly one warn fires for each of these cases.
9. **[Edge behaviour pinned by ADR-31.]** **R-9 (medium, ADR-21): the core default adapter depends on the Standard Schema and Standard JSON Schema hooks (`~standard.jsonSchema`).** These hooks were verified on zod 4.6.5. Zod releases below that version, or libraries without `jsonSchema`, need an explicit adapter. Mitigation: `standardSchemaAdapter` throws `ApiDocsConfigError`-style guidance when defining a route whose schema lacks `~standard`. It emits a `warn` and uses the schema `{}` in the spec when `jsonSchema` is absent. The README recommends `express-api-docs/zod` for Zod users.
10. **R-10 (medium, ADR-28): constitution deviations** (the tsup build and the Node >= 22 floor) are pending the human's decision at G2. If they are rejected, ADR-11 and ADR-22 need a backflow amendment.
