# Build Log

## Entry: Wave integration check red — 2 stale test assertions (test/dist/**)

**Trigger:** `npm test` reported 2 failed / 65 passed test files (362/369 tests) at wave
integration check, both failures confined to `test/dist/**` (owned by ST-001/S-01,
already built/committed/audited).

**Diagnosis:**

1. `test/dist/pack.test.ts` — `sideEffects matches the auto-record entries` asserted the
   old 2-element `pkg.sideEffects` array. ADR-55 (backflow, ratified) authorized a third
   element, `"src/introspect/auto-record.ts"`, to fix a real defect where esbuild's
   `sideEffects`-array elision stripped the recorder's install call from
   `dist/auto-record.{js,cjs}` during the build. `package.json` already carries the
   corrected 3-element array (confirmed via `grep`); only the test's expectation was
   stale.
2. `test/dist/build-shape.test.ts` — `does not inline the recorder install call` banned
   the literal substring `installRecorder(` anywhere in `dist/index.{js,cjs}`. Per
   ADR-40, the actual guarantee is that the *auto-install call site* (the bare
   `installRecorder(express, log)` invocation inside `src/introspect/auto-record.ts`,
   triggered by `autoRecord()`) stays exclusively in the external
   `dist/auto-record.{js,cjs}` entry. ST-007 legitimately exports `installRecorder` as a
   public composition-root function (ADR-41), so `dist/index.js`/`index.cjs` now contain
   its declaration (`function installRecorder(expressModule, log = noopLogger) {`) and a
   warn-message string mentioning it — both false positives under the old ban. Verified
   via `grep` that neither index file contains the actual invocation pattern
   `installRecorder(express, log)` or `autoRecord()` — only `dist/auto-record.js` (line
   119) and `dist/auto-record.cjs` do.

**Files touched:**
- `test/dist/pack.test.ts` — updated the `sideEffects` assertion to the ADR-55 3-element
  array (`./dist/auto-record.js`, `./dist/auto-record.cjs`,
  `src/introspect/auto-record.ts`).
- `test/dist/build-shape.test.ts` — replaced the blanket `installRecorder(` substring ban
  with two precise checks: absence of the invocation `installRecorder(express, log)` and
  absence of `autoRecord()` in `dist/index.js`/`dist/index.cjs`, matching ADR-40's actual
  intent (no accidental inlining of the auto-install call site, not a ban on the
  identifier's legitimate export/declaration).

No changes to `package.json`, `tsup.config.ts`, or any `src/**` file — those were already
correct.

**Evidence (green run):**

```
$ npm test
...
 Test Files  67 passed (67)
      Tests  364 passed | 5 skipped (369)
Type Errors  no errors
   Start at  12:16:55
   Duration  21.53s
```

0 failures, all 67 test files pass (364 passed, 5 skipped of 369 total).

## Entry: QA fix loop — 5 test-timeout reds (pack.test.ts + perf-smoke) from fresh E2E verifier dispatch

**Trigger:** `npm test` (`vitest run --coverage --typecheck`, default `vitest.config.ts`)
reproduced RED with 5 consistently-failing tests (per `qa/verification-report.md` and
`qa/determinism-report.md`, 2 determinism runs, same 5 both times), all via **test
timeout at 20000ms**, never a failed assertion:

1. `test/dist/pack.test.ts > pack contents > packs and resolves via require`
2. `test/aidd-exhaustive/performance-smoke/perf-smoke.perf.test.ts` — TC-PERF-001,
   TC-PERF-002, TC-PERF-003, TC-PERF-007

**Repro (evidence, RED):**

```
$ npm test -- --run test/dist/pack.test.ts test/aidd-exhaustive/performance-smoke/perf-smoke.perf.test.ts
 ❯ test/aidd-exhaustive/performance-smoke/perf-smoke.perf.test.ts (7 tests | 4 failed) 94767ms
   × p95 < 200ms with 500 routes mounted, cache warm 20106ms
   × p95 < 200ms with 1000 routes mounted, cache warm 20007ms
   × heap growth after 200 forced rebuilds stays within a generous bound (no gross leak) 20017ms
   × p95 < 200ms with 2000 routes mounted, cache warm — the same N where F-03 clocked 252ms cold 20456ms
Error: Test timed out in 20000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 Test Files  1 failed | 1 passed (2)
      Tests  4 failed | 9 passed (13)
```

**Diagnosis:**

1. `test/aidd-exhaustive/performance-smoke/perf-smoke.perf.test.ts` matches the default
   config's `include: ['test/**/*.test.ts']` and was NOT in its `exclude` list, so `npm
   test` runs it under `vitest.config.ts`'s `testTimeout: 20000`. A dedicated
   `vitest.perf-smoke.config.ts` already exists with `testTimeout: 120000` (exactly sized
   for these route-count/soak/heap tests) but is never invoked by `npm test` — there is no
   script wiring it in. This is precisely the config-wiring gap already flagged twice in
   story history (ST-004-typed-route.md ~L516-598, ST-006-spec-builder.md ~L495-539):
   "needs the perf-smoke suite added to [some project/vitest config]" / excluded like
   `test/perf/**`. Fix: add `test/aidd-exhaustive/performance-smoke/**` to
   `vitest.config.ts`'s `exclude` (mirroring the existing `test/perf/**` exclude for the
   sibling perf suite), so the default run skips it and it continues to run only under its
   own purpose-built config (`vitest run --config vitest.perf-smoke.config.ts`, verified
   green below). No assertion, budget, or test logic touched.
2. `test/dist/pack.test.ts > packs and resolves via require` genuinely does slow
   subprocess I/O (`npm pack --json` + tarball extraction + `tar`), which is CPU/IO-load
   dependent and can exceed 20000ms under a busy worker pool (matches ST-001-scaffold.md's
   AC-002/AC-020 note that this test must not have its assertions weakened). Fix: give
   just this one `it()` a longer per-test timeout (`60000` as trailing arg), leaving the
   global `testTimeout` (which every other, fast, test in this file/suite relies on)
   untouched. Assertions unchanged.
3. Also found while in `vitest.config.ts` (mentioned per dispatch note, not chased beyond
   a one-line bump): `test/entries/minified.test.ts`'s `beforeAll` (runs a nested tsup
   build) was timing out against Vitest's separate default `hookTimeout` (10000ms), tighter
   than the file's own `testTimeout: 20000`. Bumped `hookTimeout: 20000` to match
   `testTimeout` — a one-line, symmetrical config change. This is the pre-existing
   quarantined determinism-disagreement test (`disposition: pending` in
   `state.yaml`'s `determinism.quarantined`); its own logic/build was not touched, and per
   the dispatch instruction this one-line bump does not fully de-flake it under heavy
   parallel worker load (it still timed out once in the full-suite run below) — left as-is
   for the separate quarantine decision, not chased further.

**Files touched:**
- `vitest.config.ts` — added `test/aidd-exhaustive/performance-smoke/**` to `exclude`
  (routes those tests to their existing dedicated `vitest.perf-smoke.config.ts` instead of
  the default 20000ms timeout); added `hookTimeout: 20000` (matches existing
  `testTimeout: 20000`, one-line, addresses the `minified.test.ts` `beforeAll` note above).
- `test/dist/pack.test.ts` — added a per-test `60000` timeout to the `'packs and resolves
  via require'` case only (trailing arg to `it(...)`); no assertion changed.

**Evidence (previously-failing tests green):**

```
$ npx vitest run --typecheck test/dist/pack.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
Type Errors  no errors

$ npx vitest run test/aidd-exhaustive/performance-smoke/perf-smoke.perf.test.ts
No test files found, exiting with code 1
  (confirms the file is now excluded from the default config, as intended)

$ npx vitest run --config vitest.perf-smoke.config.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  170.56s (tests 99%)
```

**Evidence (full suite re-run):**

```
$ npm test
 ❯ test/entries/minified.test.ts (5 tests | 5 skipped) 25658ms
FAIL  test/entries/minified.test.ts [ test/entries/minified.test.ts ]
Error: Hook timed out in 20000ms.
 Test Files  1 failed | 77 passed (78)
      Tests  632 passed | 10 skipped (642)
Type Errors  no errors
   Duration  122.86s
```

All 5 target reds (pack.test.ts + the 4 perf-smoke tests) are green and none of them
appear in the failed-suite output. The one remaining failure is
`test/entries/minified.test.ts`'s `beforeAll` hook — the pre-existing quarantined
determinism-disagreement test explicitly out of scope for this dispatch (tracked
separately via `disposition: pending`), reproducing the same variable-CPU-load flake
already on record, not a new regression and not one of the 5 assigned targets. No other
test file regressed.

## Entry: QA fix loop iteration 2 — worker concurrency (minified.test.ts / lint-rules.test.ts non-determinism)

**Trigger:** E2E Verifier's `qa/determinism-report.md` (fresh dispatch, critical rigor)
found the canonical `npm test` command disagreed across two consecutive default-parallelism
runs: run 1 failed `test/entries/minified.test.ts` (`beforeAll` hookTimeout, 20000ms),
run 2 failed `test/meta/lint-rules.test.ts` (`testTimeout`, 20000ms, `bans local Symbol()`
case). Both tests passed reliably alone, in reverse file order, and under
`--no-file-parallelism`. This is the second recurrence of this failure class in this QA
cycle (first was `pack.test.ts` + 4 perf-smoke tests, fix loop iteration 1, see entry
"Wave integration check red" above / "5 test-timeout reds" — that fix bumped the global
`hookTimeout` 10000ms → 20000ms and excluded perf-smoke from the default run).

**Root cause:** confirmed via reproduction — a plain `npm test` run reports
`Isolate  75 workers spawned` (one worker per test file, vitest's default `isolate: true`
behavior; 78 test files total). Two of those files spawn their own CPU-heavy subprocess
work inside a single hook/test (`minified.test.ts`'s `beforeAll` runs esbuild bundling
twice synchronously; `lint-rules.test.ts` instantiates ESLint and calls `lintText`
repeatedly). With up to ~75 vitest worker processes racing for this Windows host's 8
logical CPUs, these two CPU-bound tests occasionally get starved past their fixed
20000ms timeout — not an assertion failure, not a logic regression. Bumping the timeout
again (the iteration-1 pattern) would only narrow the window, not remove the contention,
and this is now a repeating pattern rather than an isolated one-off, so a general fix was
preferred per the dispatch's guidance.

**Fix:** added `maxWorkers: 4` to `vitest.config.ts`'s `test` block (bounding vitest's
concurrent worker pool to half of the host's 8 logical CPUs), with a comment explaining
why. This leaves headroom for the CPU-bound subprocess work these two tests do, without
touching any test file, timeout value, or assertion. It generalizes to any future
CPU-bound test, not just these two.

**Self-caught regression during verification:** the first draft of the explanatory
comment quoted the change's slug `2026-09-27-express-openapi-lite` verbatim inside
`vitest.config.ts`, which contains the substring `express-openapi-lite` (the project's
pre-rename old package name, banned repo-wide by
`test/dist/manifest.test.ts`'s "contains the old package name in no file outside .aidd/"
case). Caught by running the full suite once before declaring done; reworded the comment
to reference the report path pattern instead of the literal slug, then reverified.

**Verification (evidence):**

```
# Reproduce, default settings, no fix yet (baseline)
$ npm test
 Test Files  78 passed (78)
      Tests  637 passed | 5 skipped (642)
    Isolate  75 workers spawned · ~992ms startup each (spawn + environment, per file)
EXIT:0   # ran green this time — consistent with a flake, not a deterministic failure
```

```
# Two target tests, direct run, after adding maxWorkers: 4
$ npx vitest run test/entries/minified.test.ts test/meta/lint-rules.test.ts
 Test Files  2 passed (2)
      Tests  12 passed (12)
EXIT:0
```

```
# First full-suite run after the fix caught a self-inflicted regression
# (own comment text matched the old-name-ban scanner) — test/dist/manifest.test.ts failed:
 Test Files  1 failed | 77 passed (78)
      Tests  1 failed | 636 passed | 5 skipped (642)
# fixed by rewording the vitest.config.ts comment (no code/behavior change)
```

```
# manifest.test.ts alone, after reword — confirms the self-inflicted issue is resolved
$ npx vitest run test/dist/manifest.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
EXIT:0
```

```
# Full suite, default settings, run 1/2 (post-fix, canonical `npm test`)
$ npm test
 Test Files  78 passed (78)
      Tests  637 passed | 5 skipped (642)
Statements 98.56% | Branches 93.35% | Functions 99.45% | Lines 99.34%
EXIT:0
```

```
# Full suite, default settings, run 2/2 (post-fix, canonical `npm test`, consecutive)
$ npm test
 Test Files  78 passed (78)
      Tests  637 passed | 5 skipped (642)
Statements 98.56% | Branches 93.35% | Functions 99.45% | Lines 99.34%
EXIT:0
```

**Files touched:**
- `vitest.config.ts` — added `maxWorkers: 4` + explanatory comment. No test file,
  timeout value, or assertion changed.

**Tradeoff noted:** full-suite wall-clock time increased (~98s baseline → ~120-125s with
`maxWorkers: 4`) because fewer files run concurrently. Considered acceptable: correctness
and determinism of the canonical `npm test` command take priority over suite speed, and
the increase is modest (roughly +25-30%).

**Confidence:** high but not absolute. Both runs of the canonical `npm test` command
were green twice in a row post-fix (in addition to the two target tests passing directly),
and the fix addresses the measured root cause (worker-pool oversubscription on an 8-core
host) rather than papering over a symptom with a timeout bump — which is why this is
judged more durable than the iteration-1 per-test-timeout pattern. However, two green
runs is a much smaller sample than the dozens of runs it would take to fully rule out a
rare residual flake under worse host contention (e.g., if another heavy process is
running concurrently, as happened with the Stryker corroboration in the determinism
report). If a third recurrence of this class occurs, the next lever to pull is reducing
`maxWorkers` further (e.g., to 2) or moving the two CPU-bound tests to run in a
dedicated low-concurrency project/config, not another timeout bump.
