# Verification Report — 2026-09-27-express-openapi-lite

<!-- E2E Verifier, THIRD fresh dispatch, rigor: critical. Clean-state re-run of EVERY
     canonical command. Trusts no prior claim (including its own prior dispatches). -->

## Clean state

```
$ rm -rf node_modules
$ npm ci
added 608 packages, and audited 609 packages in 1m
EXIT:0
```

## Command evidence

### build — `npm run build` (tsup)

```
$ npm run build
CJS/ESM/DTS build success (index, manual, zod, auto-record)
EXIT:0
```

### lint — `npm run lint` (eslint . && prettier --check .)

```
$ npm run lint
Checking formatting...
All matched files use Prettier code style!
EXIT:0
```

### typecheck — `npx tsc --noEmit`

```
$ npx tsc --noEmit
(no output)
EXIT:0
```

### audit — `npm audit --audit-level=critical`

```
$ npm audit --audit-level=critical
3 vulnerabilities (1 low, 2 moderate) — esbuild dev-server (Windows-only advisory,
build tool not shipped to consumers) and qs (transitive, via a devDependency's
transitive dep, not in the published package). None at or above the `critical` gate
threshold, so the command itself exits 0.
EXIT:0
```

### pack — `npm run check:pack` and `npm pack --dry-run --json`

```
$ npm run check:pack
publint: All good!
attw --pack: node10 🟢 / node16(CJS) 🟢 / node16(ESM) 🟢 / bundler 🟢
  for "express-api-docs", "express-api-docs/manual", "express-api-docs/zod",
  "express-api-docs/package.json"
EXIT:0

$ npm pack --dry-run --json
entryCount: 21, bundled: []
EXIT:0
```

### test — `npm test` (vitest run --coverage --typecheck)

**Run 1 (default parallelism, canonical command) — RED:**
```
$ npm test
 Test Files  1 failed | 77 passed (78)
      Tests  1 failed | 636 passed | 5 skipped (642)
FAIL  test/meta/lint-rules.test.ts > eslint rules (ADR-20, ADR-21, ADR-04, ADR-39)
      > bans local Symbol() in src/**
Error: Test timed out in 20000ms.
EXIT:0 (npm test wrapper itself; vitest reported the failure, see Duration 143.46s)
    Isolate  75 workers spawned · ~809ms startup each
```

**Run 2 (default parallelism, canonical command, consecutive) — GREEN:**
```
$ npm test
 Test Files  78 passed (78)
      Tests  637 passed | 5 skipped (642)
Statements 98.56% | Branches 93.35% | Functions 99.45% | Lines 99.34%
EXIT:0
```

Runs 1 and 2 **disagree** (`test/meta/lint-rules.test.ts` present as FAIL in run 1,
absent from the failed set in run 2). Full discriminating-check sequence and
quarantine recorded in `qa/determinism-report.md`.

### e2e / smoke

Covered inside `npm test` (`examples/basic`, `GET /openapi.json` → 200); it is part of
the 636–637 passing tests in both runs above and not implicated in the disagreement.

### mutation — `npm run mutation` (stryker run, thresholds.break: 70)

Not re-run to completion this dispatch. Prior two dispatches both measured a
partial-run extrapolation of 8–17 hours for the full configured scope
(`src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`,
`src/adapter/**`, `src/registry/**`) at ~1202/1698 mutants sampled. That arithmetic
is unchanged (no mutation-relevant source files were touched since the last
measurement — only `vitest.config.ts`'s `maxWorkers` setting changed, which Stryker's
scope does not cover). Recorded again as `na`, reason `infeasible: session-bounded`,
consistent with dispatches 1 and 2. Re-attempting a full run within this single
session would not complete and would not add signal beyond what is already on record.

## Coverage vs target

| metric | measured | target | floor (target−10) | verdict |
|---|---|---|---|---|
| Statements | 98.56% | 90% | 80% | PASS |
| Branches | 93.35% | 90% | 80% | PASS |
| Functions | 99.45% | 90% | 80% | PASS |
| Lines | 99.34% | 90% | 80% | PASS |

(Measured from run 2, the only green full-suite run this dispatch; run 1 did not
reach the coverage-report step because vitest exited after the failed test file list.)

## Verdicts

| Check | Result | Evidence ref |
|---|---|---|
| build | PASS | build block above |
| tests | **RED (disagreement)** | test run 1 vs run 2 blocks above; see determinism-report.md |
| lint | PASS | lint block above |
| typecheck | PASS | typecheck block above |
| pack | PASS | pack block above |
| audit | PASS (no critical) | audit block above |
| e2e | PASS (inside green run) | test run 2 block |
| coverage vs target | PASS (98.56/93.35/99.45/99.34 vs 90% target / 80% floor) | coverage table |
| mutation vs floor | `na` — infeasible: session-bounded (unchanged from dispatches 1–2) | mutation block above |

## Overall verdict: RED

`npm test`, the canonical test command, disagreed across two consecutive
default-parallelism runs in this same dispatch: run 1 failed
`test/meta/lint-rules.test.ts` on the same `testTimeout: 20000ms` symptom already on
record from dispatch 2; run 2 passed clean. `maxWorkers: 4` (fix-loop iteration 2,
committed as afd973b/73af265) reduced but did **not** eliminate the failure — it
reproduced on the very first canonical run of this fresh dispatch, on a clean
`npm ci` install, using the exact code currently on the branch. This is the same
failure class as before (worker-pool/CPU contention against a fixed 20s timeout in a
CPU-bound ESLint-in-a-test-file case), not a new regression, but it is now confirmed
as a **repeat occurrence after the targeted fix**, which the build log itself flagged
as only "high but not absolute confidence" pending a third recurrence. That third
recurrence has now happened. See `qa/determinism-report.md` for the full
discriminating-check evidence and quarantine.
