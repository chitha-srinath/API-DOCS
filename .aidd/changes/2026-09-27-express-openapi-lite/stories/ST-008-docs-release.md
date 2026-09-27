---
id: ST-008
title: "Docs and release: README, CHANGELOG, example, README parity tests"
wave: 7
status: queued
attempts: 0
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
