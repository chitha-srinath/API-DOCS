# Architecture Candidate — scalability-first

<!-- One per Architect lens run; judged via judge-scorecard.md. -->

**Precedent note:** the repo is greenfield. `snapshot.md` lists an empty tracked tree and no manifests, so there is no repo precedent to cite. Each choice below cites **ecosystem precedent** instead. Scalability here means three things: (1) per-request overhead stays flat as the route count grows (1k+ routes); (2) spec generation costs O(changed routes), not O(all routes), on every request; (3) the codebase scales to more adapters, UIs and Express majors without core edits.

## Approach summary (≤10 lines)

1. A layered core with no dependency on Express or Zod: `config` -> `registry` -> `spec-builder`. Express and Zod sit behind two ports, `RouterIntrospector` (Express 4 and 5 variants) and `SchemaAdapter` (Zod v4 first).
2. All costly work runs once, at route definition time. Validators are compiled and JSON Schemas are converted and cached in a `WeakMap<schema, JSONSchema>`. The hot request path is one pre-bound parse call.
3. The spec is built incrementally. A `RouteRegistry` holds operations keyed by `METHOD path`. Auto-detection is lazy (A-5) and is keyed on a **stack signature** (the length of each router's stack, walked recursively), not just the top-level length, so nested router additions are caught (AC-032).
4. The serialized spec is cached as a `Buffer` with a strong `ETag`. Serving it costs one hash comparison, and a `304` is returned on a match. The docs HTML is rendered once per config.
5. Component deduplication: shared schemas are hoisted into `components.schemas` by adapter-supplied id or structural hash, which keeps specs for large APIs small.
6. Deterministic output (AC-034): operations are sorted by path then method before serialization, and the cache stores bytes, so repeated generation is byte-identical.
7. Build: `tsup` produces dual ESM and CJS output plus `.d.ts` from one entry, with the Express 4 and 5 difference resolved at runtime (no subpath split).

## Components

| # | Module (src/) | Responsibility | Scalability property | Ecosystem precedent | Owner story (planned) |
|---|---|---|---|---|---|
| C1 | `config/defaults.ts`, `config/resolve.ts`, `config/validate.ts` | `DEFAULT_OPTIONS` (deep-frozen), resolved with a deep merge in which arrays are replaced, so the precedence is per-route over global over default. Validation is done by a **hand-written internal validator**, not Zod, so core does not need the peer to validate itself. It throws `ApiDocsConfigError` with the option path. | Per-route options are resolved once at definition time and frozen, so there is no per-request merge. | `fastify` option validation at `fastify()` construction; `helmet` defaults objects | S-config (AC-035, 036, 044, 045, 046) |
| C2 | `adapter/types.ts` (`SchemaAdapter`), `adapter/zod.ts` | Port with the methods `compile(schema) -> (input) => Result`, `toJSONSchema(schema, ctx)`, `id?(schema)`, and a type-level `Infer<S>`. The Zod adapter uses `safeParse` and `z.toJSONSchema` (target draft 2020-12, which OpenAPI 3.1 uses). | `WeakMap` memo on both compile and conversion. New libraries are added as new files, with no core change (AC-005). | `@standard-schema/spec` (a vendor-neutral port); `fastify` schema compilers (`setValidatorCompiler`) | S-adapter (AC-005, 006, 016) |
| C3 | `route/typed.ts` (`route()` / `defineRoute`) | The typed helper. It returns an Express handler array: `[validate, wrapAsync(handler)]`. It registers metadata into the registry at definition time. | The validation middleware is pre-bound per route, so request-time work is O(1) with respect to the route count. | `express-zod-api` endpoint factory; `ts-rest` contracts | S-typed-route (AC-006..011, 024) |
| C4 | `route/describe.ts` | Docs-only metadata middleware. It is a pass-through at runtime and tags the handler function with a `Symbol` for detection. | There is zero runtime validation cost. | `express-openapi-validator` (spec-first); JSDoc-less tagging via a symbol is the same pattern `express-list-endpoints` uses to read the stack | S-adoption (AC-021, 022) |
| C5 | `validate/request.ts`, `validate/response.ts`, `errors/problem.ts` | Parse params, query and body separately into `errors[{in,path,message}]`, formatted as RFC 9457. Response validation hooks `res.json` only when the mode is not `false`. | When `validateResponses` is `false` (the default), `res.json` is not wrapped at all, so there is no overhead. | `zod-express-middleware`; RFC 9457 as in `http-problem-details` | S-validation (AC-007..014, 040) |
| C6 | `introspect/express4.ts`, `introspect/express5.ts`, `introspect/walk.ts` | A `RouterIntrospector` port. It walks `app._router.stack` (Express 4) or `app.router.stack` (Express 5), recovers mount prefixes from `layer.regexp`/`layer.path` (v4) or `layer.matchers`/stored path (v5), and normalizes paths: `:id` becomes `{id}`, `/*rest` becomes `{rest}`, RegExp and `*` are skipped with a debug log, and optional segments are expanded. The version is detected once, from the router shape. | The walk is O(layers) and runs only when the stack signature changes. Results are cached. | `express-list-endpoints` (the canonical stack walker, which handles v4 regexp prefixes); `path-to-regexp` v8 token parse for v5 | S-autodetect (AC-023, 030..034) |
| C7 | `registry/registry.ts` | A `Map<"METHOD path", Operation>` with a source rank of typed = describe > detected, which removes duplicates (AC-031). The self paths (spec and docs) are excluded (AC-033). `include`/`exclude` globs are compiled once with `picomatch`. | Lookup and merge are O(1) per operation. A dirty flag drives cache invalidation. | `fastify`'s route table; `@asteasolutions/zod-to-openapi` `OpenAPIRegistry` | S-registry |
| C8 | `spec/builder.ts`, `spec/components.ts`, `spec/strategies.ts` | Assembles the OpenAPI 3.1 document: `info`/`servers`/`tags` overrides, security (global plus per-route, with `[]` meaning an explicit opt-out), an automatic 400 problem response, and the `operationId` and tag strategies (A-3, A-4). | A per-operation fragment cache means that only changed operations are rebuilt. Components are deduplicated. Sorting makes output stable. | `zod-openapi` `createDocument`; `tsoa` spec generation | S-spec (AC-011, 015..017, 038, 039, 041, 042) |
| C9 | `serve/spec.ts`, `serve/docs.ts` | The spec endpoint serves cached bytes with `ETag` and `Cache-Control: no-cache` (revalidate). The docs endpoint renders docs UI or docs UI HTML from pinned CDN constants, with a `cdnUrl` override and `docs.specUrl` (A-9). | The HTML is rendered once and is a constant string. A `304` path avoids resending large specs. | `@single-value/express-api-reference` (CDN-mode HTML); `docs-UI middleware` (for contrast: it bundles assets, which we avoid) | S-serve (AC-018..020, 037, 043) |
| C10 | `index.ts` (`createApiDocs`) | Composition root. It validates the config, then returns `{ router, route, describe, getSpec, invalidate }`. Nothing mounts before validation succeeds (AC-045). | `invalidate()` is exposed as an escape hatch for dynamic route systems at scale. | `fastify` plugin factory | S-config |
| C11 | Tooling: `tsup.config.ts`, `vitest.config.ts`, `.github/workflows/ci.yml` (Node 20/22/24 × Express 4/5 matrix), `release.yml` (`workflow_dispatch` only), `bench/` | Dual build, 90% coverage gates, and a bench harness. | Bench budgets are enforced in CI as a non-blocking job at first. | `tsup` dual build as used by `zod`-ecosystem packages; `vitest` coverage v8 | S-tooling (AC-001..004, 025..028), S-docs (AC-029) |

Express 4 and 5 are tested in the same `vitest` run by installing Express 4 under an npm alias: `"express4": "npm:express@^4.21.0"` as a devDependency. This avoids needing a second install per matrix cell locally. CI additionally swaps the peer version, so both code paths are covered.

## Trade-offs accepted

- **More moving parts than a simplicity-first design.** The fragment cache, stack signature, ETag and component hashing add about 4 modules. For APIs with fewer than 50 routes the gain is not measurable. We accept this because it lets the package serve large monoliths without a redesign, and each cache sits behind a pure function that is easy to test.
- **Cache invalidation risk.** A stack-signature key can miss a mutation that keeps every length the same (for example a layer replaced in place). This is mitigated by the public `invalidate()` and documented. It is strictly better than the top-level-length key in A-5, which misses routes added to nested routers. This deviates in detail from A-5 while keeping its behavior (lazy, cached, re-walk on change).
- **Reliance on Express internals** (`_router.stack`, v5 `router.stack`, `layer.matchers`). These are unstable across majors. They are isolated in C6 behind a port with per-version fixtures. A future Express 6 means one new file.
- **Hand-written config validator** instead of using Zod on itself. This means more code, and error messages must be curated by hand. In exchange, core stays adapter-agnostic, which is consistent with the `SchemaAdapter` promise (Q0b).
- **Memory.** `WeakMap` caches and fragment caches keep JSON Schemas alive for as long as their route schemas live. This is bounded by the route count and acceptable.
- **`picomatch` as a runtime dependency** (small, zero-dependency). The alternative is a hand-rolled glob. We accept the dependency, and it is not a UI asset, so AC-004 still holds.
- **No worker-thread or streaming spec generation.** A 1k-route spec is expected to build in tens of ms. Streaming JSON would complicate the ETag and byte-identity requirements.

## Sketch of verification strategy

- **Unit (vitest):** config resolve, merge and validate (AC-036, 044, 045); path normalization table tests for v4 and v5 syntaxes (AC-034); strategies (AC-042); registry precedence and self-exclusion (AC-031, 033); component dedup; a byte-identity check (`JSON.stringify` twice, compared as a Buffer).
- **Integration (supertest, run against both `express` and `express4`):** every HTTP AC, including AC-021..024, AC-032 (a route added after mounting, including on a nested router), AC-035, 037 and 043. Also tested: ETag `304` on a repeat request, and a new ETag after a route is added.
- **Spec validity:** `@readme/openapi-parser` `validate()` on generated specs for the zero-config fixture and a maximal fixture (AC-015).
- **Type tests:** `tsd`-style `*.test-d.ts` files with `@ts-expect-error`, run by `vitest --typecheck` and `tsc --noEmit` (AC-006, 046).
- **Package:** a smoke test that builds and then imports `dist` through both ESM and CJS (AC-003); `npm pack --dry-run --json` asserts no UI assets (AC-020); a README defaults-table test compares against `Object.keys(DEFAULT_OPTIONS)` (AC-029).
- **Scale bench (`bench/`, run with `vitest bench`), budgets taken from the constitution's p95 200ms figure and tightened for a library:**
  - a cold spec build for 1,000 routes takes under 100 ms;
  - a warm spec request (cache hit) takes under 1 ms p95;
  - a typed-route validation adds under 50 µs p95 over a plain route;
  - a re-walk after one route is added takes under 10 ms at 1,000 routes.
  The bench job in CI is informational until a baseline exists.
- **Mutation:** Stryker on `config/`, `introspect/` and `registry/` against the 70% floor.
- **Commands** (not yet probeable, because there is no `package.json`; the synthesizer must probe them after scaffolding): `npm run build`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm pack --dry-run`, `npx vitest bench`.
