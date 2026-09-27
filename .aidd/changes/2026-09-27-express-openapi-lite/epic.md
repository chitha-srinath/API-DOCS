# Epic — 2026-09-27-express-openapi-lite

<!-- Sources: architecture.md (C0 to C12, ADR-01 to ADR-48, the Pinned seams from ADR-27, gate G-S05) and prd.md (AC-001 to AC-047, with AC-004 and AC-027 amended, and AC-047 added for the schemaAdapter option). -->
<!-- Story ids: S-0N in this epic is the same story as stories/ST-00N-<slug>.md. -->
<!-- Context pack (.aidd/context/snapshot.md): the repo is greenfield. No re-crawl was done. -->

## Story table

| id | File | Title | Wave | Depends on | AC ids | Sized ≤6 files? |
|---|---|---|---|---|---|---|
| S-01 | ST-001-scaffold.md | Scaffold: package, build, lint, test, perf, mutation and CI config; core types, versioned Symbol.for identities, the error brand, the RouteRegistry contract, shared Express fixtures (`majors`, `freshExpress`) | 1 | — | AC-001, AC-002, AC-004 (package manifest), AC-020, AC-025, AC-026, AC-027, AC-028 | No (about 19 declarative config files plus 2 fixtures). Accepted: they are one concern and cannot usefully be split. |
| S-02 | ST-002-config.md | Config: the OPTION_SPEC table (including `schemaAdapter`), defaults, validation, merge, and the branded errors | 2 | S-01 | AC-005 (the `schemaAdapter` option row), AC-036, AC-038, AC-039, AC-040, AC-041, AC-042, AC-044 (a, b), AC-045, AC-046, AC-047 (option row) | Yes (6) |
| S-03 | ST-003-schema-adapter.md | SchemaAdapter port, the Standard Schema default adapter, the Zod adapter, memoization, the branded `ApiDocsSchemaError`, the stub-adapter fixture | 2 | S-01 | AC-004 (Zod adapter behind the `./zod` subpath; zod floor `^4.2.0`), AC-005, AC-006 (Infer hook), AC-016 (schema conversion), AC-035 (Zod accepted with zero options), AC-047 (stub fixture) | Yes (6) |
| S-04 | ST-004-typed-route.md | Typed route, request and response validation, async wrapping, problem+json, the RouteRegistry implementation | 3 | S-02, S-03 | AC-005 (the route validates with the stub adapter), AC-006, AC-007, AC-008, AC-009, AC-010, AC-011 (problem schema), AC-012, AC-013, AC-014, AC-021, AC-024, AC-040, AC-044 (c, d), AC-047 (per-route `meta.adapter`; route test) | Yes (6) |
| S-05 | ST-005-introspection.md | Introspection: recorder with `installRecorder`, the auto-record entry, v4 and v5 walkers, paths, `describe()`. Gated by G-S05 | 4 | **S-01 and S-04** (ADR-27b) | AC-022, AC-023 (walk half), AC-030 (walk), AC-031 (identity match), AC-032 (walk), AC-033 (detection), AC-034 | No (8: 6 introspect, `describe.ts`, `src/auto-record.ts`). Accepted: they are one recorder/walker seam, and the extra 2 files are thin. |
| S-06 | ST-006-spec-builder.md | Spec builder: dedupe, glob, naming, canonical sort and fingerprint cache | 5 | S-02, S-03, S-05 | AC-005 (the stub schema appears in the spec), AC-011, AC-015, AC-016, AC-017, AC-023 (spec half, ADR-32), AC-030, AC-031, AC-032, AC-033, AC-034 (byte identity), AC-038, AC-039, AC-041, AC-042, AC-047 (spec test) | Yes (5) |
| S-07 | ST-007-serve-docs.md | Serve: renderers, CDN pins, router, the public entries `.`, `./manual` and `./zod`, default-adapter wiring; built-dist behaviour tests; perf gate | 6 | S-02, S-03, S-05, S-06 | AC-001 (exports), AC-003, AC-004 (entry barrels, main entry loads without zod), AC-005 (`schemaAdapter` wiring), AC-018, AC-019, AC-020 (CDN only), AC-035, AC-036 (resolved config equals DEFAULT_OPTIONS), AC-037, AC-043, AC-045 (throws before mount), AC-047 (global and per-route wiring; per-route overrides global) | Yes (6 src: `docs/*` ×2, `serve/router.ts`, `index.ts`, `manual.ts`, `zod.ts`) |
| S-08 | ST-008-docs-release.md | Docs and release: README, CHANGELOG, example, README parity tests | 7 (seam, solo) | S-07 | AC-029 | Yes (≤5) |

## Ownership matrix

<!-- The orchestrator verifies pairwise disjointness per wave (file-scope.md). -->

| Story | owns | creates |
|---|---|---|
| S-01 | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `tsconfig.build.json`, `tsconfig.v4.json` (ADR-36), `vitest.typecheck.v4.config.ts` (ADR-51), `tsup.config.ts` (entries `index`, `manual`, `zod`, `auto-record`; `splitting: false`, `shims: true`, the `keepAutoRecordExternal` plugin), `vitest.config.ts`, `vitest.perf.config.ts`, `vitest.stryker.config.ts` (ADR-35), `eslint.config.js`, `.prettierrc`, `.prettierignore`, `stryker.config.mjs`, `LICENSE`, `.gitignore`, `.github/**`, `src/core/types.ts`, `test/dist/**` (only `global-setup.ts`, `manifest.test.ts`, `pack.test.ts` and `build-shape.test.ts`), `test/meta/**`, `test/core/**`, `test/fixtures/majors.ts` (ADR-39), `test/fixtures/fresh-express.ts` (ADR-34, ADR-39) | `src/core/`, `test/dist/`, `test/meta/`, `test/core/`, `test/fixtures/`, `.github/workflows/`. **Wave-1 handover stubs** (S-01 creates them; ownership passes on and S-01 never touches them again): `src/index.ts`, `src/manual.ts`, `src/zod.ts` go to S-07 in Wave 6; `src/auto-record.ts` (an empty module) goes to S-05 in Wave 4. |
| S-02 | `src/config/**` (including the `schemaAdapter` row and the branded `ApiDocsConfigError` in `errors.ts`), `test/config/**` | `src/config/`, `test/config/` |
| S-03 | `src/adapter/**` (`types.ts`, `standard.ts`, `standard-types.ts`, `zod.ts`, `memo.ts`, `errors.ts`), `test/adapter/**`, `test/fixtures/stub-adapter.ts` (ADR-38) | `src/adapter/`, `test/adapter/` |
| S-04 | `src/route/typed.ts`, `src/route/validate-request.ts`, `src/route/validate-response.ts`, `src/route/async.ts`, `src/route/problem.ts`, `src/registry/**`, `test/route/**`, `test/registry/**` | `src/route/`, `src/registry/`, `test/route/`, `test/registry/` |
| S-05 | `src/route/describe.ts`, `src/introspect/**` (`recorder.ts` with `installRecorder`, `auto-record.ts`, `index.ts`, `express4.ts`, `express5.ts`, `paths.ts`), `src/auto-record.ts` (the side-effect tsup entry; S-01 stubs it in Wave 1 and S-05 owns it from Wave 4), `test/introspect/**`, `test/describe/**`, `test/fixtures/apps.ts`, `test/fixtures/logger.ts` | `src/introspect/`, `test/introspect/`, `test/describe/` |
| S-06 | `src/spec/**`, `test/spec/**` (including `ac023.test.ts` and `stub-adapter.test.ts`) | `src/spec/`, `test/spec/` |
| S-07 | `src/docs/**`, `src/serve/**`, `src/index.ts`, `src/manual.ts`, `src/zod.ts` (all three stubbed by S-01 in Wave 1; S-07 owns them from Wave 6), `test/docs-ui/**`, `test/serve/**`, `test/entries/**` (including `dual-load.test.ts`, `bundle.test.ts`, `parity.test.ts`, `no-zod-load.test.ts` and `recorder-install.test.ts`), `test/perf/**`, `bench/**` | `src/docs/`, `src/serve/`, `test/docs-ui/`, `test/serve/`, `test/entries/`, `test/perf/`, `bench/` |
| S-08 | `README.md`, `CHANGELOG.md`, `examples/**`, `test/docs/**` | `examples/basic/`, `test/docs/` |

`test/fixtures/` is split by exact file across three stories:

| Story | Files | Created in |
|---|---|---|
| S-01 | `majors.ts`, `fresh-express.ts` | Wave 1 |
| S-03 | `stub-adapter.ts` | Wave 2 |
| S-05 | `apps.ts`, `logger.ts` | Wave 4 |

Any story may import these files, but only the owner may edit them. S-01 creates the directory.

### Owners of the new ADR-20 to ADR-48 items

| Item | ADR | Owner | File |
|---|---|---|---|
| The five versioned `Symbol.for` keys (`express-api-docs.v1.meta`, `.v1.mount`, `.v1.child`, `.v1.recorder`, `.v1.error`) and the `BRAND` constant | 20, 43 | S-01 | `src/core/types.ts` |
| `RECORDER` value `{protocol: 1, packageVersion}`; the coexistence rules | 43 | S-05 | `src/introspect/recorder.ts` |
| ESLint `no-restricted-syntax` rule banning local `Symbol()` | 20 | S-01 | `eslint.config.js` |
| ESLint rule flagging `require('express4')` outside `test/fixtures/**` | 39 | S-01 | `eslint.config.js` |
| Dual-load test (ESM and CJS in one process), including cross-copy `instanceof` for both error classes | 20, 42 | S-07 | `test/entries/dual-load.test.ts` |
| Zod as an optional peer (`^4.2.0`), the `./zod` exports map, and zod `^4.6.5` as a devDependency | 21, 47 | S-01 | `package.json` |
| `./package.json` export | 48 | S-01 | `package.json` |
| Asserts the `./package.json` export is present | 48 | S-01 | `test/dist/manifest.test.ts` |
| Asserts `require('express-api-docs/package.json')` resolves | 48 | S-01 | `test/dist/pack.test.ts` |
| ESLint rule: zod is imported only in `src/adapter/zod.ts` | 21 | S-01 | `eslint.config.js` |
| Grep that `dist/index.{js,cjs}` contains no `zod` | 21 | S-01 | `test/dist/pack.test.ts` |
| Load the main entry with `zod` unresolvable | 21 | S-07 | `test/entries/no-zod-load.test.ts` |
| Standard Schema default adapter and its vendored types | 21 | S-03 | `src/adapter/standard.ts`, `src/adapter/standard-types.ts` |
| Zod adapter implementation | 21 | S-03 | `src/adapter/zod.ts` |
| Zod floor test | 47 | S-03 | `test/adapter/standard-floor.test.ts` |
| `peer-floor` job installs `zod@4.2.0` | 47 | S-01 | `ci.yml` |
| `./zod` subpath barrel (exports `zodAdapter`, re-exports `ApiDocsSchemaError`) | 21, 41 | S-07 | `src/zod.ts` |
| Node ≥22 engines, `.nvmrc`, `vite`, `@types/node`, CI matrix {22, 24} × {4, 5} | 22 | S-01 | — |
| `installRecorder` (the RECORDER guard) and the `EAD_RECORDER_NOT_INSTALLED` warn (once per walk) | 23, 34 | S-05 | `src/introspect/recorder.ts` |
| `EAD_SUBAPP_UNRECORDED` warn, one per unrecorded `mounted_app` | 34 | S-05 | `src/introspect/**` |
| Default install | 23 | S-05 | `src/introspect/auto-record.ts` |
| Recorder-mismatch test (uses `freshExpress`, not `vi.resetModules`; expects 2 warns after one `invalidate()`) | 23, 34 | S-05 | `test/introspect/recorder-mismatch.test.ts` |
| `freshExpress(alias)` fixture | 34, 39 | S-01 | `test/fixtures/fresh-express.ts` |
| Auto-record tsup entry | 24 | S-05 | `src/auto-record.ts` (an empty stub from S-01 in Wave 1) |
| Tsup entries: `splitting: false`, `shims: true`, the `keepAutoRecordExternal` plugin | 24, 40 | S-01 | `tsup.config.ts` |
| Build-shape test, static half: no chunk files; `auto-record` kept external | 40 | S-01 | `test/dist/build-shape.test.ts` |
| Build-shape test, runtime half: `dist/index.cjs` and `dist/index.js` install the recorder with zero `EAD_*` warns | 40 | S-07 | `test/entries/recorder-install.test.ts` |
| `./manual` entry | 24 | S-07 | `src/manual.ts` |
| `import './auto-record'` at the top of the main barrel | 24 | S-07 | `src/index.ts` |
| Exact `sideEffects` array test | 24 | S-01 | `test/dist/pack.test.ts` |
| esbuild bundle test | 24 | S-07 | `test/entries/bundle.test.ts` |
| esbuild `~0.27.7` devDependency | 24, 45 | S-01 | `package.json` |
| Asserts the esbuild range | 45 | S-01 | `test/dist/manifest.test.ts` |
| Fixtures deduped by detected major, keeping the root copy first | 25, 39 | S-01 | `test/fixtures/majors.ts` |
| Workflow test | 25, 36, 46 | S-01 | `test/meta/workflows.test.ts` |
| `peer-floor` CI job | 25 | S-01 | `.github/workflows/ci.yml` |
| Typecheck in every cell, with `@types/express@4.17.25` in the v4 cells | 36 | S-01 | `ci.yml`, `tsconfig.v4.json` |
| Perf script (`npm run perf`) | 26 | S-01 | `package.json`, `vitest.perf.config.ts` |
| Perf tests | 26 | S-07 | `test/perf/*.perf.test.ts` |
| Pinned perf CI cell | 26 | S-01 | `ci.yml` |
| Key-only version sniff | 27a | S-05 | `src/introspect/index.ts` |
| RouteRegistry contract (Pinned seams) | 27c | S-01 | `src/core/types.ts` |
| RouteRegistry implementation | 27c | S-04 | `src/registry/registry.ts` |
| Stryker command runner (`vitest.stryker.config.ts`); `mutate` scope per ADR-27d; `@stryker-mutator/vitest-runner` removed; separate mutation CI job | 27d, 35 | S-01 | `stryker.config.mjs`, `vitest.stryker.config.ts`, `package.json`, `ci.yml` |
| New canonical commands and G2 deviations | 28 | S-01 | `package.json` scripts; no other file |
| CR-3 APM-order test | 29 | S-05 | `test/introspect/apm-order.test.ts` |
| CR-3 README documentation | 29 | S-08 | `README.md` |
| CR-7 send-delegation test | 29 | S-04 | `test/route/send-delegation.test.ts` |
| CR-8 `EAD_MOUNTED_IN_SUBAPP` and walking from the topmost ancestor | 29 | S-05 | `introspect/index.ts`; test `test/introspect/subapp-parent.test.ts` |
| F-6 recorder captures `stack.length` before calling the original `use` | 29 | S-05 | `recorder.ts` |
| PF-3 optional `@types/express` peer | 29 | S-01 | `package.json` |
| PF-6 `types` set to `./dist/index.d.cts`, no `module` field | 29 | S-01 | `package.json` |
| Test-strategy #4: error middleware called exactly once | 29 | S-04 | `test/route/async.test.ts` |
| `wrapAsync` rules | 33 | S-04 | `test/route/wrap-async.test.ts` |
| Test-strategy #5: `globalSetup` that builds | 29 | S-01 | `test/dist/global-setup.ts`, registered suite-wide in `vitest.config.ts` so `test/entries/**` also gets a fresh build (not in `vitest.stryker.config.ts`) |
| Test-strategy #7: full `npm test` per story | 29 | All stories | Merge rule |
| Test-strategy #9: logger spy and `EAD_*` codes | 29 | S-05 | `test/fixtures/logger.ts` |
| AC-023 spec half | 32 | S-06 | `test/spec/ac023.test.ts` |
| Async-refine body gives 500 `EAD_ASYNC_SCHEMA` | 37 | S-04 | `test/route/request-validation.test.ts` |
| `schemaAdapter` option row, default `null` | 38 | S-02 | `src/config/**` |
| Non-Zod stub adapter fixture | 38 | S-03 | `test/fixtures/stub-adapter.ts` |
| `meta.adapter`, and resolving the adapter in the route | 38 | S-04 | `src/route/typed.ts` |
| Stub-adapter route test | 38 | S-04 | `test/route/stub-adapter.test.ts` |
| Stub-adapter spec test | 38 | S-06 | `test/spec/stub-adapter.test.ts` |
| Injecting `standardSchemaAdapter` as the default | 38 | S-07 | `src/serve/router.ts` / `src/index.ts` |
| Exact export name set for `.`, `./manual` and `./zod` | 41 | S-07 | `src/index.ts`, `src/manual.ts`, `src/zod.ts`, `test/entries/parity.test.ts` |
| `ApiDocsSchemaError` class | 41 | S-03 | `src/adapter/errors.ts` |
| Error brand and `Symbol.hasInstance` | 42 | S-02 | `src/config/errors.ts` |
| Error brand and `Symbol.hasInstance` | 42 | S-03 | `src/adapter/errors.ts` |
| Cross-copy `instanceof` assertion | 42 | S-07 | `test/entries/dual-load.test.ts` |
| `[META]` set on the validator and the handler | 44 | S-04 | `test/route/meta-tag.test.ts` |
| `[META]` set on the `describe()` middleware | 44 | S-05 | `test/introspect/describe-meta.test.ts` |
| ST-001 must quote the current C10 row | 46 | S-01 | Story text |
| Assert `matrix.node` is `[22, 24]` and no workflow uses Node 20 | 46 | S-01 | `test/meta/workflows.test.ts` |

### Shared files and disjointness

Each shared file has exactly one owner:

| Owner | Files |
|---|---|
| S-01 | `package.json`, lockfile, `.github/**`, `src/core/types.ts`, `tsup.config.ts`, `eslint.config.js`, `vitest.config.ts`, `vitest.stryker.config.ts`, `vitest.typecheck.v4.config.ts` (ADR-51), `test/fixtures/majors.ts`, `test/fixtures/fresh-express.ts` |
| S-03 | `test/fixtures/stub-adapter.ts` |
| S-05 | `src/auto-record.ts`, `test/fixtures/apps.ts`, `test/fixtures/logger.ts` |
| S-07 | `src/index.ts`, `src/manual.ts`, `src/zod.ts` |
| S-08 | `README.md`, `CHANGELOG.md`, `examples/**` |

Other stories that need changes to these files send requests through their story report. They do not edit the files.

Paths are split by exact file where two stories share a directory:

- `src/route/`: `describe.ts` belongs to S-05 and the other five files belong to S-04.
- The `auto-record` files: `src/auto-record.ts` and `src/introspect/auto-record.ts` belong to S-05, and the entries in `src/` (`index.ts`, `manual.ts`, `zod.ts`) belong to S-07.
- `test/fixtures/`: `majors.ts` and `fresh-express.ts` belong to S-01, `stub-adapter.ts` to S-03, and `apps.ts` and `logger.ts` to S-05.

### Sequential handovers

There are exactly four, all Wave-1 stubs. The file exists before its owner's wave, and S-01 never edits it after Wave 1.

| File | Created by | Owner from |
|---|---|---|
| `src/index.ts` | S-01 (W1) | S-07 (W6) |
| `src/manual.ts` | S-01 (W1) | S-07 (W6) |
| `src/zod.ts` | S-01 (W1) | S-07 (W6) |
| `src/auto-record.ts` (empty) | S-01 (W1) | S-05 (W4) |

The `test/fixtures/majors.ts` and `fresh-express.ts` files are **not** handovers. They move to S-01 for the whole run (ADR-34, ADR-39), so S-04 (Wave 3) can import them before S-05 exists.

Self-check of pairwise intersections:

- **Within each wave.** Wave 2 compares S-02 {`src/config/**`, `test/config/**`} with S-03 {`src/adapter/**`, `test/adapter/**`, `test/fixtures/stub-adapter.ts`}. The intersection is empty. Every other wave has one story.
- **Across all stories.** Checking every pair finds no overlap:
  - `src/*.ts` and `test/fixtures/*` are split by exact file, as listed above.
  - `test/dist/**` and `test/meta/**` belong only to S-01. `test/entries/**`, which holds every built-dist behaviour test including `recorder-install.test.ts`, belongs only to S-07.
  - `test/spec/**`, including `ac023.test.ts` and `stub-adapter.test.ts`, belongs only to S-06. `test/docs/**` belongs to S-08 and `test/docs-ui/**` to S-07.

## Waves

- **Wave 1: S-01.** Afterwards, probe the canonical commands.
  - **Handover stubs.** tsup has four entries, and the `sideEffects`, pack and static build-shape tests need `dist/auto-record.{js,cjs}`, so S-01 creates four minimal stubs in Wave 1:
    - `src/index.ts`, `src/manual.ts` and `src/zod.ts`. S-07 owns these from Wave 6.
    - `src/auto-record.ts`, which stays an **empty** module. S-05 owns it from Wave 4.
  - The runtime recorder-install assertion is not part of S-01. It belongs to S-07 (`test/entries/recorder-install.test.ts`), because the real recorder exists only after S-05.
  - S-01 also creates `test/fixtures/majors.ts` and `test/fixtures/fresh-express.ts`, which it keeps.
- **Wave 2: S-02 and S-03**, in parallel.
- **Wave 3: S-04.** It implements the RouteRegistry contract pinned by S-01, and imports `majors.ts` (S-01) and `stub-adapter.ts` (S-03).
- **Wave 4: S-05.** Its dependency is **S-01 and S-04** (ADR-27b), which supersedes "S-01 and C0". It takes over `src/auto-record.ts` from the S-01 stub. Its first task is gate G-S05, `test/introspect/spike.contract.test.ts` on `express@5.2.1` and `express4@4.22.3`, using `majors.ts` (ADR-39: `installRecorder` is called only for a surviving alias entry).
- **Wave 5: S-06.** It consumes `RouteRegistry.entries()`, and owns the AC-023 spec half (ADR-32) and the stub-adapter spec test (ADR-38).
- **Wave 6: S-07.** It takes over the `src/index.ts`, `src/manual.ts` and `src/zod.ts` stubs, and wires `standardSchemaAdapter` as the default adapter. It depends on S-03 because it imports `standardSchemaAdapter` for the default and the `zodAdapter` subpath.
- **Wave 7: S-08**, the seam story, solo in the final wave.

**Merge rule (ADR-29, test-strategy #7).** Every story must pass the full `npm test`, including the global coverage thresholds, in its own worktree.

**Dist tests and ownership (resolved).** A later story may not modify test files owned by an earlier story. So every built-dist test that can only pass once the public API or the real recorder exists belongs to S-07, which authors it failing-first and makes it green. These are `dual-load`, `bundle`, `parity`, `no-zod-load` and `recorder-install`, all under `test/entries/**`.

S-01 keeps only the tests it can make green on its own scaffold with stub entries: `manifest`, `pack` (`sideEffects`, no UI assets, no `zod` in dist, the `./package.json` export), `build-shape` (the static half: no chunk files, `auto-record` kept external) and `workflows`. There are no skip markers and no cross-story enabling.

### Risk marker per story

| Story | Risk | Reason |
|---|---|---|
| S-01 | **high** | Many package-shape and tooling details must all be right: the exports map for 3 entries plus `./package.json`, the scoped `sideEffects` with the no-split tsup plugin (ADR-40), attw `node10` (PF-6), the optional peers, the peer-floor, typecheck-per-cell and mutation jobs, the Stryker command runner (ADR-35), and the shared Express fixtures. A mistake in any one breaks AC-002, AC-004, AC-025 or AC-027. |
| S-02 | medium | R-4: hand-written validators; the `satisfies` type lock |
| S-03 | medium | New Standard Schema path (ADR-21); `~standard.jsonSchema` conformance and the Zod floor `^4.2.0` (ADR-47) |
| S-04 | medium | `res.json`/`send` delegation, exact-once error forwarding on both majors |
| S-05 | **high** | R-1 and R-8: Express private internals; patches the `use` prototype at import; APM ordering; module identity across copies; gate G-S05 |
| S-06 | medium | Byte determinism; dedupe; swagger-parser validity |
| S-07 | medium-high | The three entries must re-export the same API; it owns the dual-package hazard tests (dual-load, bundle, parity, no-zod-load, recorder-install) and the perf gate |
| S-08 | low | Documentation and parity tests |

### Component coverage

Every component has an owner:

| Component | Owner |
|---|---|
| C0 | S-01 |
| C1 | S-02 |
| C2 (including `standard.ts` and `errors.ts`) | S-03 |
| C3 | S-04 |
| C12 | S-04 |
| C4 | S-05 |
| C5 (including `recorder.ts` and `auto-record`) | S-05 |
| C6 | S-06 |
| C7 | S-06 |
| C8 | S-07 |
| C9 (including the `manual` and `zod` entries) | S-07 |
| C10 | S-01 |
| C11 | S-08 |

### AC coverage (re-mapped)

Every AC from AC-001 to AC-047 maps to at least one story. **No AC is uncovered.**

| AC | Stories |
|---|---|
| 001–002 | S-01, S-07 |
| 003 | S-07 |
| 004 (amended) | S-01 (peers, optional meta, engines `>=22`, `./zod` in the exports map); S-03 (`zodAdapter`; zod floor); S-07 (`src/zod.ts`, `src/index.ts` with no zod export, main entry loads without zod) |
| 005 | S-03 (contract and stub fixture); S-02 (`schemaAdapter` option); S-04 (the stub adapter validates the route); S-06 (the stub schema appears in the spec); S-07 (wiring) |
| 006–014 | S-04 (011 is also in S-06) |
| 015–017 | S-06 |
| 018–019 | S-07 |
| 020 | S-01, S-07 |
| 021 | S-04 |
| 022 | S-05 |
| 023 | S-05 (walk), S-06 (spec, `test/spec/ac023.test.ts`) |
| 024 | S-04 |
| 025–026 | S-01 |
| 027 (amended) | S-01 (Node {22, 24} × Express {4, 5}; typecheck in every cell) |
| 028 | S-01 |
| 029 | S-08 |
| 030–034 | S-05, S-06 |
| 035 | S-07 (S-03 supplies the default adapter) |
| 036 | S-02, S-07 (`schemaAdapter: null` in the defaults) |
| 037 | S-07 |
| 038–042 | S-02, S-06 |
| 043 | S-07 |
| 044 | S-02 (a, b), S-04 (c, d) |
| 045 | S-02, S-07 |
| 046 | S-02 |
| 047 (new) | S-02 (the `schemaAdapter` option row); S-03 (stub fixture); S-04 (the per-route `meta.adapter` route test); S-06 (spec test); S-07 (global and per-route wiring, with per-route overriding global) |

Moved or added ACs:

| AC | Change |
|---|---|
| AC-003 | Moved to S-07 only |
| AC-004 | Added S-03 and S-07. The zod peer is now `^4.2.0` (ADR-47); this is flagged for a PRD amendment at G2. |
| AC-005 | Added S-02, S-04, S-06 and S-07 (ADR-38) |
| AC-023 | Split: S-05 walk, S-06 spec (ADR-32) |
| AC-035 | Added S-03 |
| AC-027 | Stays with S-01, with the new matrix and typecheck in every cell |
| AC-047 | New. Mapped to S-02, S-03, S-04, S-06 and S-07. |

## Test obligations

<!-- Per story: which tests must exist and fail first. -->

- **S-01.** `test/dist/global-setup.ts` runs `npm run build` unconditionally, and `vitest.config.ts` registers it suite-wide. Every S-01 test must go green against the stub entries.
  - `test/dist/manifest.test.ts` checks (AC-001, AC-004):
    - `name`, MIT `license`, and the LICENSE copyright line (chitha_srinath);
    - the peers, including optional `zod` `^4.2.0` and optional `@types/express`;
    - `engines.node` is `>=22`;
    - the `.`, `./manual` and `./zod` exports, each with `import`, `require` and `types`, plus `./package.json`;
    - `types` is `./dist/index.d.cts` and there is no `module` field;
    - esbuild is `~0.27.x`;
    - there are no UI dependencies;
    - `express-openapi-lite` does not appear outside `.aidd/`.
  - `test/dist/pack.test.ts` checks (AC-002, AC-020):
    - the pack contains no UI assets;
    - the `exports` targets exist in the pack;
    - `sideEffects` is exactly `["./dist/auto-record.js","./dist/auto-record.cjs"]`;
    - `dist/index.{js,cjs}` contains no `zod`;
    - `require('express-api-docs/package.json')` resolves from the extracted tarball.
  - `test/dist/build-shape.test.ts` (ADR-40, static half only) checks:
    - there is no `dist/chunk-*` file;
    - `auto-record` is kept external: `dist/index.js` contains `import "./auto-record.js"` and `dist/index.cjs` contains `require("./auto-record.cjs")`;
    - no index file contains the install call;
    - there is no bare `import.meta` in the CJS output.
  - `test/meta/workflows.test.ts` checks (AC-027, AC-028):
    - `matrix.node` deep-equals `[22, 24]`, and no workflow uses Node 20;
    - the matrix has Express {4, 5}, and installs use `${{ matrix.express }}`;
    - the typecheck step has no `if:` on `matrix.express`, and the v4 cells install `@types/express@4.17.25`;
    - the `peer-floor` job is blocking and installs `zod@4.2.0`;
    - the mutation job exists;
    - the pinned perf cell is ubuntu/24/express 5;
    - the release workflow's only trigger is `workflow_dispatch`, and no workflow publishes.
  - `test/core/fixtures.test.ts` checks that `majors` dedupes while keeping the root copy first, and that `freshExpress` returns a distinct, unpatched copy and `restore()` puts the cache back.
  - A lint fixture test checks that the local-`Symbol()` ban, the zod-import ban and the `require('express4')` ban fire.
  - A mutation smoke test checks that `npm run mutation` on a seeded stub with an emptied function body kills at least one mutant (ADR-35).
  - AC-025 and AC-026 are gates run through `npm test`, `npm run lint` and `npx tsc --noEmit`.
- **S-02.**
  - The existing tests stay: `validate`, `merge`, `defaults` and `options.test-d`.
  - `validate` adds duck-typed checks of the `schemaAdapter` row, and `defaults` asserts `schemaAdapter === null` (ADR-38, AC-047).
  - `test/config/errors.test.ts` checks the brand, `Symbol.hasInstance`, `name` and `code` (ADR-42).
- **S-03.**
  - `test/adapter/contract.test.ts` runs the same contract suite over `standardSchemaAdapter`, `zodAdapter` and `test/fixtures/stub-adapter.ts` (AC-005).
  - `test/adapter/standard.test.ts` checks that `~standard.validate` coerces, that `jsonSchema.input`/`output` produce draft-2020-12, and that the adapter does not import `zod`.
  - `test/adapter/standard-floor.test.ts` runs in the peer-floor job with zod 4.2.0 and checks that a Zod object produces non-empty `properties` (ADR-47).
  - `test/adapter/errors.test.ts` checks the `ApiDocsSchemaError` brand and `hasInstance` (ADR-42).
  - `test/adapter/memo.test.ts` checks memoization.
  - `test/adapter/zod-jsonschema.test.ts` checks `unrepresentable: 'any'` (AC-016).
- **S-04.** All tests import `majors.ts`.
  - `test/route/typed.test-d.ts` checks handler type inference (AC-006). It uses only types shared by `@types/express` 4 and 5; v5-only assertions go in `*.v5.test-d.ts`.
  - `test/route/request-validation.test.ts` covers AC-007 to AC-010, AC-040 and AC-044d. It also covers the async-refine case: a valid body gives 500 with `EAD_ASYNC_SCHEMA` and the handler is not called (ADR-37).
  - `test/route/response-validation.test.ts` covers AC-012 to AC-014 and AC-044c.
  - `test/route/send-delegation.test.ts` covers CR-7 on both majors.
  - `test/route/async.test.ts` checks that the error middleware is called **exactly once** on both majors (AC-024).
  - `test/route/wrap-async.test.ts` covers the three ADR-33 cases (a), (b) and (c). The old "not called after headers sent" case is void.
  - `test/route/stub-adapter.test.ts` checks that the stub adapter's route returns 400 for an invalid body and passes parsed data for a valid one, and that a per-route `meta.adapter` overrides the global adapter (AC-005, AC-047, ADR-38).
  - `test/route/meta-tag.test.ts` checks that `[META]` is set on the validator and the handler (ADR-44).
  - `test/route/incremental.test.ts` covers AC-021.
  - `test/registry/registry.test.ts` checks conformance to the pinned `RouteRegistry` contract.
- **S-05.**
  - **First:** `test/introspect/spike.contract.test.ts` (G-S05), using `majors.ts`, which S-01 owns.
  - `walk.test.ts` covers the AC-023 walk half (methods, full path, `pathParams`), AC-030 and AC-032, and uses `skipIf` on the major.
  - `paths.test.ts` covers AC-034; `/*rest` runs only on v5 and `*` only on v4.
  - `warn.test.ts` checks the ADR-19 cases, using the logger spy and filtering on `EAD_*` codes.
  - `recorder-mismatch.test.ts` covers ADR-23 and ADR-34: it uses `freshExpress`, expects 2 warns after one `invalidate()`, and expects sub-app routes to be dropped with `EAD_SUBAPP_UNRECORDED`.
  - `recorder.test.ts` checks that `installRecorder` is idempotent, the `{protocol: 1, packageVersion}` coexistence rules (ADR-43), and F-6.
  - `apm-order.test.ts` covers CR-3.
  - `subapp-parent.test.ts` covers CR-8.
  - `sniff.test.ts` covers ADR-27a.
  - `describe-meta.test.ts` covers ADR-44.
  - `test/describe/describe.test.ts` covers AC-022.
- **S-06.** The existing tests stay: `build`, `canonical`, `cache` and `glob`, all checked with swagger-parser.
  - `test/spec/ac023.test.ts` asserts the whole AC-023 Then-clause on every entry of `majors`, including the tag `api` taken from the mounted path (ADR-32).
  - `test/spec/stub-adapter.test.ts` checks that the stub's converted schema appears in `requestBody` and passes swagger-parser (ADR-38, AC-047).
  - The builder reads registry entries only through the `RouteRegistry` interface from `core/types.ts`.
- **S-07.** Every test here is written failing-first against the built `dist/` (the suite-wide globalSetup from S-01 builds it).
  - `test/docs-ui/render.test.ts` covers AC-018 and AC-019.
  - `test/serve/zero-config.test.ts` covers AC-035 with Zod schemas and the injected default `standardSchemaAdapter`, and AC-036.
  - `test/serve/schema-adapter.test.ts` checks that `options.schemaAdapter` is used instead of the default, and that `meta.adapter` overrides both (ADR-38, AC-047).
  - `paths.test.ts` covers AC-037, `toggles.test.ts` AC-043 and `config-error.test.ts` AC-045.
  - `test/entries/parity.test.ts` asserts the **exact** ADR-41 name set for `.` and `./manual`, and for `./zod`, in both ESM and CJS (AC-003).
  - `test/entries/no-zod-load.test.ts` covers AC-004.
  - `test/entries/recorder-install.test.ts` covers the ADR-40 runtime half. In a child process, `require('./dist/index.cjs')` installs `RECORDER` on the root Express prototype with **zero** `EAD_*` warns, and the same holds for `import('./dist/index.js')`.
  - `test/entries/dual-load.test.ts` covers ADR-20, ADR-42 and ADR-44. `use` is wrapped exactly once. An ESM-defined route is found by the CJS `getSpec({app})` through `[META]`. The Express 5 prefix survives. Both error classes pass `instanceof` across the two copies.
  - `test/entries/bundle.test.ts` covers ADR-24.
  - `test/entries/manual.test.ts` and `test/entries/zod-subpath.test.ts` cover AC-004.
  - `test/perf/*.perf.test.ts` covers ADR-26.
  - `bench/**` is informational only.
- **S-08.**
  - `readme-table.test.ts` checks the README defaults table, including `schemaAdapter`.
  - `readme-sections.test.ts` checks that the README has the original sections plus:
    - `installRecorder` and second copies of Express;
    - the `/manual` opt-out;
    - import order and the APM result (CR-3);
    - the `express-api-docs/zod` subpath and the zod `<4.2` note (ADR-47);
    - matching errors on `err.code` (ADR-42);
    - the "Internals" protocol-version note (ADR-43);
    - Node ≥22.
  - `example-smoke.test.ts` covers AC-029.

## Stories needing refresh

Every ST file predates ADR-32 to ADR-48, so each one must be re-checked. The table covers ADR-20 to ADR-48 and AC-047.

| Story file | Refresh? | Why |
|---|---|---|
| ST-001-scaffold.md | **Must** | **Carries over from ADR-20 to ADR-30:** the pre-amendment AC-004 and AC-027 (`>=20` and Node 20), and the missing items from ADR-20 to ADR-29. It must drop `parity`, `dual-load`, `bundle` and `no-zod-load` and AC-003. **New from ADR-32 to ADR-48:** <br>• ADR-34 and ADR-39: take ownership of `test/fixtures/majors.ts` and `fresh-express.ts`, plus the express4 lint rule.<br>• ADR-35: `vitest.stryker.config.ts`, the command runner, removing the vitest-runner, the mutation CI job and the kill-smoke AC.<br>• ADR-36: typecheck in every cell, and `tsconfig.v4.json`.<br>• ADR-40: tsup `splitting: false`, `shims: true` and the plugin, plus the **static half only** of `build-shape.test.ts`, with `src/auto-record.ts` left as an empty stub.<br>• ADR-43: the versioned keys and `BRAND`.<br>• ADR-45: esbuild `~0.27.7`.<br>• ADR-46: quote the current C10 row, and the Node matrix assertion.<br>• ADR-47: zod peer `^4.2.0`, zod in the peer-floor job, zod devDependency `^4.6.5`.<br>• ADR-48: the `./package.json` export. |
| ST-002-config.md | **Must** (was Minor) | ADR-38 and AC-047: the `schemaAdapter` row, default `null`, with a duck-typed check. ADR-42: the branded `ApiDocsConfigError` with `hasInstance`. It also needs the ADR-29 #7 merge rule. |
| ST-003-schema-adapter.md | **Must** | **Carries over from ADR-20 to ADR-30:** ADR-21 and ADR-27d. **New from ADR-32 to ADR-48:** <br>• ADR-38 and AC-047: `test/fixtures/stub-adapter.ts`.<br>• ADR-41 and ADR-42: `adapter/errors.ts` with the brand.<br>• ADR-47: `standard-floor.test.ts`, and the zod floor `^4.2.0` in AC-004. |
| ST-004-typed-route.md | **Must** | **Carries over from ADR-20 to ADR-30:** ADR-27c and ADR-29. **New from ADR-32 to ADR-48:** <br>• ADR-33: the new `wrapAsync` rule; the old test-6 wording is void.<br>• ADR-37: the async-refine 500 case.<br>• ADR-38 and AC-047: `meta.adapter`, adapter resolution, and `stub-adapter.test.ts`.<br>• ADR-39: import `majors.ts` from S-01; local copies are banned.<br>• ADR-36: shared-only types in `test-d`.<br>• ADR-44: `meta-tag.test.ts`. |
| ST-005-introspection.md | **Must** | **Carries over from ADR-20 to ADR-30:** ADR-23 to ADR-29. **New from ADR-32 to ADR-48:** <br>• ADR-32: owns only the AC-023 walk half.<br>• ADR-34: `freshExpress` instead of `vi.resetModules`, a warn once per walk, and `EAD_SUBAPP_UNRECORDED`.<br>• ADR-39: no longer owns `majors.ts`; fixtures now `apps.ts` and `logger.ts` only.<br>• ADR-43: the versioned keys and the protocol payload.<br>• ADR-44: `describe-meta.test.ts`, and reading `[META]` as the fallback.<br>• It takes over the empty `src/auto-record.ts` stub. |
| ST-006-spec-builder.md | **Must** (was Should) | ADR-32: `test/spec/ac023.test.ts` and the tag taken from the mounted path. ADR-38 and AC-047: `test/spec/stub-adapter.test.ts`. It also needs the ADR-27c interface and the merge rule. |
| ST-007-serve-docs.md | **Must** | **Carries over from ADR-20 to ADR-30:** ADR-21, ADR-24, ADR-26 and the `test/entries` ownership. **New from ADR-32 to ADR-48:** <br>• ADR-38 and AC-047: inject `standardSchemaAdapter` as the default, per-route overriding global, plus `schema-adapter.test.ts`.<br>• ADR-40 runtime half: `test/entries/recorder-install.test.ts`.<br>• ADR-41: the exact export set, including `ApiDocsSchemaError`; `./zod` re-exports it.<br>• ADR-42 and ADR-44: dual-load checks cross-copy `instanceof` and `[META]` discovery. |
| ST-008-docs-release.md | **Must** | **Carries over from ADR-20 to ADR-30:** the README sections. **New from ADR-32 to ADR-48:** <br>• ADR-38: the `schemaAdapter` row in the defaults table and a SchemaAdapter selection section.<br>• ADR-42: matching on `err.code`.<br>• ADR-43: the Internals protocol note.<br>• ADR-47: the zod `<4.2` note. |
