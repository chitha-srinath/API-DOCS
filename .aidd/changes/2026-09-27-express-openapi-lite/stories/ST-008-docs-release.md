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

The context pack says the repo is greenfield (epic.md: "the repo is greenfield. No re-crawl was done."). When this story runs, S-01 to S-07 are merged. Read the public API from `src/index.ts`, `src/manual.ts` and `src/zod.ts` (owned by S-07, read-only for you).

**Ownership (epic.md):**
> | S-08 | `README.md`, `CHANGELOG.md`, `examples/**`, `test/docs/**` | `examples/basic/`, `test/docs/` |

> `test/docs/**` belongs to S-08 and `test/docs-ui/**` to S-07.

> If a later story needs a devDependency or script, it records the request in its story report and does not edit `package.json`.

**Component C11 (architecture.md):**
> | C11 | `README.md`, `CHANGELOG.md`, `examples/basic/*`, `test/docs/readme-table.test.ts` | The documentation. A test checks the README defaults table against `OPTION_SPEC` paths. The example is exercised by a smoke test. | 029 | — (none; bespoke) | S-08 docs-release |

**Epic refresh obligation (epic.md, "Stories needing refresh"):**
> | ST-008-docs-release.md | **Must** | The README needs new sections: `installRecorder` and second copies, the `/manual` opt-out, import order and the APM result, the zod subpath and optional peer, Node ≥22, and the new commands. The CHANGELOG entry must reflect them. |

**Epic test list for S-08:**
> `readme-sections.test.ts` checks that the README has the original sections plus: `installRecorder` and second copies of Express, the `/manual` opt-out, import order and the APM result (CR-3), the `express-api-docs/zod` subpath, and Node ≥22.

**Config source of truth (C1, ADR-04):** `OPTION_SPEC` (`src/config/spec-table.ts`) is "a table of rows `{ path, default, check, allowed, description }`, keyed by dotted path"; "The same table drives runtime validation, `DEFAULT_OPTIONS` and the README parity test." `DEFAULT_OPTIONS` is a public export of `.`.

**Zod subpath (ADR-21):**
> `zod` becomes an **optional peer**: `peerDependencies.zod: ^4.0.0` plus `peerDependenciesMeta.zod.optional: true`. The core (`.` entry) **never imports `zod`**.
> **Default adapter:** the core ships `standardSchemaAdapter` [...] zero-options `createApiDocs()` accepts Zod v4 schemas (AC-035) with no zod import in core.
> `zodAdapter` lives **only** at the subpath export `express-api-docs/zod` [...] It adds Zod-specific handling: `unrepresentable: 'any'` and typed `z.infer`.

R-9: "The README recommends `express-api-docs/zod` for Zod users." Never document `import { zodAdapter } from 'express-api-docs'`.

**Import order (ADR-18, R-8):**
> The README must document "import express-api-docs before mounting routers".
> Mounts made before the package is imported, or on a second copy of Express, cannot be recorded. Express 4 falls back to `layer.regexp`; Express 5 gets the local path.

**`installRecorder` and second copies (ADR-23):**
> users with a second Express copy (pnpm, monorepos, bundlers that inline Express) call `installRecorder(require('express'))` from their own code.
> at the first walk, if the app's router owner prototype lacks `RECORDER`, the package emits exactly one `warn` with code `EAD_RECORDER_NOT_INSTALLED`. The message names the fix (`installRecorder(<your express>)`).

**`/manual` opt-out (ADR-24):**
> the entry `express-api-docs/manual` (`src/manual.ts`) re-exports the identical public API **without** that import. Users who import from `/manual` get no global patch until they call `installRecorder()` themselves. This suits hot-reload, many-instances and APM-ordering-sensitive setups.

**APM result (ADR-29, CR-3):**
> `test/introspect/apm-order.test.ts` applies a third-party-style wrapper [...] **before and after** `installRecorder`. It asserts that prefixes survive in both orders, and the result is documented in the README. If "after" fails, it must emit `warn` `EAD_LAYER_UNRECOGNISED`, not fail silently.

Read the actual outcome from ST-005's Builder Report / the test before writing the APM section; document what the test proves.

**Node floor (ADR-22, ADR-28):**
> `engines.node` is `>=22`. The CI matrix is node {22, 24} × express {4, 5}.
> note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

**New commands (ADR-26, ADR-28):** `check:pack`, `mutation`, `perf` and `audit` (document them in a Contributing/Development section).

**Warn codes (ADR-19, ADR-29):** lost identity, unrecognised layers, unrecoverable prefixes are logged at `warn` with `EAD_*` codes (e.g. `EAD_RECORDER_NOT_INSTALLED`, `EAD_LAYER_UNRECOGNISED`, `EAD_MOUNTED_IN_SUBAPP`).

**Package name.** The published name is `express-api-docs`. S-01's manifest test "greps that `express-openapi-lite` appears in no file outside `.aidd/`" — never write that string.

**Default `info` (ADR-08):** "The default is the static `{ title: 'API', version: '0.0.0' }`."

**Other documented limitations:** R-6 (response validation covers only `res.json` and `res.send(object)`; raw strings and streams are not validated). R-7 (`unrepresentable: 'any'` emits `{}` for transforms and custom types; docs are lossy by design).

**Zero-config defaults (AC-035):** `GET /openapi.json`, `GET /docs` Scalar UI, invalid typed request → 400 problem+json, responses not validated by default; Swagger UI via `ui: 'swagger-ui'`; `cdnUrl` override; `autoDetect` (default on) with `autoDetect: false` opt-out and `exclude` globs.

The example in `examples/basic` must import `express-api-docs` before creating/mounting routers.

## Acceptance criteria (from PRD)

- **AC-029** — Given the repo, When it is inspected, Then `README.md` documents install, quick start, SchemaAdapter, security, docs UI, response validation, the error shape, incremental adoption, route auto-detection (including the opt-out) and configuration. The configuration section contains a defaults table with one row for every key of `DEFAULT_OPTIONS`, giving the key, its default and its description; a test fails if a key is missing from the table. `CHANGELOG.md` has an entry for the first version, and an `examples/` directory contains at least one runnable example that starts and serves `/openapi.json` with status 200.

Additional story obligations (ADR-18, ADR-21, ADR-22, ADR-23, ADR-24, ADR-29 CR-3, epic refresh): README sections for import order, `installRecorder` and second copies, the `/manual` opt-out, the APM result, the `express-api-docs/zod` subpath and optional peer, Node >=22, and the new commands; CHANGELOG entry reflects them.

## Test plan

Write these FIRST; run `npm test` and capture the red output before writing docs.

1. `test/docs/readme-table.test.ts`
   - Parse the Configuration defaults table (`| key | default | description |`).
   - For every dotted path in `OPTION_SPEC` and every leaf key path of `DEFAULT_OPTIONS`: assert a row exists (backticks stripped); failure message names the missing key.
   - Each row has non-empty default and description; no row names a key absent from `OPTION_SPEC`.
   - Red: ENOENT / "missing key".
2. `test/docs/readme-sections.test.ts`
   - Headings (case-insensitive): Install, Quick start, SchemaAdapter, Security, Docs UI, Response validation, Error shape, Incremental adoption, Route auto-detection, Configuration.
   - Auto-detection section mentions `autoDetect: false`.
   - Import-order rule: `/import .*before mounting/i`.
   - `installRecorder(` present, together with second-copy wording (`/second copy|pnpm|monorepo/i`) and `EAD_RECORDER_NOT_INSTALLED`.
   - `express-api-docs/manual` present.
   - APM section present (`/APM/`), stating the before/after result.
   - `express-api-docs/zod` present and `zod` described as optional peer; README does not contain `import { zodAdapter } from 'express-api-docs'` (only from `/zod`).
   - Node floor: `/Node(\.js)?\s*(>=|≥)\s*22/`.
   - Commands `npm run check:pack`, `npm run mutation`, `npm run perf` present.
   - `CHANGELOG.md` has an entry for `package.json` `version` (e.g. `## [0.1.0]`) mentioning `installRecorder`, `/manual`, `/zod` and Node 22.
   - README/CHANGELOG/examples do not contain `express-openapi-lite`.
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
- mutation: `npm run mutation` (→ `stryker run`, `thresholds.break: 70`), probe after scaffold story (the CLI was probed below)
- audit: `npm audit --audit-level=critical`, probe after scaffold story
- perf (gate, ADR-26): `npm run perf` (→ `vitest run --config vitest.perf.config.ts`), probe after scaffold story
- note (ADR-22): contributors and CI need Node >= 22.19; the consumer `engines` field is `>=22`

Wave 7 is the final wave: the full coverage (90%) and mutation (break 70) gates are enforced after this story. Per ADR-29, the full `npm test` must pass in this worktree before merge.

## Builder Report
