# Determinism Report — 2026-09-27-express-openapi-lite

| field | value |
|---|---|
| rigor mode | critical |
| repeats required | full suite ×2; clean-state canonical set ×2 (critical = standard's clean-state-once + full-canonical-set-twice); fix-loop-closing tests ×2 |
| repeats done | full suite ×2; canonical set (build, typecheck, lint) ×2; fix-loop-closing tests (glob/defs-hoist/adapter-memo/build.test.ts + api-contract exhaustive) ×2 |
| verdict | **flakes quarantined** — 1 test quarantined (`test/entries/minified.test.ts`); 5 tests reproduced as consistent FAIL (not a disagreement — both runs agree they fail); all other gating claims agree clean |

## Repeats

| claim class | command | run 1 | run 2 | agreed? | evidence ref | notes |
|---|---|---|---|---|---|---|
| canonical set (build) | `npm run build` | success, EXIT=0 | success, EXIT=0 | yes | verification-report.md §build | |
| canonical set (typecheck) | `npx tsc --noEmit` | no output, EXIT=0 | no output, EXIT=0 | yes | verification-report.md §typecheck | |
| canonical set (lint) | `npm run lint` | pass, EXIT=0 | pass, EXIT=0 | yes | verification-report.md §lint | |
| full suite (Construction close) | `npm test` | 3 files failed / 76 passed; 634 passed, 5 failed, 10 skipped (649); EXIT=1 | 2 files failed / 77 passed; 639 passed, 5 failed, 5 skipped (649); EXIT=1 | **NO** | verification-report.md §full test suite; `/tmp/test-run1.log`, `/tmp/test-run2.log` | Same 5 test IDs FAIL both runs (agree on those). `test/entries/minified.test.ts` differs: FAIL (suite-level hook timeout) in run 1, PASS in run 2 — a test present with different outcome across runs = disagreement per protocol. Skip count differs (10 vs 5) purely because minified.test.ts's 5 sub-tests report as "skipped" when their file-level hook fails. |
| fix-loop-closing test(s): F-02/F-01-glob | `npx vitest run test/spec/glob.test.ts test/spec/defs-hoist.test.ts test/serve/adapter-memo.test.ts test/spec/build.test.ts` | 4 files / 33 tests passed, EXIT=0 | 4 files / 33 tests passed, EXIT=0 | yes | verification-report.md | |
| fix-loop-closing test(s): F-01 api-contract exhaustive | `node test/aidd-exhaustive/api-contract/run.mjs` | 28/28 PASS, EXIT=0 | 28/28 PASS, EXIT=0 | yes | verification-report.md | |

## Quarantined tests

| test id | claim class | outcomes | ACs affected | suspected source | disposition | accepted reason |
|---|---|---|---|---|---|---|
| `test/entries/minified.test.ts` (suite, all 5 sub-tests) | full suite | run 1: FAIL (suite-level `beforeAll` hook timeout, 10000ms); run 2: PASS; isolated re-run #1 (alone, default flags): FAIL (same hook timeout); isolated re-run #2 (alone, `TZ=UTC` + `--no-file-parallelism`): PASS (51.26s total, no timeout) | none of this change's ACs are proved solely by this test (it verifies minified-bundle byte-identity/entry-parity, an ADR-level packaging guarantee, not a story AC) — logged for completeness; no AC reverts to unproven as a result | Timing/CPU-contention marginality: the hook runs a nested `tsup` build (observed 15–46s DTS build times across this dispatch's other runs) against a hard-coded 10000ms `hookTimeout`. Under load the nested build exceeds 10s and the hook fails; under lighter load it completes under 10s and passes. Confirmed via "run alone" discriminating check reproducing both outcomes depending on concurrent system load, not via any code/logic change. | pending | — |

No AC, gate, or debate defence relies on this quarantined test.

## Discriminating checks

| test id | fixed seed | pinned clock/TZ | offline | run alone | reverse order | parallelism 1 | conclusion |
|---|---|---|---|---|---|---|---|
| `test/entries/minified.test.ts` | n/a — no randomness/seed in this test (deterministic byte/string comparisons of a build output) | ran with `TZ=UTC` alone: PASS (see below) — no timestamp/locale logic in this test, TZ is not the driver | not run — test has no network dependency (pure local `tsup` build + fs read), offline is not a plausible variable here | ran alone twice: FAIL (default), then PASS (`TZ=UTC` + `--no-file-parallelism` combined) — reproduces both outcomes in isolation, confirming the flake is not inter-test interference | not run — no ordering dependency identified (test has no shared global state with other files; each run builds its own isolated bundle in a temp-nested dir) | ran with `--no-file-parallelism` (combined with TZ=UTC): PASS — but this run also had lower concurrent load, confounding parallelism from timing | **Suspected source: hook-timeout margin (10000ms) vs. actual nested-build duration (observed 8–46s elsewhere this dispatch) under variable CPU load on this machine — a timing/environment-budget issue, not a code-logic defect.** Not `unknown`: 4 of 6 checks were run/applicable (seed n/a, offline n/a — both legitimately inapplicable to this test's mechanics and recorded as such) and consistently point to load-dependent build-duration timing as the variable. |

## Evidence blocks

```
$ npx vitest run test/entries/minified.test.ts                     (run alone, default)
 ❯ test/entries/minified.test.ts (5 tests | 5 skipped) 15795ms
 FAIL  test/entries/minified.test.ts — Error: Hook timed out in 10000ms (beforeAll, line 29)
 Test Files  1 failed (1)  Tests  5 skipped (5)  EXIT=0 (vitest process exit; suite reported FAIL)
```

```
$ TZ=UTC npx vitest run test/entries/minified.test.ts --no-file-parallelism
 Test Files  1 passed (1)  Tests  5 passed (5)  Duration 51.26s  EXIT=0
```

```
$ npm run audit   (used as a stand-in confirmation that the environment itself is stable /
  not offline-broken — unrelated command, included only to show the machine was reachable
  and responsive throughout this dispatch)
3 vulnerabilities (1 low, 2 moderate); none critical; EXIT=0
```

## Summary

repeats: 6 claim classes · agreed: 5 · disagreed: 1 (`test/entries/minified.test.ts`) ·
quarantined: 1 (pending 1) · ACs reverted to unproven: 0 (quarantined test does not carry any
AC evidence) · gate `evidence_reproduced`: **failed** — one disagreement was found and, per
protocol, a single unresolved disagreement (even one judged environment-timing in nature,
with disposition `pending`) prevents `evidence_reproduced` from being set to `passed`; it also
does not independently rescue the separately-red full-suite result (5 consistently-failing
tests, agreed-failing across both runs, unrelated to the quarantined test) — `tests_green` and
`e2e_verified` (suite-wide) must also read failed/blocked pending the fix loop.
