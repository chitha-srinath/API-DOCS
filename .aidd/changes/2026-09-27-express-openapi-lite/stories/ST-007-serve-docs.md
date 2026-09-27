---
id: ST-007
title: "Serve: renderers, CDN pins, router, public entries (., ./manual, ./zod), default-adapter wiring, built-dist behaviour tests, perf gate"
wave: 6
status: queued
attempts: 0
ac_ids:
  - AC-001
  - AC-003
  - AC-004
  - AC-005
  - AC-018
  - AC-019
  - AC-020
  - AC-035
  - AC-036
  - AC-037
  - AC-043
  - AC-045
  - AC-047
depends_on:
  - ST-002
  - ST-003
  - ST-005
  - ST-006
file_scope:
  owns:
    - "src/docs/**"
    - "src/serve/**"
    - "src/index.ts"
    - "src/manual.ts"
    - "src/zod.ts"
    - "test/docs-ui/**"
    - "test/serve/**"
    - "test/entries/**"
    - "test/perf/**"
    - "bench/**"
  creates:
    - "src/docs/"
    - "src/serve/"
    - "test/docs-ui/"
    - "test/serve/"
    - "test/entries/"
    - "test/perf/"
    - "bench/"
---

# ST-007 — Serve: renderers, CDN pins, router, public entries (`.`, `./manual`, `./zod`), default-adapter wiring, built-dist behaviour tests, perf gate

## Context

Epic row S-07, Wave 6, risk **medium-high**: "The three entries must re-export the same API; it owns the dual-package hazard tests (dual-load, bundle, parity, no-zod-load, recorder-install) and the perf gate".

Depends on S-02 (config, `DEFAULT_OPTIONS`, branded `ApiDocsConfigError`, `schemaAdapter` row default `null`), S-03 (`standardSchemaAdapter`, `zodAdapter` in `src/adapter/zod.ts`, branded `ApiDocsSchemaError` in `src/adapter/errors.ts`), S-05 (`installRecorder`, `src/auto-record.ts`, introspection) and S-06 (spec builder, cache with `invalidate()`). All are merged when this story runs. Read their exports from `src/config/**`, `src/adapter/**`, `src/introspect/**`, `src/auto-record.ts`, `src/spec/**`, `src/registry/**`, `src/route/**`, `src/core/types.ts` — read-only, NOT owned.

Context pack note: the repo was greenfield at snapshot time; excerpts below are verbatim from epic.md / architecture.md. Honour every SUPERSEDED marker in architecture.md: the C9 export list is superseded by ADR-41; `test/dist/dual-load|bundle` locations are superseded by `test/entries/**` (S-07); the ADR-20 key names are superseded by ADR-43 (`express-api-docs.v1.*`); the ADR-40 runtime half is owned here, not by S-01; the ADR-42 brand comparison (`this.name`) is superseded by ADR-49; the ADR-35 CI mutation job is amended by ADR-50.

**Ownership (epic.md, ownership matrix):**

> S-07 | `src/docs/**`, `src/serve/**`, `src/index.ts`, `src/manual.ts`, `src/zod.ts` (all three stubbed by S-01 in Wave 1; S-07 owns them from Wave 6), `test/docs-ui/**`, `test/serve/**`, `test/entries/**` (including `dual-load.test.ts`, `bundle.test.ts`, `parity.test.ts`, `no-zod-load.test.ts` and `recorder-install.test.ts`), `test/perf/**`, `bench/**`

**Sequential handovers (epic.md):**

> | `src/index.ts` | S-01 (W1) | S-07 (W6) |
> | `src/manual.ts` | S-01 (W1) | S-07 (W6) |
> | `src/zod.ts` | S-01 (W1) | S-07 (W6) |

> **Wave 6: S-07.** It takes over the `src/index.ts`, `src/manual.ts` and `src/zod.ts` stubs, and wires `standardSchemaAdapter` as the default adapter. It depends on S-03 because it imports `standardSchemaAdapter` for the default and the `zodAdapter` subpath.

**Dist tests and ownership (epic.md):**

> So every built-dist test that can only pass once the public API or the real recorder exists belongs to S-07, which authors it failing-first and makes it green. These are `dual-load`, `bundle`, `parity`, `no-zod-load` and `recorder-install`, all under `test/entries/**`.

**Components (architecture.md):**

> C8 | `docs/render.ts`, `docs/cdn.ts` | Scalar and Swagger UI HTML templates. `cdn.ts` holds the pinned version constants (`@scalar/api-reference@1.72.1`, `swagger-ui-dist@5.33.0` at probe time), and a test asserts the pins. The spec URL is JSON-encoded and HTML-escaped. `docs.specUrl` overrides the spec URL.

> C9 | ... The composition root. `createApiDocs(opts)` validates synchronously **before** building anything, then builds the Router (spec and docs GETs, gated by `serveSpec`/`serveDocs`), resolves the app through `req.app` on the first request, and wires the cache. `index.ts` starts with a bare `import './auto-record'`; `manual.ts` re-exports the same API without it. ... **[SUPERSEDED by ADR-41 → adds `ApiDocsSchemaError`; adapter wiring per ADR-38.]** `zodAdapter` is exported **only** from `./zod` (C2).

**ADR excerpts (architecture.md), verbatim:**

> ADR-41 ... The public exports of `.` and `./manual` are `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, ApiDocsSchemaError, standardSchemaAdapter, installRecorder`, plus types. `./zod` exports `zodAdapter`, re-exports `ApiDocsSchemaError`, and nothing else. `test/entries/parity.test.ts` asserts this **exact** name set for `.` and `./manual`, in ESM and CJS.

> ADR-38 ... Resolution order is `meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter`. The last is injected by the S-07 composition root, so `src/config/**` still never imports `src/adapter/**` (ADR-04). `DEFAULT_OPTIONS.schemaAdapter === null` keeps AC-036 deep-equality.

> ADR-40 ... in a child process, `require('./dist/index.cjs')` installs `RECORDER` on the root Express prototype with **zero** `EAD_*` warns, and the same holds for `import('./dist/index.js')`.
(Epic: "Build-shape test, runtime half ... | 40 | S-07 | `test/entries/recorder-install.test.ts`". The static half stays with S-01 in `test/dist/build-shape.test.ts`.)

> ADR-42 ... **[brand comparison SUPERSEDED by ADR-49 — do not implement or test `x[BRAND] === this.name`.]** ... `test/entries/dual-load.test.ts` adds: an error thrown by the CJS copy is `instanceof` the ESM export, and the reverse.

> ADR-49 ... **Brand:** the brand is a **stable string code per class**, never `this.name`. `core/types.ts` exports `BRAND = Symbol.for('express-api-docs.v1.brand')` (the instance key) and `BRAND_KEY = Symbol.for('express-api-docs.v1.brandKey')` (the class key). Each class declares `static readonly [BRAND_KEY] = 'express-api-docs.v1.ApiDocsConfigError'` (respectively `…ApiDocsSchemaError`). **Construction:** the constructor stores the **set of codes along its class chain**: `this[BRAND] = collectBrands(new.target)` ... This makes the check subclass-aware: an instance of a user `class MyErr extends ApiDocsSchemaError` is `instanceof ApiDocsSchemaError` across copies, and it does not depend on function names. ... • S-07 `test/entries/minified.test.ts` bundles and minifies with `esbuild --bundle --minify --keep-names=false --platform=node --external:express` twice, once over `dist/index.js` and once over `dist/index.cjs`, so the two bundles have **mangled class names**. In one process it asserts that an error thrown by bundle A is `instanceof` bundle B's export and the reverse, for both classes, and that a subclass instance passes.

> ADR-50 ... (a) **Per-story at merge:** each story runs `npx stryker run --mutate "<its src globs>" --incremental` ... The story's globs are listed in its "Verification" section, and the break threshold applies to that scope. ... (d) **Full run** `mutation-full`: triggered **only** by `schedule` ... and `workflow_dispatch` ... It is not a PR gate.

> ADR-44 ... For cross-copy discovery (ESM route, CJS walker), the walker falls back to reading `[META]` when `findByHandle` misses. ... The S-07 dual-load test depends on this.

> ADR-20 ... loads `dist/index.js` via `import` **and** `dist/index.cjs` via `require` in one process. It asserts that `use` is wrapped exactly once (via the guard), that a route defined through the ESM copy is found with its metadata by the CJS copy's `getSpec({app})`, and that the Express 5 mount prefix survives the mix.

> ADR-21 • **Default adapter:** the core ships `standardSchemaAdapter` (`src/adapter/standard.ts`, S-03). ... • **Result:** zero-options `createApiDocs()` accepts Zod v4 schemas (AC-035) with no zod import in core. • **Zod subpath:** `zodAdapter` lives **only** at the subpath export `express-api-docs/zod` (`src/zod.ts` → `adapter/zod.ts`).

> ADR-24 • **Entries:** the import-time side effect is isolated in its own tsup entry, `src/auto-record.ts` → `dist/auto-record.{js,cjs}`. `src/index.ts` begins with a bare `import './auto-record'`. • **Opt-out:** the entry `express-api-docs/manual` (`src/manual.ts`) re-exports the identical public API **without** that import. ... bundles a fixture that imports from `dist/index.js` with esbuild (`--bundle --platform=node --external:express`) and asserts the Express 5 `/api/users/{id}` prefix.

> ADR-26 • **Harness:** perf tests are ordinary vitest tests in `test/perf/*.perf.test.ts` (S-07). They are excluded from `npm test` and run by `npm run perf` ... • **Method:** for each scenario, 50 warm-up requests via an in-process `http.Server` and supertest, then **N = 300** timed samples. p95 is computed by nearest-rank. • **Noise policy:** the budget is p95 < 200 ms (the constitution). A scenario fails only if p95 exceeds the budget in **2 of 3** consecutive in-process measurement rounds. ... • **`vitest bench`:** files remain informational trend reports and are **not** the gate.

> ADR-29 • **Test-strategy #7:** every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge. A focused path run is not sufficient.

Gotchas:
- Do NOT edit `package.json`, `tsup.config.ts`, `vitest*.config.ts`, `eslint.config.js`, `src/config/**`, `src/spec/**`, `src/route/**`, `src/registry/**`, `src/introspect/**`, `src/adapter/**`, `src/auto-record.ts`, `src/core/types.ts`, `test/dist/**`, `test/fixtures/**`. Record needed changes in the Builder Report.
- `src/index.ts` line 1 is `import './auto-record'`; `src/manual.ts` has the identical export list without it; `src/zod.ts` exports `zodAdapter` (from `./adapter/zod`) and re-exports `ApiDocsSchemaError`, nothing else. `.` and `./manual` must NOT export `zodAdapter` and must never import `zod` (ESLint rule + S-01 dist grep).
- Exact runtime export set of `.`/`./manual` (ADR-41): `createApiDocs`, `DEFAULT_OPTIONS`, `ApiDocsConfigError`, `ApiDocsSchemaError`, `standardSchemaAdapter`, `installRecorder` (plus types only).
- Adapter resolution: `meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter`; the default is injected here (`src/serve/router.ts` / `src/index.ts`), never in `src/config/**`. `DEFAULT_OPTIONS.schemaAdapter` stays `null`.
- UI assets CDN-only (AC-020). Validation throws synchronously before any Router/route (AC-045, AC-043 cross-field). App resolved lazily via `req.app`.
- Cross-copy identity uses the versioned `Symbol.for('express-api-docs.v1.*')` constants from `core/types.ts`; never local `Symbol()`.
- Error-class identity across copies follows ADR-49 (per-class `BRAND_KEY` string code, `BRAND` set along the class chain), implemented by S-02/S-03. S-07 only tests it; if the minified test fails because of the brand implementation, record it in the Builder Report — do not edit `src/config/**` or `src/adapter/**`.
- Serve tests run on both majors via `test/fixtures/majors.ts` (S-01, ADR-39); import it, never copy it. `require('express4')` outside `test/fixtures/**` is lint-banned.

## Acceptance criteria (from PRD)

- **AC-001** — Given the package is built, When `package.json` is inspected, Then `name` is `express-api-docs`, `license` is `MIT`, a LICENSE file with copyright chitha_srinath exists, and the string `express-openapi-lite` appears in no file outside `.aidd/`.
  - S-07 scope: exports; never introduce the old name in owned files.
- **AC-003** — Given the built package, When a test loads it with both `import` (ESM) and `require` (CJS), Then both expose the same named exports.
- **AC-004** — Given `package.json`, When it is inspected, Then `peerDependencies` contains `express` `^4.21.0 || ^5.0.0` and `zod` `^4.2.0`, `peerDependenciesMeta.zod.optional` is `true`, `engines.node` is `>=22`, and the package has no runtime dependency on any UI asset package. `exports` has a `./zod` subpath that exports the Zod adapter, and the main entry does not export it. Given a project without `zod` installed, When the main entry is loaded with `import` (ESM) and with `require` (CJS), Then both loads succeed.
  - S-07 scope: entry barrels, main entry does not export the Zod adapter, main entry loads without zod.
- **AC-005** — Given a `SchemaAdapter` interface exported from the package, When a test implements it with a non-Zod stub adapter, Then routes defined with the stub validate requests and appear in the generated spec without any change to core code.
  - S-07 scope: `schemaAdapter` wiring in the composition root.
- **AC-018** — Given the docs endpoint (default `/docs`) with no UI option, When it is requested, Then the HTML loads Scalar from a version-pinned CDN URL and points it at the spec endpoint.
- **AC-019** — Given `ui: 'swagger-ui'`, When the docs endpoint is requested, Then the HTML loads Swagger UI from a version-pinned CDN URL. Given a custom CDN URL option, Then that URL is used instead.
- **AC-020** — Given the published file list (`npm pack --dry-run`), When it is inspected, Then it contains no bundled UI JS/CSS assets.
  - S-07 scope: CDN only; no UI asset files in owned paths.
- **AC-035** — Given an Express app set up with `createApiDocs()` and no options, plus one typed route, When the app is started, Then `GET /openapi.json` returns 200 with a valid OpenAPI 3.1 spec (as in AC-015), `GET /docs` returns 200 HTML loading Scalar, an invalid request to the typed route returns 400 problem+json, and responses are not validated.
- **AC-036** — Given the package exports, When `DEFAULT_OPTIONS` is imported, Then it is a deep-frozen object whose values deep-equal the resolved config of `createApiDocs()` with no options. It contains a default for every option listed in AC-037 to AC-042.
  - S-07 scope: resolved config equals `DEFAULT_OPTIONS` (including `schemaAdapter: null`).
- **AC-037** — Given `specPath: '/spec.json'`, `docsPath: '/reference'`, `ui: 'swagger-ui'` and a custom `cdnUrl`, When the app is started, Then the spec is served at `/spec.json`, the docs at `/reference` using Swagger UI from the custom URL and pointing at `/spec.json`, and the default paths return 404.
- **AC-043** — Given `serveDocs: false`, When the app is started, Then the docs path returns 404 and the spec is still served. Given `serveSpec: false` and `serveDocs: false`, When the app is started, Then the spec path returns 404 and the spec is still available programmatically (e.g. `apiDocs.getSpec()`). Given `serveSpec: false`, `serveDocs: true` and no `docs.specUrl`, When setup runs, Then it throws `ApiDocsConfigError` synchronously, naming `serveSpec` and `docs.specUrl`. Given `serveSpec: false`, `serveDocs: true` and `docs.specUrl: 'https://example.com/openapi.json'`, When the docs path is requested, Then it returns 200 HTML pointing at that URL, and the spec path returns 404.
- **AC-045** — Given `createApiDocs()` called with an unknown key (e.g. `specPth`) or an invalid value (e.g. `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`), When setup runs, Then it throws synchronously, before mounting any route, an exported `ApiDocsConfigError` whose message contains the offending option path and the allowed values or type.
  - S-07 scope: synchronous throw before mount.
- **AC-047** — Given `schemaAdapter: stubAdapter` globally or per-route, When requests are validated and the spec is generated, Then the stub adapter's parse and toJsonSchema are used, and per-route overrides global.
  - S-07 scope: global and per-route wiring; per-route overrides global.

## Test plan

Write ALL tests FIRST and capture the red run before any `src/` change. Expected red reason: `src/docs/*`, `src/serve/*` do not exist and the stub entries export nothing (missing export / resolve failure). `test/entries/**` runs against the built `dist/` (S-01's suite-wide globalSetup builds it).

1. `test/docs-ui/render.test.ts` (AC-018, AC-019, AC-020)
   - `default ui is scalar with pinned url` — contains `@scalar/api-reference@1.72.1`; spec URL is `/openapi.json`.
   - `swagger-ui loads with pin` — contains `swagger-ui-dist@5.33.0` JS and CSS.
   - `custom cdnUrl is used` — contains the custom URL, not the default pin.
   - `spec url is escaped` — a specUrl with `</script>"'&<` is JSON-encoded and HTML-escaped (no raw `</script>`).
   - `pins match cdn.ts` — exported constants equal the pins.
2. `test/serve/zero-config.test.ts` (AC-035, AC-036) — per entry of `majors`, supertest, Zod schemas via the injected default `standardSchemaAdapter`:
   - `GET /openapi.json` → 200, `openapi` starts `3.1.`, passes `swagger-parser.validate()`.
   - `GET /docs` → 200 `text/html` loading Scalar.
   - invalid request → 400 `application/problem+json`.
   - schema-violating response body → still 200.
   - resolved config deep-equals `DEFAULT_OPTIONS` (including `schemaAdapter === null`); `DEFAULT_OPTIONS` is deep-frozen.
3. `test/serve/schema-adapter.test.ts` (AC-005, AC-047, ADR-38) — using `test/fixtures/stub-adapter.ts` (S-03):
   - `options.schemaAdapter: stubAdapter` → invalid body 400, valid body reaches handler parsed; spec `requestBody` has the stub's converted schema, passes swagger-parser.
   - no option → `standardSchemaAdapter` is used (Zod schema validates).
   - `meta.adapter` on one route overrides both the global option and the default (a second spy adapter proves which `validate`/`toJSONSchema` ran).
4. `test/serve/paths.test.ts` (AC-037) — custom paths/ui/cdnUrl; docs point at `/spec.json`; `/openapi.json` and `/docs` → 404.
5. `test/serve/toggles.test.ts` (AC-043) — the four cases, including sync `ApiDocsConfigError` naming `serveSpec` and `docs.specUrl`, and `apiDocs.getSpec()` when both flags are false.
6. `test/serve/config-error.test.ts` (AC-045) — `specPth`, `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`: `toThrow(ApiDocsConfigError)` with path and allowed values/type; app stack length unchanged.
7. `test/entries/parity.test.ts` (AC-003, AC-001, ADR-41) — ESM and CJS `Object.keys` of `.` and `./manual` each deep-equal exactly `['ApiDocsConfigError','ApiDocsSchemaError','DEFAULT_OPTIONS','createApiDocs','installRecorder','standardSchemaAdapter']` (sorted); `./zod` in ESM and CJS deep-equals exactly `['ApiDocsSchemaError','zodAdapter']`; no owned file contains `express-openapi-lite`.
8. `test/entries/no-zod-load.test.ts` (AC-004) — in a child process with `zod` resolution blocked, the main entry loads via ESM and via CJS (exit 0).
9. `test/entries/zod-subpath.test.ts` (AC-004) — `./zod` exports `zodAdapter`; `.` does not.
10. `test/entries/manual.test.ts` (AC-004, ADR-24) — `./manual` has the same export names as `.`; in a child process it does not patch `use` (no `RECORDER` on the prototype) until `installRecorder()` is called.
11. `test/entries/recorder-install.test.ts` (ADR-40 runtime half) — in a child process, `require('./dist/index.cjs')` installs `RECORDER` on the root Express prototype with zero `EAD_*` warns; same for `import('./dist/index.js')`.
12. `test/entries/dual-load.test.ts` (ADR-20, ADR-44, ADR-49) — ESM + CJS in one process: `use` wrapped exactly once; an ESM-defined route is found with its metadata by the CJS `getSpec({app})` via `[META]`; the Express 5 prefix `/api/users/{id}` survives; `ApiDocsConfigError` and `ApiDocsSchemaError` thrown by the CJS copy are `instanceof` the ESM export, and the reverse, under the ADR-49 brand:
    - the instance's `[Symbol.for('express-api-docs.v1.brand')]` is an array containing `'express-api-docs.v1.ApiDocsConfigError'` (respectively `'express-api-docs.v1.ApiDocsSchemaError'`), and each class's `[Symbol.for('express-api-docs.v1.brandKey')]` equals that code in both copies;
    - a user `class MyErr extends <CJS ApiDocsSchemaError>` instance is `instanceof` the ESM `ApiDocsSchemaError` (and the reverse direction);
    - a foreign object carrying the other class's code is **not** `instanceof` (e.g. a config-error instance is not `instanceof ApiDocsSchemaError`);
    - no assertion compares the brand to `err.name` (ADR-42 comparison is superseded).
13. `test/entries/bundle.test.ts` (ADR-24) — esbuild (`--bundle --platform=node --external:express`) bundle of a fixture importing `dist/index.js` keeps `/api/users/{id}`.
14. `test/perf/{spec-endpoint,spec-cold,typed-route,docs-endpoint}.perf.test.ts` (ADR-26, gate) — 50 warm-ups, N=300, nearest-rank p95 < 200 ms, fail only if 2 of 3 rounds exceed; print numbers. Excluded from `npm test`.
15. `bench/{spec-endpoint,spec-cold,typed-route,docs-endpoint}.bench.ts` — informational only, not a gate.
16. `test/entries/minified.test.ts` (ADR-49, red-first) — builds two separately minified bundles into a temp dir with `esbuild --bundle --minify --keep-names=false --platform=node --external:express`: bundle A from `dist/index.js` (ESM build) and bundle B from `dist/index.cjs` (CJS build). Loads both in one process and asserts:
    - `minified class names are mangled` — precondition: the bundles' `ApiDocsConfigError.name` / `ApiDocsSchemaError.name` differ from the source names (or from each other), proving the test would catch a `this.name` brand;
    - `config error A→B` and `config error B→A` — an `ApiDocsConfigError` thrown by bundle A (e.g. `createApiDocs({ specPth: 1 })`) is `instanceof` bundle B's `ApiDocsConfigError`, and the reverse;
    - `schema error A→B` and `schema error B→A` — likewise for `ApiDocsSchemaError` (constructed/thrown via the bundle's export);
    - `subclass passes across bundles` — `class MyErr extends A.ApiDocsSchemaError` (and one extending `A.ApiDocsConfigError`) instances are `instanceof` B's corresponding class, and the reverse with a subclass of B's class;
    - `cross-class is false` — an `ApiDocsConfigError` from A is not `instanceof` B's `ApiDocsSchemaError`, and vice versa.
    Expected red reason before the ADR-49 brand is in `dist/`: under a `this.name` comparison the mangled names differ per bundle, so cross-bundle and subclass `instanceof` return `false`.

## Verification commands

- build: `npm run build` (→ `tsup`)
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90) — full suite required (ADR-29 #7)
- lint: `npm run lint` (→ `eslint . && prettier --check .`)
- typecheck: `npx tsc --noEmit`
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`
- e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`.
- mutation (scoped, ADR-50, at merge; `thresholds.break: 70` applies to this scope): `npx stryker run --mutate "src/docs/**,src/serve/**,src/index.ts,src/manual.ts,src/zod.ts" --incremental`. The full `npm run mutation` run is nightly-only (`mutation-full`), not a per-story gate.
- audit: `npm audit --audit-level=critical`
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`)
- B-1 (informational): `npx vitest bench --run bench/spec-endpoint.bench.ts`
- B-2 (informational): `npx vitest bench --run bench/spec-cold.bench.ts`
- B-3 (informational): `npx vitest bench --run bench/typed-route.bench.ts`
- B-4 (informational): `npx vitest bench --run bench/docs-endpoint.bench.ts`

## Builder Report

