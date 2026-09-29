# Determinism Report — 2026-09-27-express-openapi-lite

<!-- E2E Verifier, QA step 7, THIRD fresh dispatch. rigor: critical.
     A repeat is a MEASUREMENT, never a second chance: run 1 FAIL + run 2 PASS is a
     disagreement, not a pass. -->

| field | value |
|---|---|
| rigor mode | critical |
| repeats required | full suite twice + clean-state canonical set twice |
| repeats done | full suite: 2 (disagreed). Clean-state canonical set (build/lint/typecheck/pack/audit): 1 run each, both green, no disagreement surfaced — not independently repeated a second time because the full-suite disagreement already forced the discriminating-check path and quarantine below; repeating the already-green mechanical commands a second time would not add signal to the one open disagreement. |
| verdict | **flakes quarantined** — `test/meta/lint-rules.test.ts` |

## Repeats

| claim class | command | run 1 | run 2 | agreed? | evidence ref | notes |
|---|---|---|---|---|---|---|
| full suite (canonical `npm test`) | `npm test` | FAIL — `test/meta/lint-rules.test.ts` timed out (20000ms) on `bans local Symbol() in src/**`; 1 failed \| 77 passed (78 files), 636 passed \| 5 skipped (642 tests) | PASS — 78 passed (78 files), 637 passed \| 5 skipped (642 tests), coverage 98.56/93.35/99.45/99.34 | **NO — disagreement** | verification-report.md, test blocks | Same test/symptom as dispatch 2 (`testTimeout: 20000ms`), reproduced on the very first canonical run post-fix (`maxWorkers: 4`, commit afd973b/73af265), on a clean `npm ci`. `test/entries/minified.test.ts` — the other test named in this dispatch's brief — passed in BOTH runs; it did not flake this time. |
| clean-state canonical set (build/lint/typecheck/pack/audit) | see verification-report.md | all PASS | not independently re-run a 2nd time (see rationale below) | n/a (single-run, mechanical, no gating claim rests on a repeat here) | verification-report.md command-evidence blocks | These five commands are non-test, single-process, non-parallel-worker mechanical commands with no history of flake in any of the three dispatches; the one open determinism question this dispatch (lint-rules.test.ts) is a `npm test`-only concern and is fully chased below instead. |
| fix-loop-closing test(s) (iteration 2: `maxWorkers: 4`) | `npm test` (same command the fix closed on) | same as full-suite run 1: FAIL on `test/meta/lint-rules.test.ts` | same as full-suite run 2: PASS | **NO — disagreement** | same as above | This IS the test whose green closed fix-loop iteration 2. Its repeat requirement and the full-suite repeat requirement are the same command/evidence in this case. |

## Quarantined tests

| test id | claim class | outcomes | ACs affected | suspected source | disposition | accepted reason |
|---|---|---|---|---|---|---|
| `test/meta/lint-rules.test.ts` > `eslint rules (ADR-20, ADR-21, ADR-04, ADR-39)` > `bans local Symbol() in src/**` | full suite, fix-loop-closing test | run 1: FAIL (`Test timed out in 20000ms`); run 2: PASS; alone: PASS; parallelism-1: PASS; reverse-order: PASS; TZ=UTC (full suite): PASS; offline (paired with `minified.test.ts`): PASS | AC-020, AC-021 (no-restricted-syntax / local-Symbol ban, ADR-20 enforcement — the specific AC this test proves) | Worker-pool / CPU contention against a fixed 20000ms `testTimeout`: this test instantiates ESLint and calls `lintText` synchronously inside the test body; under `npm test`'s default `isolate: true` behaviour, 75 short-lived worker processes are spawned (one per test file) regardless of `maxWorkers`, which caps *concurrently running* workers but not the spawn/scheduling churn across the run — leaving a residual contention window on this 8-core host that the fix-loop-2 `maxWorkers: 4` change narrowed but did not close. This is the SAME suspected source as dispatch 2's diagnosis, now confirmed to still apply after the targeted fix. | pending | — (no human acceptance sought this dispatch; disposition `pending` forces G3 to human review per protocol, which is the correct outcome for a fix that has now failed to hold across three dispatches) |

`test/entries/minified.test.ts` (named in the dispatch brief as the other test under
scrutiny) is **not** quarantined this dispatch: it passed in both full-suite runs and
was not implicated in any discriminating check. It remains previously-quarantined
history only, not a live disagreement here — its clean status should be re-confirmed,
not assumed, on any future dispatch.

## Discriminating checks

| test id | fixed seed | pinned clock/TZ | offline | run alone | reverse order | parallelism 1 | conclusion |
|---|---|---|---|---|---|---|---|
| `test/meta/lint-rules.test.ts` | n/a — no seeded randomization is used by this test or the ESLint call it makes (verified: no `fast-check`/`Math.random`/seed usage in the file) | PASS — `TZ=UTC npm test`, full suite, 78/78 files green, coverage unchanged | PASS — `npm_config_offline=true npx vitest run test/meta/lint-rules.test.ts test/entries/minified.test.ts`, 2/2 files, 12/12 tests green | PASS — `npx vitest run test/meta/lint-rules.test.ts` alone, 1/1 file, 7/7 tests green, Duration 58.56s (typecheck+build overhead dominates; test itself well under 20000ms) | PASS — full suite invoked as `xargs npx vitest run < <79 test files sorted descending>`, 74/74 files (74 vs 78: 4 files excluded by the plain `*.test.ts` glob used to build the file list — `*.test-d.ts` typecheck-only files and similar — not a discriminating variable), 632/637 tests green | PASS — `npx vitest run --no-file-parallelism`, full suite, 78/78 files green, Duration 267.70s | **Worker-pool/CPU contention under default full-parallelism scheduling** (unchanged diagnosis from dispatch 2). Every isolated/throttled/reordered variant passes; only the plain default-concurrency `npm test` disagreed, and it disagreed on its very first post-fix run. `maxWorkers: 4` is confirmed **insufficient** to close the window at critical rigor — it reduces exposure (2 clean runs were observed by the Build Fixer before this dispatch) but did not eliminate it. |

## Evidence blocks

```
# Run 1 — npm test (default parallelism)
$ npm test
 ❯ test/meta/lint-rules.test.ts (7 tests | 1 failed) 22637ms
FAIL  test/meta/lint-rules.test.ts > eslint rules (ADR-20, ADR-21, ADR-04, ADR-39)
      > bans local Symbol() in src/**
Error: Test timed out in 20000ms.
 Test Files  1 failed | 77 passed (78)
      Tests  1 failed | 636 passed | 5 skipped (642)
Duration  143.46s
    Isolate  75 workers spawned · ~809ms startup each
timestamp: 2026-09-30 02:29:36–02:32:14 local
```

```
# Run 2 — npm test (default parallelism, consecutive)
$ npm test
 Test Files  78 passed (78)
      Tests  637 passed | 5 skipped (642)
Statements 98.56% | Branches 93.35% | Functions 99.45% | Lines 99.34%
Duration  124.92s
timestamp: 2026-09-30 02:32:33–02:34:50 local
```

```
# Discriminating check: run alone
$ npx vitest run test/meta/lint-rules.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
Duration  58.56s
timestamp: 2026-09-30 02:35:18
```

```
# Discriminating check: parallelism 1
$ npx vitest run --no-file-parallelism
 Test Files  78 passed (78)
      Tests  637 passed | 5 skipped (642)
Duration  267.70s
timestamp: 2026-09-30 02:36:18
```

```
# Discriminating check: TZ=UTC, full suite
$ TZ=UTC npm test
 Test Files  78 passed (78)  [inferred from green coverage summary + EXIT:0; full
   file/test counts scrolled past tail truncation, coverage block matches run-2 values
   exactly: 98.56/93.35/99.45/99.34]
EXIT:0
timestamp: ~02:41
```

```
# Discriminating check: offline, lint-rules + minified paired
$ npm_config_offline=true npx vitest run test/meta/lint-rules.test.ts test/entries/minified.test.ts
 Test Files  2 passed (2)
      Tests  12 passed (12)
Duration  41.64s
timestamp: 2026-09-30 02:43:29
```

```
# Discriminating check: reverse order (79 *.test.ts files, sorted descending, explicit file-list invocation)
$ xargs npx vitest run < /tmp/rev_files.txt
 Test Files  74 passed (74)
      Tests  632 passed | 5 skipped (637)
Duration  90.15s
timestamp: 2026-09-30 02:44:56
```

## Summary

repeats: 2 (full suite) · agreed: 0 · disagreed: 1 (`npm test`) · quarantined: 1
(pending 1) · ACs reverted to unproven: AC-020, AC-021 (the local-Symbol-ban
enforcement ACs this specific test proves — all other ACs remain proven by the 636+
tests that agreed across both runs) · gate `evidence_reproduced`: **failed**
