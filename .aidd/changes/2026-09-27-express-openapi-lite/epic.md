# Epic — 2026-09-27-express-openapi-lite

<!-- Sources: architecture.md (C0 to C12, ADR-01 to ADR-30, the Pinned seams from ADR-27, gate G-S05) and prd.md (AC-001 to AC-046, with AC-004 and AC-027 amended). -->
<!-- Story ids: S-0N in this epic is the same story as stories/ST-00N-<slug>.md. -->
<!-- Context pack (.aidd/context/snapshot.md): the repo is greenfield. No re-crawl was done. -->

## Story table

| id | File | Title | Wave | Depends on | AC ids | Sized ≤6 files? |
|---|---|---|---|---|---|---|
| S-01 | ST-001-scaffold.md | Scaffold: package, build, lint, test, perf, mutation and CI config; core types, Symbol.for identities and the RouteRegistry contract | 1 | — | AC-001, AC-002, AC-004 (package manifest), AC-020, AC-025, AC-026, AC-027, AC-028 | No (about 16 declarative config files). Accepted: they are one concern and cannot usefully be split. |
| S-02 | ST-002-config.md | Config: the OPTION_SPEC table, defaults, validation, merge and errors | 2 | S-01 | AC-036, AC-038, AC-039, AC-040, AC-041, AC-042, AC-044 (a, b), AC-045, AC-046 | Yes (6) |
| S-03 | ST-003-schema-adapter.md | SchemaAdapter port, the Standard Schema default adapter, the Zod adapter and memoization | 2 | S-01 | AC-004 (Zod adapter behind the `./zod` subpath), AC-005, AC-006 (Infer hook), AC-016 (schema conversion), AC-035 (Zod accepted with zero options) | Yes (5) |
| S-04 | ST-004-typed-route.md | Typed route, request and response validation, async wrapping, problem+json, the RouteRegistry implementation | 3 | S-02, S-03 | AC-006, AC-007, AC-008, AC-009, AC-010, AC-011 (problem schema), AC-012, AC-013, AC-014, AC-021, AC-024, AC-040, AC-044 (c, d) | Yes (6) |
| S-05 | ST-005-introspection.md | Introspection: recorder with `installRecorder`, the auto-record entry, v4 and v5 walkers, paths, `describe()`. Gated by G-S05 | 4 | **S-01 and S-04** (ADR-27b) | AC-022, AC-023, AC-030 (walk), AC-031 (identity match), AC-032 (walk), AC-033 (detection), AC-034 | No (8: 6 introspect, `describe.ts`, `src/auto-record.ts`). Accepted: they are one recorder/walker seam, and the extra 2 files are thin. |
| S-06 | ST-006-spec-builder.md | Spec builder: dedupe, glob, naming, canonical sort and fingerprint cache | 5 | S-02, S-03, S-05 | AC-011, AC-015, AC-016, AC-017, AC-030, AC-031, AC-032, AC-033, AC-034 (byte identity), AC-038, AC-039, AC-041, AC-042 | Yes (5) |
| S-07 | ST-007-serve-docs.md | Serve: renderers, CDN pins, router, and the public entries `.`, `./manual` and `./zod`; built-dist behaviour tests; perf gate | 6 | S-02, S-03, S-05, S-06 | AC-001 (exports), AC-003, AC-004 (entry barrels, main entry loads without zod), AC-018, AC-019, AC-020 (CDN only), AC-035, AC-036 (resolved config equals DEFAULT_OPTIONS), AC-037, AC-043, AC-045 (throws before mount) | Yes (6 src: `docs/*` ×2, `serve/router.ts`, `index.ts`, `manual.ts`, `zod.ts`) |
| S-08 | ST-008-docs-release.md | Docs and release: README, CHANGELOG, example, README parity tests | 7 (seam, solo) | S-07 | AC-029 | Yes (≤5) |

## Ownership matrix

<!-- The orchestrator verifies pairwise disjointness per wave (file-scope.md). -->

| Story | owns | creates |
|---|---|---|
| S-01 | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `tsconfig.build.json`, `tsup.config.ts` (entries `index`, `manual`, `zod`, `auto-record`), `vitest.config.ts`, `vitest.perf.config.ts`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `stryker.config.mjs`, `LICENSE`, `.gitignore`, `.github/**`, `src/core/types.ts`, `test/dist/**` (only `global-setup.ts`, `manifest.test.ts` and `pack.test.ts`), `test/meta/**`, `test/core/**` | `src/core/`, `test/dist/`, `test/meta/`, `test/core/`, `.github/workflows/`. **Wave-1 handover stubs** (S-01 creates them; ownership passes on and S-01 never touches them again): `src/index.ts`, `src/manual.ts`, `src/zod.ts` go to S-07 in Wave 6; `src/auto-record.ts` goes to S-05 in Wave 4. |
| S-02 | `src/config/**`, `test/config/**` | `src/config/`, `test/config/` |
| S-03 | `src/adapter/**` (`types.ts`, `standard.ts`, `standard-types.ts`, `zod.ts`, `memo.ts`), `test/adapter/**` | `src/adapter/`, `test/adapter/` |
| S-04 | `src/route/typed.ts`, `src/route/validate-request.ts`, `src/route/validate-response.ts`, `src/route/async.ts`, `src/route/problem.ts`, `src/registry/**`, `test/route/**`, `test/registry/**` | `src/route/`, `src/registry/`, `test/route/`, `test/registry/` |
| S-05 | `src/route/describe.ts`, `src/introspect/**` (`recorder.ts` with `installRecorder`, `auto-record.ts`, `index.ts`, `express4.ts`, `express5.ts`, `paths.ts`), `src/auto-record.ts` (the side-effect tsup entry; S-01 stubs it in Wave 1 and S-05 owns it from Wave 4), `test/introspect/**`, `test/describe/**`, `test/fixtures/**` (including `majors.ts`) | `src/introspect/`, `test/introspect/`, `test/describe/`, `test/fixtures/` |
| S-06 | `src/spec/**`, `test/spec/**` | `src/spec/`, `test/spec/` |
| S-07 | `src/docs/**`, `src/serve/**`, `src/index.ts`, `src/manual.ts`, `src/zod.ts` (all three stubbed by S-01 in Wave 1; S-07 owns them from Wave 6), `test/docs-ui/**`, `test/serve/**`, `test/entries/**` (including `dual-load.test.ts`, `bundle.test.ts`, `parity.test.ts` and `no-zod-load.test.ts`), `test/perf/**`, `bench/**` | `src/docs/`, `src/serve/`, `test/docs-ui/`, `test/serve/`, `test/entries/`, `test/perf/`, `bench/` |
| S-08 | `README.md`, `CHANGELOG.md`, `examples/**`, `test/docs/**` | `examples/basic/`, `test/docs/` |

### Owners of the new ADR-20 to ADR-29 items

| Item | ADR | Owner | File |
|---|---|---|---|
| The four `Symbol.for` identities (META, MOUNT, CHILD, RECORDER) | 20 | S-01 | `src/core/types.ts` |
| ESLint `no-restricted-syntax` rule banning local `Symbol()` | 20 | S-01 | `eslint.config.js` |
| Dual-load test (ESM and CJS in one process) | 20 | **S-07** | `test/entries/dual-load.test.ts` (moved from `test/dist/`) |
| Zod as an optional peer and the `./zod` exports map | 21 | S-01 | `package.json` |
| ESLint rule: zod is imported only in `src/adapter/zod.ts` | 21 | S-01 | `eslint.config.js` |
| Grep that `dist/index.{js,cjs}` contains no `zod` | 21 | S-01 | `test/dist/pack.test.ts` |
| Load the main entry with `zod` unresolvable | 21 | **S-07** | `test/entries/no-zod-load.test.ts` (moved from `test/dist/`) |
| Standard Schema default adapter and its vendored types | 21 | S-03 | `src/adapter/standard.ts`, `src/adapter/standard-types.ts` |
| Zod adapter implementation | 21 | S-03 | `src/adapter/zod.ts` |
| `./zod` subpath barrel | 21 | S-07 | `src/zod.ts` |
| Node ≥22 engines, `.nvmrc`, `vite`, `@types/node`, CI matrix {22, 24} × {4, 5} | 22 | S-01 | — |
| `installRecorder` (the RECORDER guard) and the `EAD_RECORDER_NOT_INSTALLED` warn | 23 | S-05 | `src/introspect/recorder.ts` |
| Default install | 23 | S-05 | `src/introspect/auto-record.ts` |
| Recorder-mismatch test | 23 | S-05 | `test/introspect/recorder-mismatch.test.ts` |
| Auto-record tsup entry | 24 | S-05 | `src/auto-record.ts` (stubbed by S-01 in Wave 1) |
| Tsup entry list | 24 | S-01 | `tsup.config.ts` |
| `./manual` entry | 24 | S-07 | `src/manual.ts` |
| `import './auto-record'` at the top of the main barrel | 24 | S-07 | `src/index.ts` |
| Exact `sideEffects` array test | 24 | S-01 | `test/dist/pack.test.ts` |
| esbuild bundle test | 24 | **S-07** | `test/entries/bundle.test.ts` (moved from `test/dist/`) |
| esbuild devDependency | 24 | S-01 | `package.json` |
| Fixtures deduped by detected major | 25 | S-05 | `test/fixtures/majors.ts` |
| Workflow test | 25 | S-01 | `test/meta/workflows.test.ts` |
| `peer-floor` CI job | 25 | S-01 | `.github/workflows/ci.yml` |
| Perf script (`npm run perf`) | 26 | S-01 | `package.json`, `vitest.perf.config.ts` |
| Perf tests | 26 | S-07 | `test/perf/*.perf.test.ts` |
| Pinned perf CI cell | 26 | S-01 | `ci.yml` |
| Key-only version sniff | 27a | S-05 | `src/introspect/index.ts` |
| RouteRegistry contract (Pinned seams) | 27c | S-01 | `src/core/types.ts` |
| RouteRegistry implementation | 27c | S-04 | `src/registry/registry.ts` |
| Stryker `mutate` scope widened to the registry and adapter | 27d | S-01 | `stryker.config.mjs` |
| New canonical commands and G2 deviations | 28 | S-01 | `package.json` scripts; no other file |
| CR-3 APM-order test | 29 | S-05 | `test/introspect/apm-order.test.ts` |
| CR-3 README documentation | 29 | S-08 | `README.md` |
| CR-7 send-delegation test | 29 | S-04 | `test/route/send-delegation.test.ts` |
| CR-8 `EAD_MOUNTED_IN_SUBAPP` and walking from the topmost ancestor | 29 | S-05 | `introspect/index.ts`; test `test/introspect/subapp-parent.test.ts` |
| F-6 recorder captures `stack.length` before calling the original `use` | 29 | S-05 | `recorder.ts` |
| PF-3 optional `@types/express` peer | 29 | S-01 | `package.json` |
| PF-6 `types` set to `./dist/index.d.cts`, no `module` field | 29 | S-01 | `package.json` |
| Test-strategy #4: error middleware called exactly once | 29 | S-04 | `test/route/async.test.ts` |
| Test-strategy #4: `wrapAsync` unit test | 29 | S-04 | `test/route/wrap-async.test.ts` |
| Test-strategy #5: `globalSetup` that builds | 29 | S-01 | `test/dist/global-setup.ts`, registered suite-wide in `vitest.config.ts` so `test/entries/**` also gets a fresh build |
| Test-strategy #7: full `npm test` per story | 29 | All stories | Merge rule |
| Test-strategy #9: logger spy and `EAD_*` codes | 29 | S-05 | `test/fixtures/logger.ts` |

### Shared files and disjointness

Each shared file has exactly one owner:

| Owner | Files |
|---|---|
| S-01 | `package.json`, lockfile, `.github/**`, `src/core/types.ts`, `tsup.config.ts`, `eslint.config.js`, `vitest.config.ts` |
| S-05 | `src/auto-record.ts` |
| S-07 | `src/index.ts`, `src/manual.ts`, `src/zod.ts` |
| S-08 | `README.md`, `CHANGELOG.md`, `examples/**` |

Other stories that need changes to these files send requests through their story report. They do not edit the files.

Paths are split by exact file where two stories share a directory:

- `src/route/`: `describe.ts` belongs to S-05 and the other five files belong to S-04.
- The `auto-record` files: `src/auto-record.ts` and `src/introspect/auto-record.ts` belong to S-05, and the entries in `src/` (`index.ts`, `manual.ts`, `zod.ts`) belong to S-07.

Self-check of pairwise intersections:

- **Within each wave.** Wave 2 compares S-02 {`src/config/**`, `test/config/**`} with S-03 {`src/adapter/**`, `test/adapter/**`}. The intersection is empty. Every other wave has one story.
- **Across all stories.** Checking every pair finds no overlap:
  - `src/*.ts` is split by exact file: `auto-record.ts` to S-05, and `index.ts`, `manual.ts` and `zod.ts` to S-07. The four Wave-1 stubs are sequential handovers, so S-01 never holds them in the same wave as their final owner.
  - `test/dist/**` and `test/meta/**` belong only to S-01. `test/entries/**`, which holds every built-dist behaviour test, belongs only to S-07. `test/docs/**` belongs to S-08 and `test/docs-ui/**` to S-07.

## Waves

- **Wave 1: S-01.** Afterwards, probe the canonical commands.
  - **Handover stubs.** tsup has four entries, and the `sideEffects`/pack test needs `dist/auto-record.{js,cjs}`, so S-01 creates four minimal stubs in Wave 1:
    - `src/index.ts`, `src/manual.ts` and `src/zod.ts`. S-07 owns these from Wave 6.
    - `src/auto-record.ts`, an empty module. S-05 owns it from Wave 4.
  - After Wave 1, S-01 never edits these files again. These are sequential handovers, not concurrent sharing.
- **Wave 2: S-02 and S-03**, in parallel.
- **Wave 3: S-04.** It implements the RouteRegistry contract pinned by S-01.
- **Wave 4: S-05.** Its dependency is **S-01 and S-04** (ADR-27b), which supersedes "S-01 and C0". It takes over `src/auto-record.ts` from the S-01 stub. Its first task is gate G-S05, `test/introspect/spike.contract.test.ts` on `express@5.2.1` and `express4@4.22.3`, with the fixtures calling `installRecorder(require('express4'))` explicitly (ADR-23).
- **Wave 5: S-06.** It consumes `RouteRegistry.entries()`.
- **Wave 6: S-07.** It takes over the `src/index.ts`, `src/manual.ts` and `src/zod.ts` stubs. It depends on S-03 because it imports `standardSchemaAdapter` for the default and the `zodAdapter` subpath.
- **Wave 7: S-08**, the seam story, solo in the final wave.

**Merge rule (ADR-29, test-strategy #7).** Every story must pass the full `npm test`, including the global coverage thresholds, in its own worktree.

**Dist tests and ownership (resolved).** A later story may not modify test files owned by an earlier story. So every built-dist test that can only pass once the public API exists belongs to S-07, which authors it failing-first and makes it green. These are `dual-load`, `bundle`, `parity` and `no-zod-load`, all under `test/entries/**`. S-01 keeps only the tests it can make green on its own scaffold with stub entries: `manifest`, `pack` (`sideEffects`, no UI assets, no `zod` in dist) and `workflows`. There are no skip markers and no cross-story enabling.

### Risk marker per story

| Story | Risk | Reason |
|---|---|---|
| S-01 | medium-high | Several package-shape details must all be right: the exports map for 3 entries, the scoped `sideEffects`, attw `node10` (PF-6), the optional peers and the peer-floor job. A mistake in any one breaks AC-002 or AC-004. |
| S-02 | medium | R-4: hand-written validators; the `satisfies` type lock |
| S-03 | medium | New Standard Schema path (ADR-21); `~standard.jsonSchema` conformance on Zod 4.x |
| S-04 | medium | `res.json`/`send` delegation, exact-once error forwarding on both majors |
| S-05 | **high** | R-1 and R-8: Express private internals; patches the `use` prototype at import; APM ordering; module identity across copies; gate G-S05 |
| S-06 | medium | Byte determinism; dedupe; swagger-parser validity |
| S-07 | medium-high | The three entries must re-export the same API; it owns the dual-package hazard tests (dual-load, bundle, parity, no-zod-load) and the perf gate |
| S-08 | low | Documentation and parity tests |

### Component coverage

Every component has an owner:

| Component | Owner |
|---|---|
| C0 | S-01 |
| C1 | S-02 |
| C2 (including `standard.ts`) | S-03 |
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

Every AC from AC-001 to AC-046 maps to at least one story. **No AC is uncovered.**

| AC | Stories |
|---|---|
| 001–002 | S-01, S-07 |
| 003 | S-07 (moved from S-01 with `parity.test.ts`) |
| 004 (amended) | S-01 (peers, optional meta, engines `>=22`, `./zod` in the exports map); S-03 (`zodAdapter`); S-07 (`src/zod.ts`, `src/index.ts` with no zod export, main entry loads without zod) |
| 005 | S-03 |
| 006–014 | S-04 (011 is also in S-06) |
| 015–017 | S-06 |
| 018–019 | S-07 |
| 020 | S-01, S-07 |
| 021 | S-04 |
| 022–023 | S-05 |
| 024 | S-04 |
| 025–026 | S-01 |
| 027 (amended) | S-01 (Node {22, 24} × Express {4, 5}) |
| 028 | S-01 |
| 029 | S-08 |
| 030–034 | S-05, S-06 |
| 035 | S-07 (S-03 supplies the default adapter) |
| 036 | S-02, S-07 |
| 037 | S-07 |
| 038–042 | S-02, S-06 |
| 043 | S-07 |
| 044 | S-02 (a, b), S-04 (c, d) |
| 045 | S-02, S-07 |
| 046 | S-02 |

Moved or added ACs:

| AC | Change |
|---|---|
| AC-003 | Moved to S-07 only |
| AC-004 | Added S-03 and S-07; the no-zod load check moved to S-07 |
| AC-035 | Added S-03 |
| AC-027 | Stays with S-01, with the new matrix |

## Test obligations

<!-- Per story: which tests must exist and fail first. -->

- **S-01.** `test/dist/global-setup.ts` runs `npm run build` unconditionally, and `vitest.config.ts` registers it suite-wide. Every S-01 test must go green against the stub entries.
  - `test/dist/manifest.test.ts` checks (AC-001, AC-004):
    - `name`, MIT `license`, and the LICENSE copyright line (chitha_srinath);
    - the peers, including optional `zod` and optional `@types/express`;
    - `engines.node` is `>=22`;
    - the `.`, `./manual` and `./zod` exports, each with `import`, `require` and `types`;
    - `types` is `./dist/index.d.cts` and there is no `module` field;
    - there are no UI dependencies;
    - `express-openapi-lite` does not appear outside `.aidd/`.
  - `test/dist/pack.test.ts` checks (AC-002, AC-020):
    - the pack contains no UI assets;
    - the `exports` targets exist in the pack;
    - `sideEffects` is exactly `["./dist/auto-record.js","./dist/auto-record.cjs"]`;
    - `dist/index.{js,cjs}` contains no `zod`.
  - `test/meta/workflows.test.ts` checks (AC-027, AC-028):
    - the matrix is Node {22, 24} × Express {4, 5}, and installs use `${{ matrix.express }}`;
    - the `peer-floor` job exists and is blocking;
    - the pinned perf cell is ubuntu/24/express 5;
    - the release workflow's only trigger is `workflow_dispatch`, and no workflow publishes.
  - A lint fixture test checks that the local-`Symbol()` ban and the zod-import ban fire.
  - AC-025 and AC-026 are gates run through `npm test`, `npm run lint` and `npx tsc --noEmit`.
- **S-02.** The tests are unchanged from the previous epic: `validate`, `merge`, `defaults` and `options.test-d`. The config zod-import check is now covered by the ADR-21 `src/**` rule.
- **S-03.**
  - `test/adapter/contract.test.ts` runs the same contract suite over `standardSchemaAdapter`, `zodAdapter` and a non-Zod stub (AC-005).
  - `test/adapter/standard.test.ts` checks that `~standard.validate` coerces, that `jsonSchema.input`/`output` produce draft-2020-12, and that the adapter does not import `zod`.
  - `test/adapter/memo.test.ts` checks memoization.
  - `test/adapter/zod-jsonschema.test.ts` checks `unrepresentable: 'any'` (AC-016).
- **S-04.**
  - `test/route/typed.test-d.ts` checks handler type inference (AC-006).
  - `test/route/request-validation.test.ts` covers AC-007 to AC-010, AC-040 and AC-044d.
  - `test/route/response-validation.test.ts` covers AC-012 to AC-014 and AC-044c.
  - `test/route/send-delegation.test.ts` covers CR-7 on both majors.
  - `test/route/async.test.ts` checks that the error middleware is called **exactly once** on both majors (AC-024).
  - `test/route/wrap-async.test.ts` unit-tests `wrapAsync`: it does not call `next` again after headers are sent.
  - `test/route/incremental.test.ts` covers AC-021.
  - `test/registry/registry.test.ts` checks conformance to the pinned `RouteRegistry` contract: ids in registration order and `findByHandle` on validatorFn or handlerFn.
- **S-05.**
  - **First:** `test/introspect/spike.contract.test.ts` (G-S05), using `test/fixtures/majors.ts`, which dedupes by detected major.
  - `walk.test.ts` covers AC-023, AC-030 and AC-032, and uses `skipIf` on the major.
  - `paths.test.ts` covers AC-034; `/*rest` runs only on v5 and `*` only on v4.
  - `warn.test.ts` checks the ADR-19 cases, using the logger spy and filtering on `EAD_*` codes.
  - `recorder-mismatch.test.ts` covers ADR-23: `vi.resetModules`, a single `EAD_RECORDER_NOT_INSTALLED` warn, and the local-path fallback.
  - `recorder.test.ts` checks that `installRecorder` is idempotent through RECORDER and computes new layers from the stack length captured before `use` (F-6).
  - `apm-order.test.ts` covers CR-3: a wrapper applied before and after the recorder, or else an `EAD_LAYER_UNRECOGNISED` warn.
  - `subapp-parent.test.ts` covers CR-8.
  - `sniff.test.ts` checks that `app.router` is never read on v4 (ADR-27a).
  - `test/describe/describe.test.ts` covers AC-022.
- **S-06.** The obligations are unchanged: `build`, `canonical`, `cache` and `glob`, all checked with swagger-parser. The builder reads registry entries only through the `RouteRegistry` interface from `core/types.ts`.
- **S-07.** Every test here is written failing-first against the built `dist/` (the suite-wide globalSetup from S-01 builds it).
  - `test/docs-ui/render.test.ts` covers AC-018 and AC-019.
  - `test/serve/zero-config.test.ts` covers AC-035 with Zod schemas and the default Standard Schema adapter, and AC-036.
  - `paths.test.ts` covers AC-037, `toggles.test.ts` AC-043 and `config-error.test.ts` AC-045.
  - `test/entries/parity.test.ts` checks that ESM and CJS expose the same, non-empty set of named exports, including `createApiDocs` and `installRecorder` (AC-003).
  - `test/entries/no-zod-load.test.ts` loads the main entry with ESM and CJS while resolution of `zod` is blocked (AC-004).
  - `test/entries/dual-load.test.ts` covers ADR-20: `use` is wrapped exactly once; an ESM-defined route is found with its metadata by the CJS `getSpec({app})`; the Express 5 prefix survives.
  - `test/entries/bundle.test.ts` covers ADR-24: an esbuild bundle of `dist/index.js` keeps the Express 5 `/api/users/{id}` prefix.
  - `test/entries/manual.test.ts` checks that `./manual` has the same export names as `.` and does not patch `use` until `installRecorder()` is called.
  - `test/entries/zod-subpath.test.ts` checks that `./zod` exports `zodAdapter` and `.` does not (AC-004).
  - `test/perf/*.perf.test.ts` covers ADR-26: 50 warm-up requests, N=300, nearest-rank p95 < 200 ms, fail only if 2 of 3 rounds exceed the budget.
  - `bench/**` is informational only.
- **S-08.**
  - `readme-table.test.ts` checks the README defaults table.
  - `readme-sections.test.ts` checks that the README has the original sections plus: `installRecorder` and second copies of Express, the `/manual` opt-out, import order and the APM result (CR-3), the `express-api-docs/zod` subpath, and Node ≥22.
  - `example-smoke.test.ts` covers AC-029.

## Stories needing refresh

The eight story files were checked with a grep for ADR-2x/30, `installRecorder`, `standard`, `manual`, `Node 20` and `>=20`. None of them reference ADR-20 to ADR-30, and ST-001 still states Node 20 / `>=20`.

| Story file | Refresh? | Why |
|---|---|---|
| ST-001-scaffold.md | **Must** | It uses the pre-amendment AC-004 and AC-027 (`>=20` and Node 20, at lines 87, 91 and 110). It is missing the items from ADR-20 (Symbol.for, lint rule), ADR-21 (optional zod peer, `./zod` export, zod-import lint, grep of dist for zod), ADR-22 (`.nvmrc`, vite, @types/node), ADR-24 (4 tsup entries, the `sideEffects` test, the esbuild devDependency), ADR-25 (`test/meta/workflows.test.ts`, the peer-floor job), ADR-26 (the perf script and config), ADR-27c/d (the pinned RouteRegistry contract, wider Stryker scope), ADR-28 (scripts) and ADR-29 (PF-3, PF-6, suite-wide globalSetup). It must **drop** `parity`, `dual-load`, `bundle` and `no-zod-load` (now S-07) and AC-003. |
| ST-002-config.md | Minor | It needs the ADR-29 #7 full-`npm test` merge rule. The ADR-04 lint rule is now covered by S-01's broader ADR-21 rule. |
| ST-003-schema-adapter.md | **Must** | It needs the new `standard.ts`/`standard-types.ts` default adapter (ADR-21), `zodAdapter` moved behind the subpath, the Stryker scope including the adapter (ADR-27d), and AC-004 and AC-035 added. |
| ST-004-typed-route.md | **Must** | The registry must implement the pinned contract from `core/types.ts` (ADR-27c). It needs the `send-delegation`, exactly-once `async` and `wrap-async` tests (ADR-29), and Stryker now covers the registry. |
| ST-005-introspection.md | **Must** | Its dependency is now S-01 and S-04 (ADR-27b). It needs: the key-only sniff with the fallback text void (ADR-27a); `installRecorder`, `auto-record.ts` and the `src/auto-record.ts` entry (ADR-23, ADR-24); `majors.ts` and `skipIf` (ADR-25); the recorder-mismatch, apm-order and subapp-parent tests and the F-6 rule (ADR-29); the logger spy with `EAD_*` codes; and `Symbol.for` identities from core (ADR-20). |
| ST-006-spec-builder.md | Should | It should consume `RouteRegistry.entries()` and ids through the pinned interface (ADR-27c; A-3 collision suffixes use `id`), plus the merge rule. |
| ST-007-serve-docs.md | **Must** | It needs the `./manual` and `./zod` entries and `import './auto-record'` in `index.ts` (ADR-21, ADR-24), the default adapter being `standardSchemaAdapter` rather than zod, the `test/perf` gate replacing bench-as-gate (ADR-26), a dependency on S-03, and **ownership and failing-first authorship of** `test/entries/{parity,dual-load,bundle,no-zod-load,manual,zod-subpath}.test.ts` (AC-003, AC-004). |
| ST-008-docs-release.md | **Must** | The README needs new sections: `installRecorder` and second copies, the `/manual` opt-out, import order and the APM result, the zod subpath and optional peer, Node ≥22, and the new commands. The CHANGELOG entry must reflect them. |
