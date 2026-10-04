# Impact Report: 2026-09-27-express-openapi-lite (re-run #2 against the current plan: ADR-01..48, prd.md AC-001..047, refreshed epic.md and ST-001..008)

<!-- Impact Analyst, pre-build (Inception step 10), re-run #2 for Supervisor V6 recurrence. -->

**Environment note:** this is the rebuild branch `aidd/2026-09-27-express-openapi-lite-rebuild` (HEAD `4cea289`). `git ls-files | wc -l` = 178, and `git ls-files | grep -v '^\.aidd\|^\.claude'` returns only `.gitignore` and `AGENTS.md`. There is no `src/`, `package.json`, `test/` or `.github/` on this branch. That matches `.aidd/context/snapshot.md` (empty product tree), so the change is genuinely greenfield. The previous report's claims about "274 tracked files" and the merged construction output describe the superseded PR-1 branch and are void here.

## Blast-radius rating

**MEDIUM**. In-repo fan-in is 0. The rating is driven by out-of-repo reach: importing the `.` entry still patches Express `use()` process-wide (ADR-18, isolated in `dist/auto-record.*` by ADR-24/ADR-40), and the first publish fixes a wide semver contract. That contract covers 3 entries plus `./package.json` (ADR-48), an exact export list (ADR-41), versioned `Symbol.for` protocol keys (ADR-43), branded errors (ADR-42), the new `schemaAdapter` option (ADR-38/AC-047) and an optional `zod ^4.2.0` peer (ADR-47/AC-004). There is no data, so it cannot be HIGH. Global prototype patching and cross-copy protocol keys are permanent public commitments, so it cannot be LOW.

## Lenses

| Lens | Finding | Governing ADRs | Evidence |
|---|---|---|---|
| Caller / dependency impact | **In-repo: none found.** Probe: `git ls-files \| grep -v '^\.aidd\|^\.claude'` → `.gitignore`, `AGENTS.md` only. `grep -rn "express-api-contract\|express-openapi-lite" .gitignore AGENTS.md` → no matches. **External callers are the consumers' Express apps.** (a) `import 'express-api-contract'` runs `./auto-record`, which calls `installRecorder()` on the resolved `express` and patches owner prototypes for every router in the host process. `./manual` opts out. (b) Multi-copy installs (pnpm, monorepos, CJS+ESM dual load) interact through `Symbol.for('express-api-contract.v1.*')`. A same-protocol recorder is reused, a different protocol is handled by ADR-43 rules, and `[META]` is now load-bearing for cross-copy discovery (walker falls back to `[META]` when `findByHandle` misses). (c) Sub-apps on an unpatched Express copy are dropped, not local-pathed (ADR-23 as amended by ADR-34). (d) Consumer error middleware receives `next(err)` exactly once even after `headersSent` (ADR-33), so apps that relied on hanging responses see the socket destroyed instead. | ADR-17, 18, 20, 23, 24, 33, 34, 40, 43, 44 | architecture.md:85, 88, 89, 98, 99, 105, 108, 109 |
| Public-contract impact | **New contract, not breaking** (no prior version), but it becomes the semver baseline. Surface: the exports map for `.`, `./manual`, `./zod` and `"./package.json"` (ADR-48). The exact export names are `createApiDocs, DEFAULT_OPTIONS, ApiDocsConfigError, ApiDocsSchemaError, standardSchemaAdapter, installRecorder`, and `./zod` exports only `zodAdapter` plus a re-exported `ApiDocsSchemaError`, with parity asserted by `test/entries/parity.test.ts` (ADR-41). Errors are matched by brand through `Symbol.hasInstance`, so `instanceof` works across copies (ADR-42), and `EAD_ASYNC_SCHEMA` gives a 500 for async refinements (ADR-37). There is a new global and per-route option `schemaAdapter` (duck-typed, default `null` → `standardSchemaAdapter`) (ADR-38, AC-047). Peers are `express ^4.21.0 \|\| ^5.0.0` and **`zod ^4.2.0` optional**, and `engines.node >=22` (ADR-21 amended by ADR-47, ADR-22; AC-004). **Risk:** users on zod 4.0/4.1 fall outside the peer range because `~standard.jsonSchema` is absent there (ADR-47 probe). The PRD, ST-001, ST-003 and ST-008 now consistently say `^4.2.0` (`grep -n "\^4\.0\.0"` hits only "superseded" notes in ST-003:71 and ST-008:68,71). The protocol keys `express-api-contract.v1.*` are a cross-version wire contract (ADR-43). | ADR-21, 22, 24, 37, 38, 41, 42, 43, 47, 48 | prd.md:22 (AC-004), prd.md:65 (AC-047); architecture.md:103, 106-108, 112-113 |
| Data & migration impact | **None found.** There is no persistence, DB or migration. The only state is the in-memory spec cache with `invalidate()`, plus recorder marks (`{protocol: 1, packageVersion}` under `RECORDER`, ADR-43) on Express prototypes. These last for the process lifetime and reset on restart. The protocol-version field is the forward-migration path for future recorder changes. Rollback means npm deprecate. No publish happens in this run (release is `workflow_dispatch` only). | ADR-43 | architecture.md:108; ST-001-scaffold.md |
| CI/CD & ops burden | **New, all owned by S-01.** Matrix of node {22, 24} × express {4, 5}; `node-version: 20` is banned by `test/meta/workflows.test.ts` (ADR-22, ADR-46). Typecheck runs in every cell, and the v4 cells install `@types/express@4.17.25` with `tsconfig.v4.json` (ADR-36). There is a separate blocking mutation job that uses the Stryker **command runner** with `vitest.stryker.config.ts`, `@stryker-mutator/vitest-runner` removed, and `thresholds.break: 70` (ADR-05 → ADR-35). Build shape is `splitting:false`, `shims:true` and external `./auto-record`, asserted by `test/dist/build-shape.test.ts` (ADR-40). esbuild is pinned to `~0.27.7` for a single deduped tree (ADR-45). The zod devDependency is `^4.6.5` and the peer floor is `^4.2.0` (ADR-47, ST-001:132). The peer-floor and perf jobs remain (ADR-25/26). **Flakiness risks:** the perf gate on shared runners (ADR-26); the `freshExpress` require-cache purge including private dep roots (ADR-34); the registry availability of old versions for peer-floor; mutation runtime at `timeoutMS: 60000` with `concurrency: 4` (ADR-35). No secrets are needed until release. | ADR-05, 22, 25, 26, 35, 36, 40, 45, 46, 47 | architecture.md:100-101, 105, 110-112; ST-001-scaffold.md:132, 142, 220 |

## ADR-32 to ADR-48 → lens map

| ADR | Lens(es) | Owner (epic.md) |
|---|---|---|
| 32 AC-023 spec-side nested fixture | Caller (nested routers) | S-06 `test/spec/ac023.test.ts` |
| 33 `wrapAsync` next(err) once | Caller, Contract | S-04 |
| 34 `freshExpress` isolation, warn cardinality | Caller, CI flakiness | S-01 fixture, S-05 tests |
| 35 Stryker command runner | CI | S-01 |
| 36 typecheck in every cell, v4 types | CI | S-01 `tsconfig.v4.json` |
| 37 async-refine 500 `EAD_ASYNC_SCHEMA` | Contract | S-04 |
| 38 `schemaAdapter` option / AC-047 | Contract | S-02 row, S-03 stub fixture, S-04/S-06 tests, S-07 wiring |
| 39 `majors.ts` root-first dedupe | CI, Caller | S-01 |
| 40 tsup build shape | Caller (side-effect isolation), CI | S-01 |
| 41 exact export list | Contract | S-07 exports, S-03 class |
| 42 branded errors | Contract | S-02, S-03, S-07 |
| 43 `v1` protocol keys | Caller, Contract, Data | S-01 constants, S-05 recorder |
| 44 `[META]` load-bearing | Caller | S-04, S-05 |
| 45 esbuild `~0.27.7` | CI | S-01 |
| 46 node 20 void | CI | S-01 |
| 47 zod peer `^4.2.0` | Contract, CI | S-01, S-03 |
| 48 `./package.json` export | Contract | S-01 |

## Reach outside planned ownership (epic.md:20-164)

Probe: every backticked path in architecture.md:97-113 (ADR-32..48) was grepped by basename against epic.md. Every hit count is ≥1 except the glob `*.test-d.ts`, which is a pattern and not a file; the concrete type-test files live under `test/route/**` (S-04) and `test/config/**` (S-02), per epic.md:302, 313.

1. **`vitest.stryker.config.ts`**: **RESOLVED.** The previous report flagged it UNOWNED. It is now owned by S-01 (epic.md:26, shared-files table, and epic.md:92).
2. **`test/fixtures/*`**: split by exact file. `majors.ts` and `fresh-express.ts` → S-01 (ADR-34/39), `stub-adapter.ts` → S-03 (ADR-38), `apps.ts` and `logger.ts` → S-05. No gap and no overlap.
3. **`test/dist/**`** (S-01) is restricted to 4 named files (`global-setup.ts`, `manifest.test.ts`, `pack.test.ts`, `build-shape.test.ts`). Built-dist behaviour tests (`dual-load`, `bundle`, `parity`, `no-zod-load`, `recorder-install`) sit in `test/entries/**` (S-07). This is consistent with ADR-40/41/42/48.
4. **`bench/**`**: owned by S-07, and excluded from the mutation run by S-01's `vitest.stryker.config.ts` (ADR-35). This is a cross-story reference only, not a shared edit.
5. **Handovers**: `src/index.ts`, `src/manual.ts` and `src/zod.ts` (S-01 W1 → S-07 W6) and `src/auto-record.ts` (S-01 W1 → S-05 W4). These are sequential, with no concurrent share.
6. **`package.json`**: single owner S-01. It carries the ADR-21/22/24/35/36/40/45/47/48 fields, so other stories must route requests through their Builder Reports.
7. **`AGENTS.md`, `.claude/**`**: unowned framework files, read-only, and clean under the name grep. Recommendation (carried over): the AC-001 grep scope should exclude `.aidd/`, `.claude/`, `.git/` and `node_modules/`.
8. **Minor (Epic Scoper):** epic.md:364 "Stories needing refresh" still lists refresh obligations although all 8 stories were refreshed. Mark that section as done so builders do not re-apply it.

**Unowned files reached by the blast radius: none.**

## QA confirmation (post-build)

<!-- To complete in QA mode: exports map incl. ./package.json; exact export names; dist/index.* free of zod; ./manual does not import auto-record; build-shape (splitting false, external ./auto-record); peer zod ^4.2.0 optional; Symbol.for keys use v1; mutation, peer-floor and perf jobs blocking; no node 20 in workflows. -->
