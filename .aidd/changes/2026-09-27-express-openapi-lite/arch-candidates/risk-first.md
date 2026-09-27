# Architecture Candidate — risk-first

<!-- Lens: risk-first. Optimise for the failure modes most likely to break AC-023/024/031-034 (auto-detection on Express internals), AC-002/003 (dual build), AC-006/046 (type inference), and AC-044/045 (config precedence and validation). Accept more code and more tests to isolate each risk. -->

**Precedent:** the repo is greenfield (snapshot.md shows an empty tracked tree), so no repo files can be cited. Every choice below cites ecosystem precedent instead: zod-to-openapi, express-zod-api, tsoa, express-list-endpoints, tsup, and the vitest and Express docs.

## Approach summary (≤10 lines)

1. Every volatile boundary sits behind its own small internal port. Each port has one adapter per variant, and each variant has a contract test that runs in CI.
2. The ports are: `SchemaAdapter` (Zod v4), `RouterIntrospector` (Express 4 and Express 5 adapters, because their `router.stack` and path-to-regexp internals differ), `DocsRenderer` (Scalar, Swagger UI) and `ConfigResolver`.
3. The spec is built by a pure function, `buildSpec(registry, detected, config)`, which has no Express or IO dependency. Its output is canonically sorted, which makes the byte-identical requirement (AC-034) deterministic.
4. Auto-detection is defensive and never throws. It walks the stack inside a try/catch per layer. An unknown layer shape is skipped with a debug log, and it does not crash `/openapi.json`. It also runs a version-sniff (`app.router` vs `app._router`) with a fallback.
5. Config is validated with an internal Zod schema in `.strict()` mode, which gives fail-fast errors (AC-045). Types are derived from that same schema, so the runtime check and the types (AC-046) cannot drift. The deep merge follows a single rule: arrays replace, functions replace, and plain objects recurse.
6. Security gates run on every PR: publint and `@arethetypeswrong/cli` for the dual build, an OpenAPI validator on every generated spec in tests, and a type-test suite (`expectTypeOf` plus `@ts-expect-error`).
7. The Express 4 and 5 difference in async errors is handled with an explicit wrapper that calls `next(err)`, so neither version's native behaviour is relied on.

## Components

| # | Component (src/...) | Responsibility | Key risk mitigated | Ecosystem precedent | Owner story (planned) |
|---|---|---|---|---|---|
| 1 | `config/schema.ts`, `config/defaults.ts`, `config/resolve.ts` | An internal Zod schema of the options, which produces the `ApiDocsOptions` type (all keys optional), the deep-frozen `DEFAULT_OPTIONS`, `ApiDocsConfigError`, and `mergeOptions(defaults, global, route)`. A `superRefine` enforces the A-9 cross-field rule. | Drift between the runtime check and the types, and ambiguous merges (AC-036, 043-046) | The `defineConfig` defaults-plus-merge pattern from Vite and vitest; `.strict()` rejects unknown keys (Zod docs) | S-config |
| 2 | `adapter/types.ts`, `adapter/zod.ts` | `SchemaAdapter { isSchema(x); validate(schema, input) -> {ok:true,data} or {ok:false,issues[]}; toJSONSchema(schema, io) }`. The Zod adapter wraps `z.toJSONSchema` (JSON Schema draft 2020-12, the dialect OpenAPI 3.1 uses). | Lock-in to one schema library (AC-005); a stub adapter runs the same contract tests | Standard Schema (`~standard`) as the forward-compatible shape; zod-to-openapi | S-adapter |
| 3 | `route/typed.ts` | `route({method,path,params,query,body,responses,security,tags,...}, handler)` returns the validator middleware followed by an async-wrapped handler. It registers metadata in a `WeakMap<Router, OpDef[]>`, and types are inferred through the adapter's `Infer<S>` generic. When response validation is on, it intercepts `res.json`. | Handler type inference (AC-006); async errors on Express 4 and 5 (AC-024); the response-validation modes (AC-012-014) | express-zod-api, `@ts-rest/express` | S-typed-route |
| 4 | `route/describe.ts` | Docs-only middleware that tags the handler function with a symbol so the introspector can pick it up; it never validates requests | describe() rejecting requests by accident (AC-022) | tsoa-style metadata, done as a symbol tag without reflect-metadata | S-describe |
| 5 | `introspect/express4.ts`, `introspect/express5.ts`, `introspect/index.ts` | Walks the router stack to produce `{method, path, source: plain, typed or describe}`. It recovers mount prefixes from `layer.regexp` on v4 and from the v5 layer matcher and path. It also expands optional segments, maps named wildcards to `{name}`, and skips RegExp routes and unnamed `*` with one debug log each. | Dependence on Express private internals (AC-023, 032-034). **This is the top risk.** | express-list-endpoints (v4 mount-regexp parsing, open v5 issues); this candidate vendors that logic and tests it in-repo | S-autodetect |
| 6 | `spec/build.ts`, `spec/naming.ts` | Pure `buildSpec`. Typed and describe() entries win over detected ones (AC-031). It applies `include`/`exclude` globs with a small internal matcher, excludes its own paths (AC-033), and applies the operationId and tag strategies (AC-042). It also adds the automatic 400 problem response (AC-011), applies global security inheritance (AC-039), and sorts keys canonically. | Non-determinism and duplicate operations | zod-to-openapi `OpenApiGeneratorV31` | S-spec |
| 7 | `spec/cache.ts` | A lazy cache keyed on a stack fingerprint: the total layer count across nested stacks, a stricter form of A-5 | A stale spec after late route registration (AC-032) | None; this is bespoke | S-autodetect |
| 8 | `docs/render.ts` | `DocsRenderer` HTML templates for Scalar and Swagger UI. The pinned CDN URLs are constants, and the spec URL is JSON-encoded and HTML-escaped. | XSS through a configured URL; drift in the CDN version (the pin is asserted in tests) | The Scalar and swagger-ui-dist CDN docs | S-docs |
| 9 | `index.ts` `createApiDocs(options)` | Validates the config synchronously, then returns `{ router, route, describe, getSpec }` | Mounting before config errors surface (AC-043, AC-045) | None | S-config |
| 10 | Build and CI | `tsup` builds ESM, CJS and d.ts; `publint` and `attw --pack` check the package. Express 4 and 5 are dev-installed through npm aliases (`express4`, `express5`), and the GitHub Actions matrix runs node 20/22/24 × express 4/5. `release.yml` is `workflow_dispatch` only. | The dual-package hazard and types-resolution errors (AC-002/003/027/028) | tsup plus attw, as used by zod, hono and trpc | S-build-ci |
| 11 | Docs and release | A README whose defaults table is checked by a test against the flattened keys of `DEFAULT_OPTIONS`, a CHANGELOG, and an `examples/basic` smoke test | Documentation drifting from the code (AC-029) | None | S-docs-release |

## Trade-offs accepted

- **More code and tests than a simpler design.** The design has two introspector adapters, a stack-fingerprint cache, a canonical sorter and attw/publint gates. This roughly doubles the test surface compared with a single walker. It was accepted because auto-detection on private Express internals is the likeliest cause of post-release breakage.
- **Private API reliance is unavoidable.** Express exposes no public route list. The mitigation is containment: the reliance sits in one module per major version, every layer is walked under a try/catch, and the degradation is to an "undocumented route", never an exception. A contract test pins the exact `express` minor versions in CI. A future Express 6 needs a new adapter, and the change is additive.
- **Express 4 mount-prefix recovery from `layer.regexp` is heuristic.** Unusual mounts (a regexp mount or arrays) are skipped and logged rather than guessed.
- **Response validation monkey-patches `res.json`/`res.send` per request**, and only when enabled. This carries a small risk of interacting with other middleware. It is off by default, which limits the blast radius.
- **Zod v4 only**, via the adapter. JSON Schema output is 2020-12, which matches OpenAPI 3.1 natively, so there is no conversion layer. Adding a new library means writing a new adapter. The core is never touched.
- **No runtime deps beyond peers.** The glob matcher and deep merge are written in-house (about 60 LOC), which adds our own bug risk in exchange for no supply-chain risk.
- **Rejected:** decorators or reflect-metadata (they need experimental TS flags), and monkey-patching `app.get` to capture routes (it breaks when routes are registered before setup, and it is invasive).

## Sketch of verification strategy

- **Contract tests per port.** For `SchemaAdapter`, the same suite runs against Zod and against a stub adapter (AC-005). For `RouterIntrospector`, a fixture app matrix runs on Express 4 and on Express 5. The fixtures cover nested routers, optional segments, wildcards, RegExp paths, `app.route()` chains and `router.all` (AC-023, 034).
- **Spec validity oracle.** Every spec-producing test pipes its output through `@apidevtools/swagger-parser` validate, as a devDependency (AC-015). A determinism test generates the spec twice and compares the bytes (AC-034).
- **Type tests.** `vitest --typecheck` with `expectTypeOf` and `@ts-expect-error` cover handler inference and option strictness (AC-006, 046).
- **Integration.** Supertest runs against real apps for status, content-type and problem+json (AC-007–014, 035, 037, 040, 043), including an async-throw test on both Express majors (AC-024).
- **Config table tests.** A table-driven suite covers invalid keys and values (AC-045), the four merge cases (AC-044), deep-freeze and resolved-equals-default (AC-036), and the README table parity (AC-029).
- **Package gates.** `npm run build && publint && attw --pack` cover AC-002. A CJS/ESM parity test on `dist` covers AC-003. `npm pack --dry-run --json` is checked for UI assets (AC-020). A grep guard covers `express-openapi-lite` (AC-001).
- **CI.** The matrix is node{20,22,24}×express{4,5} (AC-027), with coverage thresholds of 90 in `vitest.config` (AC-025).
- **Probes.** No verification commands exist yet (greenfield). They are to be probed at synthesis once scaffolded.
