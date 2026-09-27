---
id: ST-007
title: "Serve: renderers, CDN pins, router, public entries (., ./manual, ./zod), built-dist behaviour tests, perf gate"
wave: 6
status: queued
attempts: 0
ac_ids:
  - AC-001
  - AC-003
  - AC-004
  - AC-018
  - AC-019
  - AC-020
  - AC-035
  - AC-036
  - AC-037
  - AC-043
  - AC-045
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

# ST-007 — Serve: renderers, CDN pins, router, public entries (`.`, `./manual`, `./zod`), built-dist behaviour tests, perf gate

## Context

Epic row S-07, Wave 6, risk **medium-high** ("The three entries must re-export the same API; it owns the dual-package hazard tests (dual-load, bundle, parity, no-zod-load) and the perf gate").
Depends on S-02 (config), S-03 (`standardSchemaAdapter` default, `zodAdapter` in `src/adapter/zod.ts`),
S-05 (`installRecorder`, `src/auto-record.ts`, introspection) and S-06 (spec builder, cache with `invalidate()`).
All are merged when this story runs; read their exports from `src/config/**`, `src/adapter/**`,
`src/introspect/**`, `src/auto-record.ts`, `src/spec/**`, `src/core/types.ts` (read-only — NOT owned).

Context pack note: the repo was greenfield at snapshot time; excerpts below are verbatim from epic.md / architecture.md.

**Wave handover (epic.md):**

> - **Wave 1: S-01.** ... S-01 creates `src/index.ts`, `src/manual.ts` and `src/zod.ts` as empty stubs so that tsup has entries; S-07 takes over all three. This is a sequential handover, not concurrent sharing.
> - **Wave 6: S-07.** It depends on S-03 because it imports `standardSchemaAdapter` for the default and the `zodAdapter` subpath.

**Dist tests and ownership (epic.md):**

> A later story may not modify test files owned by an earlier story. So every built-dist test that can only pass once the public API exists belongs to S-07, which authors it failing-first and makes it green. These are `dual-load`, `bundle`, `parity` and `no-zod-load`, all under `test/entries/**`. S-01 keeps only the tests it can make green on its own scaffold with stub entries: `manifest`, `pack` (`sideEffects`, no UI assets, no `zod` in dist) and `workflows`. There are no skip markers and no cross-story enabling.

**ADR excerpts (architecture.md), verbatim:**

> ADR-21 • **Default adapter:** the core ships `standardSchemaAdapter` (`src/adapter/standard.ts`, S-03). ... • **Result:** zero-options `createApiDocs()` accepts Zod v4 schemas (AC-035) with no zod import in core. • **Zod subpath:** `zodAdapter` lives **only** at the subpath export `express-api-docs/zod` (`src/zod.ts` → `adapter/zod.ts`).

> ADR-24 • **Entries:** the import-time side effect is isolated in its own tsup entry, `src/auto-record.ts` → `dist/auto-record.{js,cjs}`. `src/index.ts` begins with a bare `import './auto-record'`. • **Opt-out:** the entry `express-api-docs/manual` (`src/manual.ts`) re-exports the identical public API **without** that import.

> ADR-23 • **Export:** exported from `.` (and re-exported from `./manual`, see ADR-24).

> ADR-20 ... loads `dist/index.js` via `import` **and** `dist/index.cjs` via `require` in one process. It asserts that `use` is wrapped exactly once (via the guard), that a route defined through the ESM copy is found with its metadata by the CJS copy's `getSpec({app})`, and that the Express 5 mount prefix survives the mix.

> ADR-24 ... bundles a fixture that imports from `dist/index.js` with esbuild (`--bundle --platform=node --external:express`) and asserts the Express 5 `/api/users/{id}` prefix.

> ADR-26 • **Harness:** perf tests are ordinary vitest tests in `test/perf/*.perf.test.ts` (S-07). They are excluded from `npm test` and run by `npm run perf` ... • **Method:** ... 50 warm-up requests via an in-process `http.Server` and supertest, then **N = 300** timed samples. p95 is computed by nearest-rank. • **Noise policy:** ... A scenario fails only if p95 exceeds the budget in **2 of 3** consecutive in-process measurement rounds. ... • **`vitest bench`:** files remain informational trend reports and are **not** the gate.

> ADR-29 • **Test-strategy #7:** every story must pass the full `npm test`, including the global thresholds, in its own worktree before merge.

**Components (architecture.md):** C8 `docs/render.ts`, `docs/cdn.ts` — Scalar / Swagger UI templates; pins `@scalar/api-reference@1.72.1`, `swagger-ui-dist@5.33.0`; spec URL JSON-encoded and HTML-escaped; `docs.specUrl` overrides. C9 `serve/router.ts`, `index.ts` — composition root: `createApiDocs(opts)` validates synchronously **before** building anything, builds the Router gated by `serveSpec`/`serveDocs`, resolves the app via `req.app` on first request, wires the cache.

Gotchas:
- Do NOT edit `package.json`, `tsup.config.ts`, `vitest*.config.ts`, `src/config/**`, `src/spec/**`, `src/route/**`, `src/registry/**`, `src/introspect/**`, `src/adapter/**`, `src/auto-record.ts`, `src/core/types.ts`, `test/dist/**`. Record needed changes in the Builder Report.
- `src/index.ts` line 1 is `import './auto-record'`; `src/manual.ts` has the identical export list without it; `src/zod.ts` re-exports `zodAdapter` from `./adapter/zod`. `.` and `./manual` must NOT export `zodAdapter` and must never import `zod` (ESLint rule + S-01 dist grep).
- Default adapter is `standardSchemaAdapter`, not zod.
- Public exports of `.`/`./manual`: `createApiDocs`, `DEFAULT_OPTIONS`, `ApiDocsConfigError`, `installRecorder`, plus types.
- UI assets CDN-only (AC-020). Validation throws synchronously before any Router/route (AC-045, AC-043 cross-field). App resolved lazily via `req.app`.
- Cross-copy identity uses `Symbol.for` constants from `core/types.ts`; never local `Symbol()`.
- Serve tests run on both majors via `test/fixtures/majors.ts` (S-05).

## Acceptance criteria (from PRD)

- **AC-001** — Given the package is built, When `package.json` is inspected, Then `name` is `express-api-docs`, `license` is `MIT`, a LICENSE file with copyright chitha_srinath exists, and the string `express-openapi-lite` appears in no file outside `.aidd/`. *(S-07 scope: exports; never introduce the old name in owned files.)*
- **AC-003** — Given the built package, When a test loads it with both `import` (ESM) and `require` (CJS), Then both expose the same named exports.
- **AC-004** — Given `package.json`, When it is inspected, Then `peerDependencies` contains `express` `^4.21.0 || ^5.0.0` and `zod` `^4.0.0`, `peerDependenciesMeta.zod.optional` is `true`, `engines.node` is `>=22`, and the package has no runtime dependency on any UI asset package. `exports` has a `./zod` subpath that exports the Zod adapter, and the main entry does not export it. Given a project without `zod` installed, When the main entry is loaded with `import` (ESM) and with `require` (CJS), Then both loads succeed. *(S-07 scope: entry barrels, main entry loads without zod.)*
- **AC-018** — Given the docs endpoint (default `/docs`) with no UI option, When it is requested, Then the HTML loads Scalar from a version-pinned CDN URL and points it at the spec endpoint.
- **AC-019** — Given `ui: 'swagger-ui'`, When the docs endpoint is requested, Then the HTML loads Swagger UI from a version-pinned CDN URL. Given a custom CDN URL option, Then that URL is used instead.
- **AC-020** — Given the published file list (`npm pack --dry-run`), When it is inspected, Then it contains no bundled UI JS/CSS assets. *(S-07 scope: CDN only.)*
- **AC-035** — Given an Express app set up with `createApiDocs()` and no options, plus one typed route, When the app is started, Then `GET /openapi.json` returns 200 with a valid OpenAPI 3.1 spec (as in AC-015), `GET /docs` returns 200 HTML loading Scalar, an invalid request to the typed route returns 400 problem+json, and responses are not validated.
- **AC-036** — Given the package exports, When `DEFAULT_OPTIONS` is imported, Then it is a deep-frozen object whose values deep-equal the resolved config of `createApiDocs()` with no options. It contains a default for every option listed in AC-037 to AC-042. *(S-07 scope: resolved equals DEFAULT_OPTIONS.)*
- **AC-037** — Given `specPath: '/spec.json'`, `docsPath: '/reference'`, `ui: 'swagger-ui'` and a custom `cdnUrl`, When the app is started, Then the spec is served at `/spec.json`, the docs at `/reference` using Swagger UI from the custom URL and pointing at `/spec.json`, and the default paths return 404.
- **AC-043** — Given `serveDocs: false`, When the app is started, Then the docs path returns 404 and the spec is still served. Given `serveSpec: false` and `serveDocs: false`, When the app is started, Then the spec path returns 404 and the spec is still available programmatically (e.g. `apiDocs.getSpec()`). Given `serveSpec: false`, `serveDocs: true` and no `docs.specUrl`, When setup runs, Then it throws `ApiDocsConfigError` synchronously, naming `serveSpec` and `docs.specUrl`. Given `serveSpec: false`, `serveDocs: true` and `docs.specUrl: 'https://example.com/openapi.json'`, When the docs path is requested, Then it returns 200 HTML pointing at that URL, and the spec path returns 404.
- **AC-045** — Given `createApiDocs()` called with an unknown key (e.g. `specPth`) or an invalid value (e.g. `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`), When setup runs, Then it throws synchronously, before mounting any route, an exported `ApiDocsConfigError` whose message contains the offending option path and the allowed values or type. *(S-07 scope: sync throw before mount.)*

## Test plan

Write ALL tests FIRST and capture the red run before any `src/` change. Expected red reason: `src/docs/*`,
`src/serve/*` do not exist and the stub entries export nothing (missing export / resolve failure).
`test/entries/**` run against built `dist/` (S-01's suite-wide globalSetup builds it).

1. `test/docs-ui/render.test.ts` (AC-018, AC-019, AC-020)
   - `default ui is scalar with pinned url` — contains `@scalar/api-reference@1.72.1`; spec URL is `/openapi.json`.
   - `swagger-ui loads with pin` — contains `swagger-ui-dist@5.33.0` JS and CSS.
   - `custom cdnUrl is used` — contains the custom URL, not the default pin.
   - `spec url is escaped` — specUrl with `</script>"'&<` is JSON-encoded + HTML-escaped (no raw `</script>`).
   - `pins match cdn.ts` — exported constants equal the pins.
2. `test/serve/zero-config.test.ts` (AC-035, AC-036) — per major, supertest, Zod schemas with the default Standard Schema adapter:
   - `GET /openapi.json` → 200, `openapi` starts `3.1.`, passes `swagger-parser.validate()`.
   - `GET /docs` → 200 `text/html` loading Scalar.
   - invalid request → 400 `application/problem+json`.
   - schema-violating response body → still 200.
   - resolved config deep-equals `DEFAULT_OPTIONS`; `DEFAULT_OPTIONS` deep-frozen.
3. `test/serve/paths.test.ts` (AC-037) — custom paths/ui/cdnUrl; docs point at `/spec.json`; `/openapi.json` and `/docs` → 404.
4. `test/serve/toggles.test.ts` (AC-043) — the four cases, incl. sync `ApiDocsConfigError` naming `serveSpec` and `docs.specUrl`, and `apiDocs.getSpec()` when both flags false.
5. `test/serve/config-error.test.ts` (AC-045) — `specPth`, `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`: `toThrow(ApiDocsConfigError)` with path + allowed values/type; app stack length unchanged.
6. `test/entries/parity.test.ts` (AC-003, AC-001) — ESM and CJS expose the same, non-empty set of named exports, including `createApiDocs` and `installRecorder`; no owned file contains `express-openapi-lite`.
7. `test/entries/no-zod-load.test.ts` (AC-004) — main entry loads via ESM and CJS with `zod` resolution blocked.
8. `test/entries/zod-subpath.test.ts` (AC-004) — `./zod` exports `zodAdapter`; `.` does not.
9. `test/entries/manual.test.ts` (ADR-24) — `./manual` has the same export names as `.`; does not patch `use` (no `RECORDER` on prototype) until `installRecorder()` is called.
10. `test/entries/dual-load.test.ts` (ADR-20) — `use` wrapped exactly once; ESM-defined route found with metadata by CJS `getSpec({app})`; Express 5 prefix survives.
11. `test/entries/bundle.test.ts` (ADR-24) — esbuild (`--bundle --platform=node --external:express`) bundle of `dist/index.js` keeps `/api/users/{id}`.
12. `test/perf/{spec-endpoint,spec-cold,typed-route,docs-endpoint}.perf.test.ts` (ADR-26, gate) — 50 warm-ups, N=300, nearest-rank p95 < 200 ms, fail only if 2 of 3 rounds exceed; print numbers. Excluded from `npm test`.
13. `bench/{spec-endpoint,spec-cold,typed-route,docs-endpoint}.bench.ts` — informational only, not a gate.

## Verification commands

- build: `npm run build` (→ `tsup`)
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90) — full suite required (ADR-29 #7)
- lint: `npm run lint` (→ `eslint . && prettier --check .`)
- typecheck: `npx tsc --noEmit`
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`
- e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`.
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`)
- audit: `npm audit --audit-level=critical`
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`)
- B-1 (informational): `npx vitest bench --run bench/spec-endpoint.bench.ts`
- B-2 (informational): `npx vitest bench --run bench/spec-cold.bench.ts`
- B-3 (informational): `npx vitest bench --run bench/typed-route.bench.ts`
- B-4 (informational): `npx vitest bench --run bench/docs-endpoint.bench.ts`

## Builder Report

