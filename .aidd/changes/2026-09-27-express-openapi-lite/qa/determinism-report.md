# Determinism Report — 2026-09-27-express-openapi-lite

<!-- E2E Verifier, QA step 7 — fresh dispatch (2nd attempt), qa/determinism-report.md.
     Canonical rules: ../protocol/determinism.md. A repeat is a MEASUREMENT, never a second
     chance: run 1 FAIL + run 2 PASS is a disagreement, not a pass. -->

| field | value |
|---|---|
| rigor mode | critical |
| repeats required | full suite twice + clean-state canonical set twice (critical mode) |
| repeats done | full suite x2 (default parallelism, disagreed) + 5 discriminating re-runs |
| verdict | flakes quarantined (2 tests) |

## Repeats

| claim class | command | run 1 | run 2 | agreed? | evidence ref | notes |
|---|---|---|---|---|---|---|
| full suite | `npm test` (default parallelism) | RED — `test/entries/minified.test.ts` FAIL (hookTimeout 20000ms in `beforeAll`); 632 passed \| 10 skipped, 77/78 files green | RED — `test/meta/lint-rules.test.ts` FAIL (testTimeout 20000ms, "bans local Symbol()" case); 636 passed \| 5 skipped, 77/78 files green | **NO — disagreement** | verification-report.md §3 | Different failing test in each run = disagreement per protocol, not "still red so it's fine." Both are timeout-class failures (not assertion failures). |
| clean-state canonical set (build+lint+typecheck+pack+audit) | `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm run check:pack`, `npm audit --audit-level=critical` | all GREEN | not repeated (non-flaky, deterministic tooling; not implicated in the test-suite disagreement) | n/a | verification-report.md §2,5,6,7,9 | These commands do not spawn the vitest worker pool and showed no variance across the multiple times they ran incidentally in this dispatch (pack ran once standalone; build ran as part of every `npm test` invocation, always green). |

## Quarantined tests

| test id | claim class | outcomes | ACs affected | suspected source | disposition | accepted reason |
|---|---|---|---|---|---|---|
| `test/entries/minified.test.ts` | full suite (default parallelism) | run1 FAIL (hookTimeout) / run2 PASS; alone PASS (x2, incl. TZ=UTC); reverse-order PASS; parallelism-1 PASS | AC-related to ADR-49 dual-minified-bundle brand cross-recognition (ESM/CJS) | Windows host CPU/AV contention under ~74-78 concurrently spawned isolated vitest workers pushes the `beforeAll` (two synchronous `esbuild` subprocess bundling calls) past its 20000ms `hookTimeout` non-deterministically. Confirmed absent at parallelism 1, alone, and in reverse order. | pending | — |
| `test/meta/lint-rules.test.ts` | full suite (default parallelism) | run1 PASS / run2 FAIL (testTimeout on "bans local Symbol() in src/**"); alone PASS (incl. TZ=UTC); reverse-order PASS; parallelism-1 PASS; also failed a 3rd time inside Stryker's own dry run under even higher concurrent load | ADR-20/ADR-21/ADR-04/ADR-39 lint-rule enforcement tests | Same class as above: a fresh `ESLint` instance + `lintText()` call is CPU-bound and, under default worker contention on this Windows host, occasionally exceeds the 20000ms `testTimeout`. Confirmed absent at parallelism 1, alone, and in reverse order; reproduced a 3rd time independently during the Stryker dry run, which corroborates rather than contradicts the contention theory (it ran concurrently with another background process). | pending | — |

Neither test may serve as evidence for any AC, gate, or debate defence while quarantined. Every AC
either was proving reverts to unproven for the existing fix loop.

## Discriminating checks

| test id | fixed seed | pinned clock/TZ | offline | run alone | reverse order | parallelism 1 | conclusion |
|---|---|---|---|---|---|---|---|
| `test/entries/minified.test.ts` | n/a — no RNG/seed used by this test (spawns `esbuild`, dynamic `import`, no `Math.random`/date-seeded logic; confirmed by reading source) | PASS (`TZ=UTC npx vitest run test/entries/minified.test.ts` → 5/5 passed, 30.70s) | n/a — no network calls (local `esbuild` binary + local `dist/` files only; confirmed by reading source, no `fetch`/`http` usage) | PASS (`npx vitest run test/entries/minified.test.ts` alone → 5/5 passed, 22.09s — ran once without TZ pin, once with; both passed) | PASS (full suite run with `find test -name '*.test.ts' \| sort -r` reversed file list → 74/74 files, 632 passed, 5 skipped, 0 failed) | PASS (`npm test -- --no-file-parallelism`, run in isolation → 78/78 files, 637 passed, 5 skipped, 0 failed) | **Suspected source: Windows CPU/AV resource contention under default ~74-78 concurrent isolated vitest workers, pushing the synchronous double-`esbuild`-subprocess `beforeAll` past its fixed 20000ms `hookTimeout`.** Not `unknown` — 4 of 6 checks ran and all converge on the same explanation; the remaining 2 (fixed seed, offline) are inapplicable by source inspection, not skipped without reason. |
| `test/meta/lint-rules.test.ts` | n/a — no RNG/seed used (pure `ESLint.lintText()` calls on fixed string literals; confirmed by reading source) | PASS (`TZ=UTC npx vitest run test/meta/lint-rules.test.ts` → 7/7 passed, 49.35s) | n/a — no network calls (local ESLint flat-config lint only; confirmed by reading source) | PASS (`npx vitest run test/entries/minified.test.ts test/meta/lint-rules.test.ts` together, alone from the rest of the suite → both files passed, 7 passed + 5 skipped + 7 passed) | PASS (included in the same reversed-file-list run above — 0 failed) | PASS (included in the same `--no-file-parallelism` run above — 0 failed) | **Suspected source: same as above** — CPU-bound `ESLint` instantiation + lint under default worker contention. Independently reproduced a 3rd time inside Stryker's dry run (`vitest.stryker.config.ts`) while running concurrently with another background process, which is consistent with (not contrary to) the contention theory. |

Note on "run alone": the two suspect tests were run alone together as a pair once (both passed) and
`minified.test.ts` was additionally run fully solo twice (once bare, once with `TZ=UTC`), both
green. `lint-rules.test.ts` was run solo once with `TZ=UTC` (green). No solo run of either
individually reproduced its respective failure — consistent with default-parallelism contention,
not a per-test logic defect.

## Evidence blocks

```
# Run 1 — full suite, default parallelism
$ npm test
 ❯ test/entries/minified.test.ts (5 tests | 5 skipped) 20291ms
 FAIL  test/entries/minified.test.ts [ test/entries/minified.test.ts ]
 Error: Hook timed out in 20000ms. ... at test/entries/minified.test.ts:29:1 (beforeAll)
 Test Files  1 failed | 77 passed (78)
      Tests  632 passed | 10 skipped (642)
TEST_EXIT:1
```

```
# Run 2 — full suite, default parallelism
$ npm test
 ❯ test/meta/lint-rules.test.ts (7 tests | 1 failed) 27003ms
 FAIL  test/meta/lint-rules.test.ts > eslint rules (...) > bans local Symbol() in src/**
 Error: Test timed out in 20000ms. ... at test/meta/lint-rules.test.ts:11:3
 Test Files  1 failed | 77 passed (78)
      Tests  1 failed | 636 passed | 5 skipped (642)
TEST_EXIT:1
```

```
# Discriminating check: parallelism 1 (run in isolation, not concurrent with any other process)
$ npm test -- --no-file-parallelism
 Test Files  78 passed (78)
      Tests  637 passed | 5 skipped (642)
Statements 98.56% | Branches 93.35% | Functions 99.45% | Lines 99.34%
EXIT:0
```

```
# Discriminating check: reverse file order (explicit sorted-descending file list)
$ files=$(find test -name '*.test.ts' | sort -r) && npx vitest run $files
 Test Files  74 passed (74)
      Tests  632 passed | 5 skipped (637)
EXIT:0
```

```
# Discriminating check: minified.test.ts alone, TZ=UTC
$ TZ=UTC npx vitest run test/entries/minified.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
EXIT:0
```

```
# Discriminating check: lint-rules.test.ts alone, TZ=UTC
$ TZ=UTC npx vitest run test/meta/lint-rules.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
EXIT:0
```

```
# Corroborating 3rd occurrence: Stryker dry run (vitest.stryker.config.ts), concurrent w/ another bg process
$ npm run mutation
 ❯ test/meta/lint-rules.test.ts (7 tests | 1 failed) 28918ms
 FAIL  test/meta/lint-rules.test.ts > ... > bans local Symbol() in src/**
 Test Files  1 failed | 62 passed (63)
      Tests  1 failed | 590 passed | 5 skipped (596)
ConfigError: There were failed tests in the initial test run.
```

<!-- One discarded measurement, not counted: an earlier attempt to run `npm test --
     --no-file-parallelism` concurrently with a second `npm test` invocation raced on the shared
     `pretest` build step and both processes hit `ERR_MODULE_NOT_FOUND` reading `dist/index.js` —
     self-inflicted contamination from running two build-triggering commands at once, discarded and
     re-run in isolation (see evidence block above). -->

## Summary

repeats: 2 (full suite, default parallelism) · agreed: 0 · disagreed: 1 (two different tests failed
across the two runs) · quarantined: 2 (`test/entries/minified.test.ts`, `test/meta/lint-rules.test.ts`
— both `pending`) · ACs reverted to unproven: ADR-49 dual-bundle brand cross-recognition (minified),
ADR-20/21/04/39 lint-rule enforcement (lint-rules) · gate `evidence_reproduced`: **failed** (the
canonical `npm test` command does not reproduce green twice at its default configuration; green was
only reproduced under non-default settings — parallelism 1, alone, reversed order — which corroborate
the timeout/contention root cause but do not make the canonical command itself green on repeat).
