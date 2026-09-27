---
id: ST-006
title: "Spec builder: dedupe, glob, naming, canonical sort and fingerprint cache"
wave: 5
status: queued
attempts: 0
ac_ids:
  - AC-011
  - AC-015
  - AC-016
  - AC-017
  - AC-030
  - AC-031
  - AC-032
  - AC-033
  - AC-034
  - AC-038
  - AC-039
  - AC-041
  - AC-042
depends_on:
  - ST-002
  - ST-003
  - ST-005
file_scope:
  owns:
    - "src/spec/**"
    - "test/spec/**"
  creates:
    - "src/spec/"
    - "test/spec/"
---

# ST-006 (epic row S-06): Spec builder: dedupe, glob, naming, canonical sort and fingerprint cache

## Context

Epic id mapping: epic row **S-06** is story id **ST-006** (the schema requires `ST-NNN`). Wave 5. Depends on S-02 (ST-002, config), S-03 (ST-003, adapter) and S-05 (ST-005, introspection); S-05 itself depends on S-01 and S-04 (ADR-27b), so the S-01 `RouteRegistry` contract and the S-04 implementation are both on disk when this story starts. Risk: **medium**, because of byte determinism (AC-034), dedupe precedence and swagger-parser validity.

Epic "Stories needing refresh" row for this story (verbatim): "It should consume `RouteRegistry.entries()` and ids through the pinned interface (ADR-27c; A-3 collision suffixes use `id`), plus the merge rule." Epic waves (verbatim): "**Wave 5: S-06.** It consumes `RouteRegistry.entries()`." Epic test obligations (verbatim): "The builder reads registry entries only through the `RouteRegistry` interface from `core/types.ts`."

**File ownership (exact, from the epic ownership matrix):** owns `src/spec/**`, `test/spec/**`; creates `src/spec/`, `test/spec/`. Do NOT edit anything else:

- `package.json`, lockfile, `src/core/types.ts`, `eslint.config.js`, `vitest.config.ts`, `stryker.config.mjs` belong to S-01. Record any devDependency or config request in the Builder Report instead.
- `src/registry/**` and `src/route/problem.ts` belong to S-04; `src/adapter/**` to S-03; `src/config/**` to S-02.
- `src/introspect/**`, `src/route/describe.ts` and the shared fixtures `test/fixtures/**` (including `majors.ts` and `logger.ts`) belong to S-05: import them, do not edit them.
- `src/index.ts`, `src/manual.ts`, `src/zod.ts` belong to S-07.

The repo was greenfield at inception (context pack: "the repo is greenfield. No re-crawl was done."). The files listed below are produced by earlier waves; read them from disk before starting.

### Pinned `RouteRegistry` contract (architecture.md "Pinned seams (ADR-27)" (c), verbatim)

"`RouteRegistry` contract in `src/core/types.ts` (owner: S-01; implementation: S-04 `src/registry/registry.ts`; consumers: S-05, S-06)":

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

Rules for this story:

- Import only the **types** `RouteRegistry` / `RegistryEntry` from `src/core/types.ts`. Never import `src/registry/registry.ts` from `src/spec/**` (depend on the interface, not the S-04 implementation). Tests may construct a real registry or a hand-built stub satisfying the interface.
- Read entries only via `entries()`. Registry entries not located by the walk are still emitted at `localPath` (ADR-17).
- **A-3 collision suffixes use `RegistryEntry.id`**: when two operations would get the same default `operationId`, order the suffixing by `id` (registration order), never by array position after sorting or by object-key order, so output is byte-stable (AC-034).

### Component contract (architecture.md, verbatim)

> | C6 | `spec/build.ts`, `spec/naming.ts`, `spec/glob.ts`, `spec/canonical.ts` | `buildSpec(ops, config, adapter)`. It dedupes with precedence typed = describe > plain (AC-031) and applies `include`/`exclude` through the in-house `glob.ts` (`*` and `**` only). It self-excludes `specPath` and `docsPath`. Default operationIds and tags follow A-3/A-4 in `naming.ts` and can be overridden by strategies. It adds the auto-400 `$ref` ProblemDetails, applies global security inheritance (route `[]` wins), applies `detectedDefaultResponse`, and applies `info`/`servers`/`tags`. Output goes through a canonical key sort. | 011, 015–017, 031, 033, 034, 038, 039, 041, 042 | zod-to-openapi `OpenApiGeneratorV31`; glob from simplicity-first | S-06 spec |

> | C7 | `spec/cache.ts` | A lazy cache keyed on a fingerprint: the total layer count, summed recursively across nested router stacks. `invalidate()` clears it. | 032 | Nested fingerprint: risk-first C7 / scalability-first C1; `invalidate()` from scalability-first C10 | S-06 spec |

> The spec is produced by a pure function, `buildSpec(operations, config)`. It has no dependency on Express and does no IO. Its output is canonically sorted, so it is byte-deterministic (AC-034).

> Typed routes, `describe()` routes and plain routes are all discovered by the same stack walk. [...] The walk runs lazily on the first spec request, against the app found through `req.app`, and never throws. Its result is cached on a fingerprint of the nested stacks. `invalidate()` is the escape hatch for cases the fingerprint misses.

### Upstream contracts you consume (architecture.md, verbatim)

- C0 (`src/core/types.ts`, S-01): "`HttpMethod`, `OperationMeta` (the per-route declaration), `DetectedOperation {method, path, pathParams[], source: 'typed'|'describe'|'plain', meta?}`, `Logger`, and `META: unique symbol`. There is no logic here." Plus the pinned `RouteRegistry` above (ADR-27c) and the `Symbol.for` identities (ADR-20); never create a local `Symbol()` (lint-banned).
- C1 (`src/config/**`, S-02): "`OPTION_SPEC` [...] `DEFAULT_OPTIONS` is built from the table and deep-frozen. [...] `mergeOptions(defaults, global, route)`: plain objects recurse; arrays, functions and primitives replace."
- C2 (`src/adapter/**`, S-03): "`SchemaAdapter<S> { name; isSchema(x): x is S; validate(s, input): ...; toJSONSchema(s, io:'input'|'output'); }` [...] `memo.ts` wraps any adapter with `WeakMap<schema, JSONSchema>` memoization". Per ADR-21 the default adapter is `standardSchemaAdapter` (`src/adapter/standard.ts`); `zodAdapter` (`src/adapter/zod.ts`) is published only behind the `./zod` subpath. `buildSpec` receives the adapter as a parameter and must not import `zod` (ADR-21 lint: zod is imported only in `src/adapter/zod.ts`).
- C3 problem schema (`src/route/problem.ts`, S-04): "Request errors produce RFC 9457 `problem+json` with `errors[{in: path|query|body, path, message}]`". Reuse its ProblemDetails shape for `components.schemas` and the auto-400 `$ref`.
- C5 (`src/introspect/**`, S-05): "`introspect(app, log): DetectedOperation[]` [...] `paths.ts` handles path conversion: `:id` becomes `{id}`, `/*rest` becomes `{rest}`, and optional segments expand into two paths. RegExp routes and unnamed `*` are skipped with exactly one debug line each."

### Relevant decisions (architecture.md, verbatim excerpts)

- ADR-27(c): "The `RouteRegistry` interface is **pinned in `src/core/types.ts` (S-01)**. S-04 implements it in `src/registry/registry.ts`, and S-05 and S-06 consume it".
- ADR-27(d): "The Stryker `mutate` scope from ADR-05 is widened to `src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**` and `src/adapter/**`. `thresholds.break` stays at 70." Write tests that kill mutants (assert exact values, not just presence).
- ADR-29, test-strategy #7: "every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient."
- ADR-29, test-strategy #9: "each fixture gets a dedicated logger spy, and warn assertions filter by the stable message `code` (`EAD_*`)." Use S-05's `test/fixtures/logger.ts`.
- ADR-09: "**Cache key is a nested fingerprint** (total layer count across nested stacks) plus `invalidate()`."
- ADR-02: "public `invalidate()` [...] The nested fingerprint still misses a layer replaced in place with equal counts".
- ADR-03 (rejected parts): "the ETag/304 layer, the per-operation fragment cache, structural-hash component hoisting [...] hash hoisting endangers AC-016 output shape and AC-034 byte identity." Do not hoist schemas into components by hash.
- ADR-10: "**Glob matcher is in-house**, supporting `*` and `**` only [...] There is no `picomatch`."
- ADR-14: "every spec-producing test calls `@apidevtools/swagger-parser` 13.1.0 `validate()`."
- ADR-17: "A registry entry that the walk cannot locate is still emitted with its local path, plus one `warn` (ADR-19). `getSpec()` before any request returns the registry at local paths."
- ADR-19: logs at `warn` once per layer/route per walk for degraded cases; "Only the AC-034 skips stay at `debug`".
- ADR-08: default `openapi.info` is the static `{ title: 'API', version: '0.0.0' }`.

### PRD assumptions (prd.md, verbatim)

- **A-1:** auto-detection is on by default, with `autoDetect: false`, `include` and `exclude` globs.
- **A-2:** regex and unnamed-wildcard routes are skipped with a debug log line; named wildcards map to `{name}`; optional segments produce two paths.
- **A-3 / A-4:** the default `operationId` is `getUsersById`-style and the default tag is the first static segment. Both can be overridden through strategies.
- **A-5:** detection is lazy and cached, and it re-walks the router stack when the stack length changes.

### Gotchas

- Dedupe key is `(method, OpenAPI path)`. Precedence: typed = describe > plain. Glob `include`/`exclude` and `autoDetect: false` filter **plain** operations only.
- Self-exclude the configured `specPath` and `docsPath` (not only the defaults).
- Security: operation with route-level `security: []` keeps `[]`; otherwise inherits the global `security`.
- Canonical sort must be recursive over object keys and stable over paths/methods; arrays keep semantic order (`parameters`, `servers`, `tags`). Never emit `undefined` values.
- Collision suffixes for default operationIds are assigned by `RegistryEntry.id` order (plain ops, which have no id, come after registry ops in walk order).
- `buildSpec` must stay pure: no Express import, no IO, no `zod` import, no import of `src/registry/registry.ts`.

## Acceptance criteria (from PRD)

| ID | Criterion |
|---|---|
| AC-011 | Given any typed route with a request schema, When the spec is generated, Then that operation includes a `400` response that references the problem-details schema with media type `application/problem+json`. |
| AC-015 | Given registered routes, When `GET` is called on the spec endpoint (default `/openapi.json`), Then the response is 200 JSON with `openapi` starting `3.1.` and passes validation by `@apidevtools/swagger-parser` (or an equivalent OpenAPI 3.1 validator). |
| AC-016 | Given a route `/users/:id` with params, query, body and response schemas, When the spec is generated, Then the path appears as `/users/{id}` with a `path` parameter `id` (required), query parameters, a `requestBody` and response schemas derived from the Zod schemas. |
| AC-017 | Given bearer, apiKey and oauth2 security schemes declared once in the config, and a route that references one, When the spec is generated, Then `components.securitySchemes` contains all three and that operation's `security` lists the referenced scheme. |
| AC-030 | Given `autoDetect: false`, When the spec is generated, Then no plain route appears in it. Given `autoDetect` is left at its default and `exclude: ['/internal/**']`, When the spec is generated, Then plain routes under `/internal/` are absent and other plain routes are present. |
| AC-031 | Given the same method and path registered both as a typed route (or with `describe()`) and as a plain route that auto-detection would find, When the spec is generated, Then exactly one operation exists for that method and path, and it carries the typed or `describe()` metadata. |
| AC-032 | Given the spec middleware is mounted before a plain route is added, When the first spec request arrives after that route was added, Then the route appears in the spec. |
| AC-033 | Given auto-detection is enabled, When the spec is generated, Then the package's own spec endpoint and docs endpoint paths do not appear in it. |
| AC-034 | Given plain routes registered with a `RegExp` path, an Express 4 `*` wildcard and an Express 5 named wildcard `/*rest`, When the spec is generated twice, Then generation does not throw; the RegExp and unnamed-wildcard routes are skipped with one debug log line each; the named wildcard maps to `{rest}`; and both generated specs are byte-identical. (S-06 scope: byte identity.) |
| AC-038 | Given overrides of `openapi.info` (title, version, description), `openapi.servers` and `openapi.tags`, When the spec is generated, Then the spec's `info`, `servers` and `tags` equal the overridden values. |
| AC-039 | Given `securitySchemes` with a bearer scheme and a global `security: [{ bearer: [] }]`, When the spec is generated, Then every operation that has no route-level `security` inherits the global requirement, and a route declaring `security: []` has an empty `security` array in its operation. |
| AC-041 | Given `autoDetect` with `include: ['/api/**']` and a custom `detectedDefaultResponse` (e.g. status `204`, description `No Content`), When the spec is generated, Then only plain routes under `/api/` are auto-detected, and each detected operation's responses equal the custom default. |
| AC-042 | Given custom `operationIdStrategy` and `tagStrategy` functions, When the spec is generated, Then every operation without an explicit `operationId` or tags (both typed and auto-detected) uses the functions' return values. With neither option set, the defaults in A-3 and A-4 apply (e.g. `GET /users/:id` produces `getUsersById` with tag `users`). |

## Test plan

Write these tests FIRST and capture the failing (red) run before any `src/spec/**` code. Every test that produces a spec calls `await SwaggerParser.validate(structuredClone(spec))` from `@apidevtools/swagger-parser` and asserts it resolves (ADR-14). Unit tests feed `buildSpec` hand-built `DetectedOperation[]` plus the adapter (`standardSchemaAdapter` with Zod schemas as the default path, and `zodAdapter` for the AC-016 shape case); registry-backed cases use an object typed as `RouteRegistry` from `src/core/types.ts`. AC-032/AC-034 integration cases use S-05's `test/fixtures/majors.ts` (deduped by detected major, `skipIf` on the major) and `test/fixtures/logger.ts` (filter warns by `EAD_*` code).

Expected red: each file fails with a module-resolution error (`Cannot find module '../../src/spec/build'` etc.) or assertion failure, because `src/spec/` does not exist yet.

### `test/spec/build.test.ts`
- `openapi version is 3.1.x and validates` - `spec.openapi` matches `/^3\.1\./`; swagger-parser validate resolves (AC-015).
- `typed /users/:id emits params, query, requestBody, responses` - path key `/users/{id}`; `parameters` has `{name:'id', in:'path', required:true}` and each query key with `in:'query'`; `requestBody.content['application/json'].schema` and `responses['200'].content['application/json'].schema` equal adapter `toJSONSchema` output (AC-016).
- `securitySchemes bearer, apiKey, oauth2 all present; route references one` - `Object.keys(components.securitySchemes).sort()` equals the three; operation `security` deep-equals `[{ apiKey: [] }]` (AC-017).
- `global security inherited; route security [] kept empty` - op without security deep-equals `[{ bearer: [] }]`; op with `[]` deep-equals `[]` (AC-039).
- `typed route with request schema gets auto-400` - `responses['400'].content['application/problem+json'].schema.$ref === '#/components/schemas/ProblemDetails'` and the component exists; a typed route with no request schema has no auto-400 (AC-011).
- `info, servers, tags overrides applied exactly` - deep-equal the overrides; defaults are `{ title: 'API', version: '0.0.0' }` (AC-038, ADR-08).
- `include /api/** plus detectedDefaultResponse` - only plain ops under `/api/`; each detected op's `responses` deep-equals `{ '204': { description: 'No Content' } }` (AC-041).
- `default naming: GET /users/:id -> getUsersById, tag users` and `custom strategies used when no explicit operationId/tags`, for typed and plain; explicit values win (AC-042).
- `A-3 collision suffixes follow RegistryEntry.id` - two registry entries yielding the same default operationId get suffixes in `id` order; feeding `entries()` in reversed array order yields the identical spec string.
- `registry consumed only via RouteRegistry.entries()` - a stub `RouteRegistry` whose `entries()` is a spy: spy called, and entries not found by the walk are emitted at `localPath` (ADR-17).
- `dedupe: typed beats plain, describe beats plain` - exactly one op per method+path, carrying typed/describe metadata (summary etc.) (AC-031).
- `self-excludes specPath and docsPath (default and custom)` - `/openapi.json`, `/docs`, and custom `/spec.json`, `/reference` absent (AC-033).
- `autoDetect false: no plain op` and `exclude /internal/**: internal plain absent, others present`; typed ops unaffected (AC-030).
- `purity` - read `src/spec/build.ts` source: no `express`, `zod` or `registry/registry` import.

### `test/spec/canonical.test.ts`
- `two generations are byte-identical` - `JSON.stringify(a) === JSON.stringify(b)` for two builds, including a build from ops supplied in shuffled order; on both Express majors with the AC-034 fixture (RegExp, `*`, `/*rest`): no throw, `{rest}` present (AC-034).
- `keys are recursively sorted` - canonicalize of `{b:1,a:{d:1,c:2}}` stringifies to `{"a":{"c":2,"d":1},"b":1}`.

### `test/spec/cache.test.ts`
- `cache hit when fingerprint unchanged` - builder spy called once for two gets.
- `route added to a nested router after mounting triggers re-walk` - fingerprint (total layer count summed recursively) changes; new route appears (AC-032), both majors.
- `invalidate() clears the cache` - next get rebuilds even with an equal fingerprint (ADR-02).

### `test/spec/glob.test.ts`
- `*` matches exactly one segment (`/api/*` matches `/api/users`, not `/api/users/1`).
- `**` matches zero or more segments (`/internal/**` matches `/internal`, `/internal/a`, `/internal/a/b`; not `/internals`).
- Literal segments and regex metacharacters (`.`, `+`, `(`) are escaped; `{id}` paths match.

## Verification commands

Copied verbatim from architecture.md "Verification Commands":

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`, probe after scaffold story (the CLIs themselves were probed below)
- e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`.
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`), probe after scaffold story (the CLI was probed below)

Story-focused red/green run: `npx vitest run test/spec`. **Merge rule (ADR-29 #7):** the focused run is not sufficient; the full `npm test` (global 90% thresholds) must pass in this story's worktree before merge.

## Builder Report

