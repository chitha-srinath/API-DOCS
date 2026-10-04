# Pre-Implementation Review Findings — test-strategy (RE-RUN #2, Supervisor V6 recurred)

<!-- Reviewer mode=pre, dimension=test-strategy. This is a REBUILD branch with no package code. Only the PLAN is judged: architecture.md (ADR-01 to ADR-48; new since the last run: ADR-32 to ADR-48), prd.md (47 ACs, AC-047 added, zod ^4.2.0), epic.md, stories/ST-001..ST-008.
     Earlier notes about live code are discarded.
     Probes (read-only, all exit 0): `grep -n "^| ADR-(3[2-9]|4[0-8])" architecture.md`; `grep -n "AC-0" prd.md`; `grep -n "AC-0|S-0" epic.md`;
     `grep -n "resetModules|vitest-runner|node-version: 20|headersSent|not called again|AC-047|isSchema|toJSONSchema" stories/*.md`; `sed -n 154p;236,250p;270p stories/ST-001-scaffold.md`; `sed -n 160,200p stories/ST-004-typed-route.md`. -->

## Part A — Status of prior findings

| # | Prior sev | Status | Evidence |
|---|---|---|---|
| 1 | HIGH | RESOLVED | ADR-23 (public `installRecorder`); ST-005 t0/t7. |
| 2 | HIGH | RESOLVED | ADR-25 plus ADR-39 (`majors.ts` owned by S-01, keeps the root copy first). |
| 3 | HIGH | RESOLVED | ADR-26; ST-007 perf tests; ST-001 t5 asserts the perf job is not `continue-on-error`. |
| 4 | MEDIUM | RESOLVED | ADR-29 #4, amended by ADR-33; ST-004 t5. |
| 5 | MEDIUM | RESOLVED | ADR-29 #5; suite-wide `test/dist/global-setup.ts` (ST-001). ADR-35 keeps it out of `vitest.stryker.config.ts`. |
| 6 | MEDIUM | RESOLVED | ADR-27d mutate scope; ADR-35. |
| 7 | MEDIUM | RESOLVED | ADR-29 #7; epic merge rule; ST-007 verification ("full suite required"). |
| 8 | LOW | Resolved in the plan. Evidence is still owed. | ADR-25/36; ST-001 t5 asserts `${{ matrix.express }}`. A real green CI run is still needed as Delivery evidence, and a rebuild branch cannot have one yet. |
| 9 | LOW | RESOLVED | ADR-29 #9; `test/fixtures/logger.ts` (S-05). |
| N1 | HIGH | RESOLVED | ADR-32; ST-006 `test/spec/ac023.test.ts` (ST-006:179-180) asserts the whole Then-clause per major, with the tag taken from the mounted path. Epic row S-06 lists "AC-023 (spec half, ADR-32)". |
| N2 | MEDIUM | RESOLVED | ADR-33; ST-004 t6 (a)(b)(c) requires `next(err)` exactly once even when `headersSent` is true. The old "not called again" wording is gone (grep: 0 hits). See the residual in T4. |
| N3 | MEDIUM | RESOLVED | ADR-34; `freshExpress` (ST-001:173, owned by S-01); ST-005 t7 "never `vi.resetModules`", expects 2 warns after `invalidate()`, sub-app routes are dropped with `EAD_SUBAPP_UNRECORDED`. See the residual in T5. |
| N4 | MEDIUM | RESOLVED | ADR-35; ST-001:142 (command runner, `vitest.stryker.config.ts` without the build globalSetup, and without the dist/entries/perf tests); ST-001:220 asserts the vitest-runner is absent; ST-001 t9 mutation smoke. See the new T2. |
| N5 | MEDIUM | RESOLVED in intent, **partially regressed in mechanism** | ADR-36 makes typecheck run in every cell. The workflows test does not pin how the v4 cells pick `tsconfig.v4.json`, and `npm test` (`vitest --typecheck`) ignores it. See T1. |
| N6 | MEDIUM | RESOLVED | ADR-37; the S-04 `request-validation.test.ts` async-refine case (epic row "Async-refine body gives 500 `EAD_ASYNC_SCHEMA`"). |
| N7 | MEDIUM | RESOLVED | ADR-38; ST-004 t7 `stub-adapter.test.ts`; ST-006 "stub schema appears in requestBody"; ST-007 t3 `schema-adapter.test.ts`; new AC-047. |
| N8 | LOW | RESOLVED | ADR-39; lint rule against `require('express4')` outside the fixtures (ST-001 t6). |

## Part B — New findings against the current plan (ADR-32 to ADR-48)

| # | Severity | Artifact | Claim | Concrete risk scenario | Cited evidence |
|---|---|---|---|---|---|
| T1 | MEDIUM | ADR-36; ST-001:154, ST-001 t5 (:243); `npm test` = `vitest run --coverage --typecheck` | The v4-cell typecheck mechanism is only half pinned. `tsconfig.v4.json` excludes `*.v5.test-d.ts` only for `tsc`. Vitest's `--typecheck` collects every `**/*.test-d.ts` through its own `typecheck.include`/`typecheck.tsconfig`, not `tsconfig.v4.json`. The workflows test asserts the literal `npx tsc --noEmit` and never asserts that the v4 path references `tsconfig.v4.json`. | Case 1: S-04 adds `typed.v5.test-d.ts` as ADR-36 allows. In the `express: 4` cells, `npm test` type-checks it against `@types/express@4.17.25`, so CI goes red for correct code. Case 2: a builder writes a plain `npx tsc --noEmit` step. `workflows.test.ts` still passes, the v4 cells check the v5-only files, and CI goes red. The same happens if the builder removes the v5 files to stay green, which leaves v5-specific typing untested. Fix: pin `vitest.config.ts` `typecheck.tsconfig` (and exclude) from an env var such as `EXPRESS_MAJOR`, and have `workflows.test.ts` assert that the typecheck step's `run` contains `tsconfig.v4.json` selected by `matrix.express`. | ST-001:154 ("In v4 cells the typecheck uses `tsconfig.v4.json`… select the tsconfig with an expression inside `run`"); ST-001:243 (asserts only `npx tsc --noEmit` plus no `if:`); ST-004/ST-007 verification: `npm test (→ vitest run --coverage --typecheck)` |
| T2 | MEDIUM | ADR-35; ST-001:142, t5 (:245) | The blocking mutation job has no runtime budget. The command runner with `coverageAnalysis: 'off'` runs the whole non-dist suite once per mutant. There is no incremental mode, no job `timeout-minutes`, and no mutant-count ceiling. | About 1,800 mutants (the ADR-35 figure) × an estimated 10–20 s per `vitest run` (supertest apps on both majors) ÷ 4 concurrency gives about 1.25–2.5 h per PR. A timed-out mutant counts as killed, so runs that end on `timeoutMS: 60000` inflate the score. GitHub's 6 h default could be reached as the suite grows, and then the required job is cancelled and G-CI is red with no signal. Fix: add `incremental: true` (cache the `reports/stryker-incremental.json` file), set `timeout-minutes` on the job, and have ST-001 t5 assert both. Also record a measured per-run time as S-07 exit evidence. | architecture.md ADR-35 ("about 1,800 mutants"; `coverageAnalysis: 'off'`; `timeoutMS: 60000`); ST-001:245 (asserts only the job exists and is blocking) |
| T3 | LOW | prd.md AC-047 vs ADR-38 / C2 port | AC-047's Then-clause names methods ("parse and toJsonSchema") that do not exist on the planned port (`isSchema`, `validate`, `toJSONSchema`). | At G2/QA, the spec-compliance reviewer checks AC-047 literally, finds no `parse`/`toJsonSchema` on `SchemaAdapter`, and raises a false finding. Or a builder adds `parse` aliases to satisfy the text. The ST-004 t7 and ST-007 t3 spies watch `validate`/`toJSONSchema`, so the tests prove the intent but not the words. Fix: amend AC-047 to "`validate` and `toJSONSchema`" (flag at G2 with the ADR-47 PRD amendment). | prd.md:65; ST-002:129-130, ST-003:60 (port signature) |
| T4 | LOW | ADR-33; ST-004 t6(b) | Case (b) asserts "the client socket closes within 1 s", but the plan does not say which error middleware the fixture installs. Only Express's final handler destroys the socket once headers are sent. | The fixture registers a 4-arity spy (used to count calls in (a)) that records the error and does not call `next(err)`. In (b) the correct `wrapAsync` calls `next(err)` once, the spy swallows it, and the socket never closes. The 1 s assertion goes red for a correct implementation, and the builder is pushed to call `res.destroy()`, which ADR-33 rejects. Fix: in (b) the spy must call `next(err)`, or (b) must run with no custom error middleware. | ST-004:174; ADR-33 rejected alternatives ("Calling `res.end()` ourselves") |
| T5 | LOW | ADR-34; `test/fixtures/fresh-express.ts` (ST-001:173) | `freshExpress` clears cache "under its private dependency roots (`router`, `path-to-regexp`)". Express 4 has no `router` dependency, and the plan does not say that a missing dependency root must be skipped. | `freshExpress('express4')` calls `createRequire(...).resolve('router/package.json')` from the express4 root. That throws `MODULE_NOT_FOUND` or, if hoisted, resolves to v5's `router@2`, whose cache is cleared and not restored as intended. ST-005 t7 then errors in `beforeEach`, or later v5 tests see a re-required `router` without `RECORDER` and emit unexpected `EAD_RECORDER_NOT_INSTALLED` warns. Fix: resolve dependency roots only from the alias's own `dependencies`, skip missing ones, and never clear roots outside `<alias>/node_modules`. | architecture.md ADR-34; ST-001:173; ST-005:217 |

## Part C — AC-by-AC red-first check (47 ACs)

"Proves" means that a planned test asserts the AC's Then-clause and goes red if the behaviour is removed.

| AC | Planned red-first test | Proves? |
|---|---|---|
| 001 | ST-001 manifest (name, MIT, LICENSE, old-name walk built at runtime); ST-007 parity | Yes |
| 002 | ST-001 build/pack/build-shape | Yes |
| 003 | ST-007 `parity.test.ts` (exact name set, ESM and CJS, ADR-41) + dual-load | Yes |
| 004 | ST-001 manifest (peers incl. zod `^4.2.0`, optional meta, `./zod`, `./package.json`), pack (no zod in dist); ST-003 t9 standard-floor on `peer-floor`; ST-007 no-zod-load | Yes |
| 005 | ST-003 contract + ST-004 t7 (400 via stub) + ST-006 stub-in-spec + ST-007 t3 wiring | Yes (N7 closed) |
| 006 | ST-004 `typed.test-d.ts`; ST-003 Infer | Yes, but see T1 for the v4 cells |
| 007–009 | ST-004 request-validation | Yes |
| 010 | ST-004 global hook | Yes |
| 011 | ST-004 t10 problem schema + ST-006 auto-400 | Yes |
| 012–014 | ST-004 t3 + t4 send-delegation | Yes |
| 015 | ST-006 build (openapi-parser) | Yes |
| 016 | ST-006 typed `/users/:id` + ST-003 conversion | Yes |
| 017 | ST-006 build | Yes |
| 018–019 | ST-007 renderers | Yes |
| 020 | ST-001 pack (no UI assets) | Yes |
| 021 | ST-004 t9 incremental | Yes |
| 022 | ST-005 describe + ST-006 dedupe + ADR-44 meta-tag | Yes |
| 023 | ST-005 walk half + ST-006 `ac023.test.ts` (whole Then-clause, per major) | Yes (N1 closed) |
| 024 | ST-004 t5 + t6 (ADR-33) | Yes; T4 fixture caveat |
| 025 | Gate: `npm test` 90×4 | Yes (gate) |
| 026 | Gates: lint, `tsc --noEmit` | Yes (gate) |
| 027 | ST-001 t5 workflows (typecheck step not gated) + Delivery CI run | Partial: T1 (v4 mechanism unasserted); CI-run evidence owed |
| 028 | ST-001 t5 release.yml | Yes |
| 029 | ST-008 README/CHANGELOG/example/defaults-table parity | Yes |
| 030 | ST-005 walk + ST-006 glob | Yes |
| 031 | ST-005 `findByHandle` + ST-006 dedupe | Yes |
| 032 | ST-005 + ST-006 cache (both majors) | Yes |
| 033 | ST-005 + ST-006 self-exclude | Yes |
| 034 | ST-005 per-major skipIf + ST-006 canonical byte identity | Yes |
| 035 | ST-007 zero-option app per major (Zod through the Standard adapter; zod ≥4.2 per ADR-47) | Yes |
| 036 | ST-002 (`schemaAdapter === null`) + ST-007 resolved-config equality | Yes |
| 037 | ST-007 custom paths/UI | Yes |
| 038–042 | ST-002 + ST-006 build | Yes |
| 043 | ST-002 A-9 + ST-007 four cases | Yes |
| 044 | ST-002 (a, b) + ST-004 (c, d) | Yes |
| 045 | ST-002 + ST-007 (throws before mount) | Yes |
| 046 | ST-002 `options.test-d.ts` | Yes; T1 applies in the v4 cells |
| 047 | ST-002 option row + ST-004 t7 (per-route overrides global, spy counts) + ST-006 per-route adapter + ST-007 t3 wiring | Yes in behaviour; T3 wording mismatch |

Totals: 46 of 47 ACs are proven by a red-first test. 1 is partial (AC-027: T1, plus the CI-run evidence still owed). No AC is without a test.

<!-- Severity: CRITICAL blocks G2 until resolved; HIGH needs resolution or explicit waiver;
     MEDIUM/LOW advisory. -->

## Resolution log

| # | Resolution (revised artifact / waived by / rationale) |
|---|---|
| 1–7, 9 | Resolved (see Part A) |
| 8 | Plan resolved; Delivery CI-run evidence pending |
| N1 | Resolved by ADR-32, ST-006 |
| N2 | Resolved by ADR-33, ST-004 (residual T4) |
| N3 | Resolved by ADR-34, ST-001/ST-005 (residual T5) |
| N4 | Resolved by ADR-35, ST-001 (follow-on T2) |
| N5 | Intent resolved by ADR-36; mechanism open as T1 |
| N6 | Resolved by ADR-37, ST-004 |
| N7 | Resolved by ADR-38, ST-002/03/04/06/07 |
| N8 | Resolved by ADR-39, ST-001 |
| T1–T5 | Open |
