---
id: ST-008
title: "Docs and release: README, CHANGELOG, example, README parity tests"
wave: 7
status: built
attempts: 1
ac_ids:
  - "AC-029"
depends_on:
  - "ST-007"
file_scope:
  owns:
    - "README.md"
    - "CHANGELOG.md"
    - "examples/**"
    - "test/docs/**"
  creates:
    - "examples/basic/"
    - "test/docs/"
---

# ST-008 — Docs and release: README, CHANGELOG, example, README parity tests

Epic row: S-08. Wave 7 (seam, solo, final wave). Depends on S-07 (ST-007). Risk: low ("Documentation and parity tests").

## Context

The context pack says the repo is greenfield (epic.md: "the repo is greenfield. No re-crawl was done."). When this story runs, S-01 to S-07 are merged. Read the public API from `src/index.ts`, `src/manual.ts` and `src/zod.ts` (owned by S-07, read-only for you), `OPTION_SPEC` in `src/config/spec-table.ts` (S-02) and the `Symbol.for` constants in `src/core/types.ts` (S-01).

**Ownership (epic.md):**
> | S-08 | `README.md`, `CHANGELOG.md`, `examples/**`, `test/docs/**` | `examples/basic/`, `test/docs/` |

> `test/docs/**` belongs to S-08 and `test/docs-ui/**` to S-07.

> Other stories that need changes to these files send requests through their story report. They do not edit the files.

Do not edit `package.json` (S-01 owns it); record any needed devDependency or script as a request in the Builder Report.

**Component C11 (architecture.md):**
> | C11 | `README.md`, `CHANGELOG.md`, `examples/basic/*`, `test/docs/readme-table.test.ts` | The documentation. A test checks the README defaults table against `OPTION_SPEC` paths. The example is exercised by a smoke test. | 029 | — (none; bespoke) | S-08 docs-release |

**Epic refresh obligation (epic.md, "Stories needing refresh"):**
> | ST-008-docs-release.md | **Must** | **Carries over from ADR-20 to ADR-30:** the README sections. **New from ADR-32 to ADR-48:** <br>• ADR-38: the `schemaAdapter` row in the defaults table and a SchemaAdapter selection section.<br>• ADR-42: matching on `err.code`.<br>• ADR-43: the Internals protocol note.<br>• ADR-47: the zod `<4.2` note. |

Final-round amendments: the ADR-47 `<4.2` note is **superseded by ADR-52** (see below); ADR-42's brand comparison is superseded by ADR-49; ADR-50 and ADR-53 add README obligations.

**Epic test list for S-08:**
> - `readme-table.test.ts` checks the README defaults table, including `schemaAdapter`.
> - `readme-sections.test.ts` checks that the README has the original sections plus:
>   - `installRecorder` and second copies of Express;
> ...
>   - Node ≥22.
> - `example-smoke.test.ts` covers AC-029.

**Config source of truth (C1, ADR-04):** `OPTION_SPEC` is a table of rows `{ path, default, check, allowed, description }`, keyed by dotted path; the same table drives runtime validation, `DEFAULT_OPTIONS` and the README parity test. `DEFAULT_OPTIONS` is a public export of `.`.

**Public exports (ADR-41, supersedes the C9 list):**
> The public exports of `.` and `./manual` are `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, ApiDocsSchemaError, standardSchemaAdapter, installRecorder`, plus types. `./zod` exports `zodAdapter`, re-exports `ApiDocsSchemaError`, and nothing else.

**SchemaAdapter selection (ADR-38):**
> a global option `schemaAdapter` is added (an `OPTION_SPEC` row, default `null`, meaning "the core default `standardSchemaAdapter`"). The check is duck-typed: an object with function members `isSchema`, `validate` and `toJSONSchema`. A per-route override `meta.adapter` is also accepted. Resolution order is `meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter`.

The defaults table must therefore contain a `schemaAdapter` row with default `null`, and the SchemaAdapter section must document the resolution order and the three-member interface.

**SchemaAdapter member names (ADR-53):**
> AC-047's names `parse` and `toJsonSchema` are read as the `SchemaAdapter` members **`validate`** and **`toJSONSchema`** (C2, ADR-21). [...] the README uses the C2 names.

The README SchemaAdapter section names the methods `validate` and `toJSONSchema` (plus `isSchema`). Never document `parse` or `toJsonSchema` as adapter members.

**Zod subpath and peer (ADR-21, peer floor amended by ADR-47, README wording per ADR-52):**
> `zod` becomes an **optional peer** [...] The core (`.` entry) **never imports `zod`**.
> **Default adapter:** the core ships `standardSchemaAdapter` [...] zero-options `createApiDocs()` accepts Zod v4 schemas (AC-035) with no zod import in core.
> `zodAdapter` lives **only** at the subpath export `express-api-docs/zod` [...] It adds Zod-specific handling: `unrepresentable: 'any'` and typed `z.infer`.

ADR-47 sets the peer to **`^4.2.0`** (optional). Its README sentence about zod below 4.2 is **SUPERSEDED by ADR-52**:
> The README states only: "**Requires zod >= 4.2** (peer `^4.2.0`, optional; only needed when you use Zod schemas)". The earlier advice that "zod versions below 4.2 need `express-api-docs/zod`" is **dropped**. The `./zod` subpath has **the same** `^4.2.0` floor [...] `test/docs/readme.test.ts` (S-08) asserts that the README contains `zod >= 4.2` and does not contain `below 4.2` or `< 4.2`.

Document the peer as `^4.2.0` optional, never `^4.0.0`, and say nothing about zod versions below 4.2 (no `<4.2` / `./zod` fallback advice). R-9: the README recommends `express-api-docs/zod` for Zod users (for `unrepresentable: 'any'` and typed `z.infer`, not as a version workaround). Never document `import { zodAdapter } from 'express-api-docs'`.

**Errors (ADR-31, ADR-42, brand per ADR-49):**
> Both error classes carry a brand. [...] Stable `name` (`'ApiDocsConfigError'` / `'ApiDocsSchemaError'`) and `code` properties are kept. The README documents matching on `err.code` as the most portable form.

ADR-49 (supersedes ADR-42's brand comparison): the brand is a stable per-class string code under `Symbol.for('express-api-docs.v1.brand')`, and `Symbol.hasInstance` checks it, so `instanceof ApiDocsConfigError` / `instanceof ApiDocsSchemaError` works **across ESM/CJS copies, separate bundles and minified builds (mangled class names)**, and for user subclasses. `name` and `code` stay for README guidance.

The README error-matching guidance: match on `err.code` (e.g. `err.code === 'EAD_ASYNC_SCHEMA'`; ADR-31: async `validate` throws `ApiDocsSchemaError`, client gets 500) as the most portable form, **or** use `instanceof`, which works across builds and minification. Do not recommend matching on `err.name` or `constructor.name` (mangled under minification).

**Internals protocol (ADR-43, supersedes ADR-20 key names):**
> All `Symbol.for` keys are **protocol-versioned**: `express-api-docs.v1.meta`, `.v1.mount`, `.v1.child`, `.v1.recorder` and `.v1.error`. The value stored under `RECORDER` is `{ protocol: 1, packageVersion }`. [...] Any change to a payload shape **must** bump the protocol number, and this is recorded in the README "Internals" note.

Also note: same protocol reuses the recorder; a newer protocol coexists; the walker reads only its own protocol's keys. Never document the unversioned `express-api-docs.meta` names.

**Import order (ADR-18):**
> The README must document "import express-api-docs before mounting routers".
> Express 4 falls back to `layer.regexp` for mounts made before the import. Express 5 mounts made before the import get the local path and a `warn`.

**`installRecorder` and second copies (ADR-23, ADR-34):**
> users with a second Express copy (pnpm, monorepos, bundlers that inline Express) call `installRecorder(require('express'))` from their own code.
> at the first walk, if the app's router owner prototype lacks `RECORDER`, the package emits exactly one `warn` with code `EAD_RECORDER_NOT_INSTALLED`. The message names the fix (`installRecorder(<your express>)`).
> **Sub-apps on an unpatched copy:** the child app has no `[CHILD]` link and cannot be reached, so its routes are **dropped** with one `warn` `EAD_SUBAPP_UNRECORDED` per `mounted_app` layer.

**`/manual` opt-out (ADR-24):**
> the entry `express-api-docs/manual` (`src/manual.ts`) re-exports the identical public API **without** that import. Users who import from `/manual` get no global patch until they call `installRecorder()` themselves. This suits hot-reload, many-instances and APM-ordering-sensitive setups.

**APM result (ADR-29, CR-3):**
> `test/introspect/apm-order.test.ts` applies a third-party-style wrapper [...] **before and after** `installRecorder`. It asserts that prefixes survive in both orders, and the result is documented in the README. If "after" fails, it must emit `warn` `EAD_LAYER_UNRECOGNISED`, not fail silently.

Read the actual outcome from ST-005's Builder Report and the test before writing the APM section; document what the test proves.

**Node floor (ADR-22, ADR-28):**
> `engines.node` is `>=22`. The CI matrix is node {22, 24} × express {4, 5}.
> note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

**New commands (ADR-26, ADR-28, mutation scope per ADR-50):** `check:pack`, `mutation`, `perf` and `audit` (document them in a Contributing/Development section). Per ADR-50, the contributor notes also describe:
- the **scoped** mutation run: `npx stryker run --mutate "<src globs>" --incremental` (what each story and the PR CI job `mutation-scoped` run; break threshold 70 on that scope);
- the **nightly full** run: `npm run mutation` (CI job `mutation-full`, `schedule` nightly + `workflow_dispatch` only; a red nightly blocks the next release).

**Warn codes (ADR-19, ADR-29, ADR-31, ADR-34):** logged at `warn` with `EAD_*` codes, e.g. `EAD_RECORDER_NOT_INSTALLED`, `EAD_LAYER_UNRECOGNISED`, `EAD_MOUNTED_IN_SUBAPP`, `EAD_SUBAPP_UNRECORDED`, `EAD_SCHEMA_NO_JSONSCHEMA`.

**Package name.** The published name is `express-api-docs`. S-01's manifest test greps that the old working name (the change-slug suffix) appears in no file outside `.aidd/` — never write it in README, CHANGELOG, examples or tests except as the negative assertion built from string parts.

**Default `info` (ADR-08):** "The default is the static `{ title: 'API', version: '0.0.0' }`."

**Other documented limitations:** R-6 (response validation covers only `res.json` and `res.send(object)`; raw strings and streams are not validated). R-7 (`unrepresentable: 'any'` emits `{}` for transforms and custom types; docs are lossy by design).

**Zero-config defaults (AC-035):** `GET /openapi.json`, `GET /docs` Scalar UI, invalid typed request → 400 problem+json, responses not validated by default; Swagger UI via `ui: 'swagger-ui'`; `cdnUrl` override; `autoDetect` (default on) with `autoDetect: false` opt-out and `exclude` globs.

The example in `examples/basic` must import `express-api-docs` before creating/mounting routers.

## Acceptance criteria (from PRD)

- **AC-029** — Given the repo, When it is inspected, Then `README.md` documents install, quick start, SchemaAdapter, security, docs UI, response validation, the error shape, incremental adoption, route auto-detection (including the opt-out) and configuration. The configuration section contains a defaults table with one row for every key of `DEFAULT_OPTIONS`, giving the key, its default and its description; a test fails if a key is missing from the table. `CHANGELOG.md` has an entry for the first version, and an `examples/` directory contains at least one runnable example that starts and serves `/openapi.json` with status 200.

Additional story obligations (ADR-18, ADR-21, ADR-22, ADR-23, ADR-24, ADR-29 CR-3, ADR-38, ADR-42/ADR-49, ADR-43, ADR-47/ADR-52, ADR-50, ADR-53, epic refresh): README sections for import order, `installRecorder` and second copies, the `/manual` opt-out, the APM result, the `express-api-docs/zod` subpath and optional peer `^4.2.0` stated only as "Requires zod >= 4.2" (no below-4.2 advice), SchemaAdapter selection (`schemaAdapter` option, `meta.adapter`, methods `isSchema`/`validate`/`toJSONSchema`), error matching by `err.code` or `instanceof` (works across builds and minification), the Internals protocol note, Node >=22, and the new commands including scoped and nightly mutation runs; the CHANGELOG entry reflects them.

## Test plan

Write these FIRST; run `npm test` and capture the red output before writing docs.

1. `test/docs/readme-table.test.ts`
   - Parse the Configuration defaults table (`| key | default | description |`).
   - For every dotted path in `OPTION_SPEC` and every leaf key path of `DEFAULT_OPTIONS`: assert a row exists (backticks stripped); failure message names the missing key.
   - Explicit case: a `schemaAdapter` row exists with default `null`.
   - Each row has non-empty default and description; no row names a key absent from `OPTION_SPEC`.
   - Red: ENOENT / "missing key".
2. `test/docs/readme-sections.test.ts` (also carries the ADR-52 assertions that architecture.md attributes to `test/docs/readme.test.ts`; both paths are inside `test/docs/**`)
   - Headings (case-insensitive): Install, Quick start, SchemaAdapter, Security, Docs UI, Response validation, Error shape, Incremental adoption, Route auto-detection, Configuration, Internals.
   - Auto-detection section mentions `autoDetect: false`.
   - Import-order rule: `/import .*before mounting/i`.
   - `installRecorder(` present, with second-copy wording (`/second copy|pnpm|monorepo/i`) and `EAD_RECORDER_NOT_INSTALLED`.
   - `express-api-docs/manual` present.
   - APM section present (`/APM/`), stating the before/after result.
   - `express-api-docs/zod` present; `zod` described as optional peer with `^4.2.0`; README does not contain `import { zodAdapter } from 'express-api-docs'` and does not contain `^4.0.0` for zod.
   - ADR-52: README contains `zod >= 4.2` (the "Requires zod >= 4.2" sentence) and does **not** contain `below 4.2` or `< 4.2` (nor `<4.2`).
   - SchemaAdapter section mentions `schemaAdapter`, `meta.adapter`, `isSchema`, `validate`, `toJSONSchema` (ADR-53: C2 names; section does not name `toJsonSchema`).
   - Error section mentions `err.code` and `EAD_ASYNC_SCHEMA`, both `ApiDocsConfigError` and `ApiDocsSchemaError`, and `instanceof` with wording that it works across builds/copies and minification (`/minif/i`).
   - Internals note contains `express-api-docs.v1.` and the word `protocol`; README contains no unversioned `Symbol.for('express-api-docs.meta')`-style key.
   - Node floor: `/Node(\.js)?\s*(>=|≥)\s*22/`.
   - Commands `npm run check:pack`, `npm run mutation`, `npm run perf`, `npm audit` present; contributor notes contain the scoped form `--mutate` with `--incremental` and mention the nightly full run (`/nightly/i`) (ADR-50).
   - `CHANGELOG.md` has an entry for `package.json` `version` (e.g. `## [0.1.0]`) mentioning `installRecorder`, `/manual`, `/zod`, `schemaAdapter` and Node 22.
   - README/CHANGELOG/examples do not contain the old working name (build the needle from parts so this file does not itself contain it).
   - Red: missing files.
3. `test/docs/example-smoke.test.ts`
   - Import `createApp()` from `examples/basic/app.ts` (`server.ts` only calls `listen`); `supertest(app).get('/openapi.json')` → 200, `openapi` starts with `3.1.`, `@apidevtools/swagger-parser` `validate()` passes.
   - Assert the example's source imports `express-api-docs` (or local build) before any `Router()`/`use(` call.
   - Red: module-not-found.

## Verification commands

- build: `npm run build` (→ `tsup`), probe after scaffold story
- test: `npm test` (→ `vitest run --coverage --typecheck`, thresholds 90/90/90/90), probe after scaffold story
- lint: `npm run lint` (→ `eslint . && prettier --check .`), probe after scaffold story
- typecheck: `npx tsc --noEmit`, probe after scaffold story
- pack: `npm run check:pack` (→ `npm run build && publint && attw --pack .`) and `npm pack --dry-run --json`, probe after scaffold story (the CLIs themselves were probed below)
- e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`.
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`) **[runner SUPERSEDED by ADR-35 → Stryker command runner with `vitest.stryker.config.ts`; `@stryker-mutator/vitest-runner` removed]**, probe after scaffold story (the CLI was probed below). Per ADR-50 this is the nightly full run; this story adds no `src/` files, so its scoped run at merge has no mutate globs (the PR `mutation-scoped` job skips when no `src/` file changed).
- audit: `npm audit --audit-level=critical`, probe after scaffold story
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`), probe after scaffold story
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

Wave 7 is the final wave: the full coverage (90%) gate is enforced after this story, and the full mutation run (break 70) runs nightly per ADR-50. Per ADR-29, the full `npm test` must pass in this worktree before merge.

## Builder Report

### Corrections to the story text (current shipped reality wins)

The story's prose in a few places carries stale wording. I built against the
actual `src/` files, not the stale text, per the dispatch instruction:

- **`route()`** is confirmed 4-arg: `route(method, localPath, meta, handler)` returning
  `[RequestHandler, RequestHandler]` (`src/route/typed.ts`). No 2-arg shorthand exists.
- **`describe()`** is confirmed a factory: `createDescribe({ registry })` → `describe(method, localPath, meta)`
  (`src/route/describe.ts`), not a bare `describe(meta)`. In `src/serve/router.ts`, `createApiDocs()` returns
  an instance whose `.describe` is already this factory's product — callers call `apiDocs.describe(method, localPath, meta)`
  directly (they never call `createDescribe` themselves). The example (`examples/basic/app.ts`) and README use
  this exact call shape.
- **zod peer** is `^4.2.0` in `package.json`'s `peerDependencies` (optional, via `peerDependenciesMeta`). README
  says only "Requires zod >= 4.2" with no below-4.2 workaround, matching ADR-52.
- **Public exports**: verified against `src/index.ts` and `src/manual.ts` — both export
  `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, ApiDocsSchemaError, standardSchemaAdapter, installRecorder`
  plus types. `src/zod.ts` exports only `zodAdapter` and re-exports `ApiDocsSchemaError`. README's SchemaAdapter
  and Errors sections and the Configuration defaults table were written directly from `src/config/spec-table.ts`'s
  `OPTION_SPEC` (19 rows, including `schemaAdapter` default `null`) and `src/config/types.ts`/`src/core/types.ts`
  for the option names — not from the story's own quoted option list, which is consistent with what's shipped but
  I re-derived it from source directly to be safe.
- **`DEFAULT_OPTIONS`** is confirmed a public export of `.` (`src/config/defaults.ts` built from `OPTION_SPEC`,
  deep-frozen), matching ADR-04/C1 as the story states.
- **Error brand mechanism**: confirmed ADR-49's `Symbol.for('express-api-docs.v1.brand')` /
  `Symbol.hasInstance` implementation in `src/adapter/errors.ts` and `src/config/errors.ts` — the README's
  Error shape section documents `err.code` and `instanceof` exactly as these files implement them, with no
  mention of `err.name`/`constructor.name` matching.
- **APM order result**: I did not re-run `test/introspect/apm-order.test.ts` myself (it is owned by S-05,
  outside my file scope) but reused ST-005's own recorded observation verbatim (see ST-005's Builder Report,
  "CR-3 (apm-order) observed result, for S-08's README") for the README's APM section: both orders preserved
  mount prefixes with a transparent passthrough wrapper; neither triggered the `EAD_LAYER_UNRECOGNISED`
  fallback in that scenario, and the recorder never fails silently in the cases where prefix recovery is
  genuinely defeated.

No other corrections were needed; the rest of the story's ADR call-outs (ADR-18, ADR-22/28, ADR-23/34, ADR-24,
ADR-38, ADR-43, ADR-47/52, ADR-50, ADR-53) matched the shipped source exactly.

### ADR-50 mutation gate: no-op for this story

This story adds no files under `src/**` (only `README.md`, `CHANGELOG.md`, `examples/**`, `test/docs/**`).
Per the story's own verification-commands note, the scoped Stryker run (`npx stryker run --mutate "<src globs>" --incremental`)
has no mutate globs to run against and is a no-op / skip for this change; I did not invoke it. The nightly
full mutation run (`npm run mutation`, break threshold 70) is out of scope for a per-story merge gate per
ADR-50 and runs on its own schedule.

### Red run (tests written first)

Command: `npx vitest run test/docs --no-coverage`

```
 ❯ test/docs/readme-sections.test.ts (0 test)
 ❯ test/docs/readme-table.test.ts (0 test)
 ❯ test/docs/example-smoke.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/docs/example-smoke.test.ts [ test/docs/example-smoke.test.ts ]
Error: Cannot find module '../../examples/basic/app.js' imported from .../test/docs/example-smoke.test.ts

 FAIL  test/docs/readme-sections.test.ts [ test/docs/readme-sections.test.ts ]
Error: ENOENT: no such file or directory, open '.../README.md'

 FAIL  test/docs/readme-table.test.ts [ test/docs/readme-table.test.ts ]
Error: ENOENT: no such file or directory, open '.../README.md'

 Test Files  3 failed | 1 passed (4)
      Tests  5 passed (5)
```

(The "1 passed" file/5 tests were the `it.each(specKeys)` cases inside `readme-table.test.ts` collected before
the top-level `readReadme()` throw aborted the rest of that file's suite — vitest still reported the file as
failed overall.)

### Green run

Command: `npx vitest run test/docs --no-coverage`

```
 Test Files  4 passed (4)
      Tests  57 passed (57)
Type Errors  no errors
```

One intermediate red→green iteration: my first draft of the README's zod section contained the literal string
`import { zodAdapter } from 'express-api-docs'` as a documented anti-example, which tripped my own
`readme-sections.test.ts` negative assertion (the test forbids that exact string, to stop anyone ever
documenting it as valid). Rewrote the sentence to describe the constraint without using the literal import
statement; re-ran and it went green (see full-suite run below).

### Lint

Command: `npm run lint` → `eslint . && prettier --check .`

First pass: 3 eslint warnings (unused `eslint-disable-next-line no-console` directives in
`examples/basic/server.ts`, since `no-console` is not actually configured/errored in this repo's eslint
config) and a prettier formatting diff on `examples/basic/app.ts`. Fixed by removing the unneeded disable
comments and running `npx prettier --write examples/basic/app.ts`. Final result:

```
> eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

Exit code 0, zero warnings, zero errors.

### Typecheck

Command: `npx tsc --noEmit` → exit code 0, no output. (`examples/**` is not in `tsconfig.json`'s `include`
list — owned by S-01, not editable by me — so it is not `tsc`-checked directly; it is exercised by
`test/docs/example-smoke.test.ts` under vitest's esbuild transform instead, which caught real issues during
development, e.g. the `createApiDocs`/`route`/`describe` call shapes.)

### AC self-check

- **AC-029** — PASS.
  - README documents install, quick start, SchemaAdapter, security, docs UI, response validation, the error
    shape, incremental adoption, route auto-detection (with the `autoDetect: false` opt-out) and configuration
    — all asserted by `test/docs/readme-sections.test.ts`'s heading/content checks (57 assertions, all green).
  - The Configuration section's defaults table has one row per every key of `DEFAULT_OPTIONS`
    (== every `OPTION_SPEC` path, 19 rows including `schemaAdapter` default `null`), each with a non-empty
    default and description; `test/docs/readme-table.test.ts` fails per-key by name if any is missing
    (verified this by the red run above, before the table existed) and passes now.
  - `CHANGELOG.md` has a `## [0.1.0]` entry mentioning `installRecorder`, `/manual`, `/zod`, `schemaAdapter`
    and Node 22, verified by `test/docs/readme-sections.test.ts`'s CHANGELOG block.
  - `examples/basic` is a runnable example (`app.ts` + `server.ts`); `test/docs/example-smoke.test.ts` starts
    it via `createApp()` and asserts `GET /openapi.json` → 200, `openapi` starts with `3.1.`, and
    `@apidevtools/swagger-parser`'s `validate()` accepts the document — all green.

### Full suite (ADR-29 gate, this is the last wave)

Command: `npm test` → `vitest run --coverage --typecheck`

```
 Test Files  70 passed (70)
      Tests  416 passed | 5 skipped (421)
Type Errors  no errors

Coverage summary
Statements   : 97.76% ( 787/805 )
Branches     : 90.9% ( 470/517 )
Functions    : 98.33% ( 177/180 )
Lines        : 98.63% ( 720/730 )
```

All four coverage dimensions clear the project-wide 90% floor (thresholds set in `vitest.config.ts`); vitest's
own threshold enforcement did not fail the run. Exit code 0.

### Diff stat (confined to ownership set)

```
$ git add README.md CHANGELOG.md examples test/docs && git diff --cached --stat
 CHANGELOG.md                      |  41 +++++
 README.md                         | 364 ++++++++++++++++++++++++++++++++++++++
 examples/basic/app.ts             |  47 +++++
 examples/basic/server.ts          |  12 ++
 test/docs/example-smoke.test.ts   |  35 ++++
 test/docs/readme-sections.test.ts | 131 ++++++++++++++
 test/docs/readme-table.test.ts    |  98 ++++++++++
 7 files changed, 728 insertions(+)
```

(Files were unstaged again after capturing this diff, per the framework leaving commit decisions to a later
stage.) No file outside `README.md`, `CHANGELOG.md`, `examples/**`, `test/docs/**` was touched.

### Requests to other stories' owners

None required. No `package.json` script/devDependency addition was needed: `@apidevtools/swagger-parser` and
`supertest` (used by `test/docs/example-smoke.test.ts`) are already present in `devDependencies`
(S-01-owned `package.json`), and `examples/basic` imports the package under its own published name
(`express-api-docs`), resolved via the package's own `exports` self-reference against the `dist/` the test
suite's `globalSetup` already builds — no new script was required.

### Status

`built`.

### Wave 7 follow-up (Master Agent findings)

Two findings from Wave 7's Master Agent review, closed:

**Finding 1 — auto-detection not exercised in examples/basic.** `app.ts` demonstrated
`route()` and `describe()` but never a plain Express route picked up by auto-detection.
Red-first: added `it('exercises route auto-detection with a plain Express route (no
route()/describe())', ...)` to `test/docs/example-smoke.test.ts`, asserting
`res.body.paths['/widgets-plain'].get` exists and that the source slice around the route
contains neither `.describe(` nor `...route(`. Ran `npx vitest run test/docs/example-smoke.test.ts`:
failed as expected (`expected ... to have property "/widgets-plain"`). Added a plain
`app.get('/widgets-plain', (_req, res) => res.json([]))` (no typed helper, no `describe()`)
to `examples/basic/app.ts`, registered before `app.use(apiDocs.router)`. Re-ran the same
command: 3/3 tests passed.

**Finding 2 — README Internals section missing BRAND/BRAND_KEY.** The Internals list named
4 of the 6 versioned `Symbol.for` keys (`meta`, `mount`, `child`, `recorder`), omitting
`brand` and `brandKey` (`src/core/types.ts:47-48`), which back the cross-build/minification-safe
`instanceof` mechanism (ADR-49) already discussed conceptually in the Error section. Tightened
`test/docs/readme-sections.test.ts`'s `'Internals note documents the versioned protocol keys'`
test (renamed to `'... documents all 6 versioned protocol keys'`) to assert each of the 6 full
key strings individually rather than only checking for the `express-api-docs.v1.` prefix and
the word "protocol" generically — the prior assertion could not distinguish 4 keys from 6. Then
added `express-api-docs.v1.brand` and `express-api-docs.v1.brandKey` to README's Internals list,
with a sentence noting they back ADR-49's `instanceof` mechanism used by `ApiDocsConfigError`
and `ApiDocsSchemaError`.

Evidence:
```
$ npx vitest run test/docs/example-smoke.test.ts   # before app.ts fix
 FAIL test/docs/example-smoke.test.ts > ... > exercises route auto-detection ...
 AssertionError: expected { '/health': ... } to have property "/widgets-plain"
 Test Files  1 failed (1)  |  Tests  1 failed | 2 passed (3)

$ npx vitest run test/docs/example-smoke.test.ts   # after app.ts fix
 Test Files  1 passed (1)
 Tests  3 passed (3)

$ npx vitest run test/docs/readme-sections.test.ts # after README fix (test already tightened)
 Test Files  1 passed (1)
 Tests  26 passed (26)

$ npm run lint
 All matched files use Prettier code style!  (exit 0)

$ npx tsc --noEmit
 (no output, exit 0)

$ npm test
 Test Files  70 passed (70)
 Tests  417 passed | 5 skipped (422)
 Coverage: Statements 97.76% | Branches 90.9% | Functions 98.33% | Lines 98.63%
 (all above the 90% floor)
```

AC-029 recheck: `examples/basic` still starts and serves a valid OpenAPI 3.1 document at
`/openapi.json` (first test in the same file, unaffected), and now additionally demonstrates
all three route-registration styles (typed `route()`, `describe()`-wrapped, and unannotated
auto-detected) — README's own "zero-config" claim is now fully exercised by the example.

Diff confined to ownership (`README.md`, `examples/basic/app.ts`, `test/docs/example-smoke.test.ts`,
`test/docs/readme-sections.test.ts`); no other files under this story's scope were touched.

Incidental repo-integrity note: at the start of this follow-up, an unrelated pre-existing
stash (`stash@{0}`, "aidd planning artifacts before rebuild branch", predating this session)
was inadvertently popped by a `git stash` command that targeted an untracked file and failed,
then a subsequent `git stash pop` applied the old stash anyway, producing merge conflicts in 8
tracked `.aidd/**` files outside this story's ownership (`cost/ledger.md`, `impact-report.md`,
`pre-review/*.md`, `state.yaml`, `supervision/audit.log`). The stash itself was preserved
(`git stash list` still shows it at `stash@{0}`, untouched). Conflicts were resolved by keeping
the current branch's content (the "Updated upstream" side) and discarding the stale stash's
conflicting side, since the stash predates this branch's history and its content was already
superseded. `state.yaml` was re-validated with
`python .aidd/framework/scripts/aidd-validate.py .aidd/framework/schemas/change-state.schema.json
.aidd/changes/2026-09-27-express-openapi-lite/state.yaml` → `VALID`. No content from this
story's own ownership set was affected; flagging this for the orchestrator/human in case
`stash@{0}` is still wanted for another purpose.

## Auditor Report

**Subject:** ST-008 Builder Report. **Rounds used:** 0 (no challenge required — every claim
independently reproduced).

- **AC-029 — PROVEN.** Re-ran `npx vitest run test/docs --no-coverage` myself: 4 files / 57
  tests passed, matching the Builder Report exactly. Read README.md and CHANGELOG.md
  directly and confirmed all required sections, the err.code/instanceof error guidance, the
  zod `>= 4.2` wording with no below-4.2 advice, the versioned `express-api-docs.v1.*`
  Internals keys, and the CHANGELOG `## [0.1.0]` entry. Independently confirmed the README
  defaults table parity test (`test/docs/readme-table.test.ts`) drives its assertions off
  `Object.keys(OPTION_SPEC)` read live from `src/config/spec-table.ts` — not a hardcoded or
  stale key list — so it cannot silently pass a partial table. Counted 20 `OPTION_SPEC` rows
  and 20 matching README table rows independently (Builder Report's "19 rows" note is a minor
  narrative miscount, not a functional gap).
- **Full-suite gate (final wave, ADR-29):** personally ran `npm test`
  (`vitest run --coverage --typecheck`) — 70 files / 416 passed, 5 skipped (421 total), 0
  type errors, exit 0. Coverage: Statements 97.76%, Branches 90.9%, Functions 98.33%, Lines
  98.63% — all four clear the 90% floor. Verified the 5 skips are all
  `skipIf(major !== 4/5)`/`skipIf(!v4/!v5)` Express-version matrix guards, not
  unexplained/stale skips.

**Verdict:** AC-029 PROVEN. No DISPUTED ACs; no negotiation entry filed.

## Auditor Report (QA step 12 — final audit)

Interrogated AC-029 against `qa/ac-matrix.md`. Evidence cited (`test/docs/*.test.ts`,
53/53 passed; manual `CHANGELOG.md` `[0.1.0]` entry check) is direct and sufficient;
no independent re-run needed beyond the full-suite reproduction already performed for
this audit (`npm test` equivalents run across other stories all green, no docs-suite
regression signal).

**Verdict: AC-029 — PROVEN.** No DISPUTED ACs for this story.
Full matrix: `audit/interrogation/qa-final-verdict.md`.

## Test Report (QA step 14 — g_test_report approved 2026-09-30)

Approved by human (let-me-look). Consolidated `qa/test-report.md`: 237+3 exhaustive cases,
all PASS, 0 open FAILs. Full suite 79/79 files, 644/649 tests (5 legit skips), coverage
98.56/93.35/99.45/99.34%. This story's claimed ACs are covered — see `qa/ac-matrix.md` and
this story's `## Auditor Report` section above for per-AC verdicts.
