# Verification Report — 2026-09-27-express-openapi-lite

<!-- E2E Verifier: clean-state re-run of EVERY canonical command. Trusts no prior claim. -->

Rigor: critical. Environment: win32, Git Bash, node v24.11.1, npm 11.4.2. Clean state:
`node_modules` deleted, `npm ci` re-run before any command below.

## Command evidence

### clean install

```
$ rm -rf node_modules && npm ci
added 608 packages, and audited 609 packages in 24s
3 vulnerabilities (1 low, 2 moderate)
EXIT=0
```

### build

```
$ npm run build   (tsup)
CJS/ESM/DTS build success (index, manual, zod, auto-record)
EXIT=0
```
Re-run (critical-mode canonical-set repeat #2): identical success, EXIT=0.

### typecheck

```
$ npx tsc --noEmit
(no output)
EXIT=0
```
Re-run (repeat #2): no output, EXIT=0.

### lint

```
$ npm run lint   (eslint . && prettier --check .)
Checking formatting...
All matched files use Prettier code style!
EXIT=0
```
Re-run (repeat #2): identical, EXIT=0.

### full test suite — RED (2 runs, see determinism-report.md for full matrix)

```
$ npm test   (vitest run --coverage --typecheck)
Run 1: Test Files 3 failed | 76 passed (79); Tests 5 failed | 634 passed | 10 skipped (649)
       Type Errors: no errors. EXIT=1.
Run 2: Test Files 2 failed | 77 passed (79); Tests 5 failed | 639 passed | 5 skipped (649)
       Type Errors: no errors. EXIT=1.
```

Consistently-failing tests (both runs, same outcome):
- `test/dist/pack.test.ts > pack contents > packs and resolves via require` — `Test timed out in 20000ms` (npm pack --json subprocess).
- `test/aidd-exhaustive/performance-smoke/perf-smoke.perf.test.ts` — TC-PERF-001, TC-PERF-002, TC-PERF-003, TC-PERF-007 all `Test timed out in 20000ms` (the harness's own p95/heap assertions never even execute; the *test function itself* exceeds vitest's 20s test timeout before reaching its assertions).

Disagreeing test (present as a full-suite FAILURE in run 1, PASS in run 2 — logged as a
determinism disagreement, discriminating checks run, see determinism-report.md):
- `test/entries/minified.test.ts` — `beforeAll` hook (nested tsup build) exceeds the 10000ms
  `hookTimeout` under load; run 1 FAIL (suite-level), run 2 PASS.

**Coverage summary: not produced.** `npm test`'s coverage report is suppressed by vitest
whenever any test fails (documented, pre-existing behavior — see
`qa/test-report.md` line 40: "coverage is deferred to a clean run in QA step 7 ... since
known failures currently prevent the coverage summary from printing"). Because this dispatch's
clean-state run still has 5 consistently-failing tests, the coverage summary is **still**
suppressed and could not be captured this dispatch. No `coverage/` directory was produced.
**This is a RED finding, not a green with a missing artifact**: the target/floor comparison
(target 90%, floor 80% per `.aidd/constitution.md` line 23) cannot be verified from this
dispatch's own evidence. The last trusted number is the prior fix-loop closure claim
(`qa/verdicts.md` line 86: "coverage 98.54/93.25/99.45/99.33") — but per role mandate this
verifier trusts no prior green claim, and that number cannot be reproduced here while the
suite is red.

### e2e / smoke

Per `architecture.md`: "e2e: n/a. The example smoke test (`examples/basic`, `GET /openapi.json`
→ 200) runs inside `npm test`." — `test/docs/example-smoke.test.ts` was in the passing set in
both run 1 and run 2 (not among the 5 consistently-failing tests). Evidence:
```
$ grep -c "example-smoke" /tmp/test-run1.log /tmp/test-run2.log
(file present, no FAIL entries for this file in either run's Failed Tests section)
```
Verdict: PASS (both runs).

### audit

```
$ npm run audit   (npm audit --audit-level=critical)
3 vulnerabilities (1 low, 2 moderate) — none critical
EXIT=0
```

### pack / check:pack

Not run standalone: `test/dist/pack.test.ts`'s own `npm pack --json` invocation is the
failing test above (20s timeout). Re-attempting `npm run check:pack` was not run separately
given the demonstrated timeout risk of `npm pack` on this machine under current load; the red
above is sufficient evidence this command is currently unreliable in this environment and is
reported rather than independently re-attempted a third way.

### fix-loop-closing tests (F-01/F-02/F-04/F-22) — GREEN, repeated

```
$ npx vitest run test/spec/glob.test.ts test/spec/defs-hoist.test.ts \
    test/serve/adapter-memo.test.ts test/spec/build.test.ts
Run 1: Test Files 4 passed (4); Tests 33 passed (33); Type Errors: no errors. EXIT=0.
Run 2: Test Files 4 passed (4); Tests 33 passed (33); Type Errors: no errors. EXIT=0.

$ node test/aidd-exhaustive/api-contract/run.mjs
Run 1: --- TALLY --- {"PASS":28}  EXIT=0.
Run 2: --- TALLY --- {"PASS":28}  EXIT=0.
```
Both repeats agree (identical pass counts, identical exit codes) — F-01/F-02/F-04/F-22
closure evidence reproduces cleanly.

### mutation testing — INCOMPLETE (infeasible within this dispatch's time budget)

```
$ npm run mutation   (stryker run, thresholds.break: 70, mutate: config/introspect/spec/route/registry/adapter)
Mutation testing 2% (elapsed: ~11m, remaining: ~8h+) 28/1202 tested (2 survived, 1 timed out)
```
A fresh full-width Stryker run against this dispatch's clean install extrapolates to
8–17+ hours at the observed rate (1202 mutants total, ~28 tested in 11 minutes) — infeasible
to complete inside this dispatch. The run was terminated rather than left to produce a
false impression of completion. **Mutation score is reported `na` for this dispatch** with
reason `infeasible: full run extrapolates to 8h+, session-bounded`. This is a genuine
degradation, not a substitute green: the last independently-verified numbers are the fix-loop
gate re-runs recorded in `qa/verdicts.md` (F-01/F-02 gate 86.96% / `build.ts` 82.46% /
`glob.ts` 100%; F-04 gates 86.51% / 86.54%; final F-01-widening gate 86.18% / `build.ts`
82.08% — all ≥ 70 floor), but none of those were reproduced by this verifier itself, and the
early partial sample from this dispatch's own run (2 survived / 1 timed out in the first 28
mutants tested) is too small (2.3% of 1202) to support any score claim either way.

## Verdicts

| Check | Result | Evidence ref |
|---|---|---|
| build | PASS (2/2 repeats) | `npm run build` blocks above |
| tests | **FAIL** (5 consistent failures both runs; 1 additional disagreement, see determinism report) | `npm test` run 1 / run 2 blocks above |
| lint | PASS (2/2 repeats) | `npm run lint` blocks above |
| typecheck | PASS (2/2 repeats) | `npx tsc --noEmit` blocks above |
| e2e (example smoke) | PASS (2/2 runs) | example-smoke.test.ts note above |
| coverage vs target | **NOT VERIFIED** — report suppressed by red suite; target 90 / floor 80 unconfirmed this dispatch | coverage block above |
| mutation vs floor | **NA (infeasible this dispatch)** — floor 70; prior fix-loop gate numbers (not reproduced here) all ≥70 | mutation block above |

## Overall verdict: RED

The suite is not clean-state green. 5 tests fail consistently across two runs (`pack.test.ts`
require-resolution test, and 4 performance-smoke tests) — all failing via **test-level or
hook-level timeouts**, not assertion failures; no assertion in any of the 5 was ever reached.
One further test (`minified.test.ts`) disagreed between runs (suite-level hook timeout in run
1, pass in run 2) and is quarantined per protocol (see `determinism-report.md`). Root cause
appears environment/CPU-contention related (nested `tsup`/`esbuild` builds and `npm pack`
subprocess spawns exceeding vitest's 10s/20s hook/test timeouts under current machine load)
rather than a product-logic regression — but per role mandate this is reported as a finding
for the orchestrator to route, not fixed or waved through by this verifier.
