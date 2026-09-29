# Verification Report — 2026-09-27-express-openapi-lite

<!-- E2E Verifier: clean-state re-run of EVERY canonical command. Trusts no prior claim.
     This is a FRESH dispatch (2nd attempt of QA step 7). All prior reports superseded.
     Rigor: critical. Working dir: C:\sai\code practice\Package\API-DOCS.
     node v24.11.1, npm 11.4.2. -->

## Command evidence

### 1. Clean install
```
$ rm -rf node_modules && npm ci
added 608 packages, and audited 609 packages in 28s
3 vulnerabilities (1 low, 2 moderate)     exit 0
```

### 2. build — `npm run build` (tsup)
```
$ npm run build
ESM  dist\index.js 46.10 KB / manual.js 46.06 KB / zod.js 2.03 KB / auto-record.js 3.86 KB  ⚡ success 4041ms
CJS  dist\index.cjs 47.76 KB / ...                                                          ⚡ success 5363ms
DTS  dist\index.d.ts, index.d.cts, ...                                                      ⚡ success 6491ms
BUILD_EXIT:0
```
**Result: GREEN.**

### 3. test — `npm test` (`vitest run --coverage --typecheck`)
Run twice for determinism (see determinism-report.md for full analysis). Both default-parallelism
runs were RED, each on a single different subprocess/lint-heavy test hitting its 20000ms hook/test
timeout budget under ~74-78 concurrent isolated workers on this Windows host:

- Run 1: `test/entries/minified.test.ts` FAIL (`Hook timed out in 20000ms` in `beforeAll`, esbuild
  subprocess bundling). 632 passed | 10 skipped (642 total, 1 file failed of 78).
- Run 2: `test/meta/lint-rules.test.ts` FAIL (`Test timed out in 20000ms`, ESLint lint-text call).
  636 passed | 5 skipped (642 total, 1 file failed of 78).

A `--no-file-parallelism` (single-worker) re-run of the full suite, run in isolation (no concurrent
build/test process), was fully GREEN: **78 files / 637 passed / 5 skipped, 0 failed**, with real
coverage numbers (below). A reversed-file-order run and both suspect files run alone (default
parallelism) also passed. This isolates the cause to Windows-host CPU/AV contention under the
default worker count pushing subprocess/lint-heavy hooks past their fixed 20000ms budget — not an
application defect. See `qa/determinism-report.md` for the full discriminating-check trail and the
quarantine of both tests.

**Result: RED at default parallelism (both repeats); GREEN and reproducible at parallelism 1 /
alone / reversed order.** `tests_green` cannot be set to `passed` as-is: the canonical command
(`npm test`) is red on repeat, non-deterministically, at default settings. This is a config/CI-
infra gap (tight timeout vs. Windows worker contention), not a code regression — see findings below.

### 4. Coverage vs target (from the parallelism=1 GREEN run)
```
All files          |   98.56 |    93.35 |   99.45 |   99.34 |
```
| Metric | Actual | Target | Floor (target − 10) | Verdict |
|---|---|---|---|---|
| Statements | 98.56% | 90% | 80% | PASS |
| Branches | 93.35% | 90% | 80% | PASS |
| Functions | 99.45% | 90% | 80% | PASS |
| Lines | 99.34% | 90% | 80% | PASS |

Coverage is well above both the 90% target and the 80% floor on every axis.

### 5. lint — `npm run lint` (`eslint . && prettier --check .`)
```
$ npm run lint
Checking formatting...
All matched files use Prettier code style!
LINT_EXIT:0
```
**Result: GREEN** (no ESLint or Prettier errors printed; exit 0).

### 6. typecheck — `npx tsc --noEmit`
```
$ npx tsc --noEmit
TSC_EXIT:0
```
**Result: GREEN** (no output, exit 0).

### 7. pack — `npm run check:pack` (build && publint && attw --pack .)
```
$ npm run check:pack
Running publint v0.3.24 for express-api-docs... All good!
attw: No problems found 🌟
"express-api-docs" / "express-api-docs/manual" / "express-api-docs/zod" / package.json
  node10 🟢  node16(CJS) 🟢  node16(ESM) 🟢  bundler 🟢   (all subpaths)
PACK_EXIT:0
```
**Result: GREEN.**

### 8. e2e / smoke
Per architecture.md, e2e is n/a as a standalone command — the example smoke test
(`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test` (`test/docs/example-smoke.test.ts`).
It passed in every run performed today, including both default-parallelism RED runs (it was never
among the failing tests) and the parallelism=1 GREEN run.
**Result: GREEN** (evidenced inside the test-suite runs above).

### 9. audit — `npm audit --audit-level=critical`
```
$ npm audit --audit-level=critical
esbuild 0.27.3-0.28.0 — low  (Windows dev-server arbitrary file read; build-time only, not shipped)
qs 2.2.5-6.15.3 — moderate, via typed-rest-client (a devDependency of an unrelated MCP/tooling chain,
  not a runtime or build dependency of express-api-docs itself)
3 vulnerabilities (1 low, 2 moderate); 0 critical
AUDIT_EXIT:0
```
**Result: GREEN** (audit-level=critical finds nothing at or above critical; exit 0).

### 10. perf (gate, ADR-26) — `npm run perf`
Not re-run in this dispatch: perf is a separate gated command from `npm test` (which now correctly
excludes `test/aidd-exhaustive/performance-smoke/**` and `test/perf/**` per the committed
vitest.config.ts fix in 2b77352) and was independently verified 7/7 green by the Build Fixer with
real p95/heap numbers under its own 120000ms-budget config. Re-running the full perf gate was out of
scope for this dispatch (not one of the E2E Verifier's canonical must-run set beyond build/test/
lint/typecheck/e2e/mutation); no claim is made about a fresh perf run here.

### 11. mutation — `npm run mutation` (Stryker, `thresholds.break: 70`)
Attempted. `stryker.config.mjs` mutates `src/config/**, src/introspect/**, src/spec/**,
src/route/**, src/registry/**, src/adapter/**`. On this run Stryker's `ProjectReader` found 29 of
670 files changed vs. its stale local incremental cache and instrumented **1698 mutants** for its
dry run — consistent with the prior estimate (~1202 mutants full-scope) of an 8-17 hour extrapolated
runtime for a full mutation pass, i.e. genuinely infeasible within one session-bounded dispatch.

The attempted dry run itself failed (`ConfigError: There were failed tests in the initial test run`)
because it hit the exact same `test/meta/lint-rules.test.ts` timeout flake documented above — while
running concurrently with another background build process, i.e. under even higher contention than
the two `npm test` repeats. This is further corroborating evidence for the timeout/contention root
cause, not a new finding.

**Result: `na`, reason: `infeasible: session-bounded`.** Not run to completion; no mutation score is
claimed. `mutation_floor_met` cannot be set to `passed` from this dispatch — record as `na` per the
architecture's own documented scope, not as a silent gap.

## Findings (routed to fix loop / orchestrator, not fixed here)

- **F-TIMEOUT-1** (repeat of previously-fixed class, now recurring on a second file): `npm test` at
  default parallelism is flaky on this Windows host — `test/entries/minified.test.ts` (esbuild
  subprocess bundling in `beforeAll`) and `test/meta/lint-rules.test.ts` (ESLint `lintText` calls)
  both sit close enough to the global 20000ms `testTimeout`/`hookTimeout` that CPU contention from
  ~74-78 concurrently spawned isolated vitest workers pushes either one over the line,
  non-deterministically, from run to run. Both pass reliably alone, in reverse file order, and under
  `--no-file-parallelism`. Suggested remedy for the fix loop: raise `hookTimeout`/`testTimeout` for
  these two specific subprocess/lint-heavy tests (mirroring the per-test override already applied to
  `test/dist/pack.test.ts`), or reduce default worker concurrency, or mark them `sequential`/
  isolate:false. Not fixed here per role mandate (verifier reports, does not fix).

## Verdicts

| Check | Result | Evidence ref |
|---|---|---|
| build | GREEN | §2 |
| tests | RED at default parallelism (non-deterministic single-file flake, 2 different tests across 2 repeats); GREEN at parallelism 1 / alone / reversed order | §3, determinism-report.md |
| lint | GREEN | §5 |
| typecheck | GREEN | §6 |
| e2e | GREEN (in-suite smoke test) | §8 |
| pack | GREEN | §7 |
| audit (critical) | GREEN (0 critical) | §9 |
| coverage vs target | 98.56/93.35/99.45/99.34% vs 90% target (80% floor) — PASS | §4 |
| mutation vs floor | `na` — infeasible: session-bounded (1698 mutants; dry run itself hit the flake) | §11 |

## Overall verdict: RED

The build, lint, typecheck, pack, audit and e2e/smoke commands are unambiguously green. Coverage
clears the target with margin. But the canonical `npm test` command is non-deterministically red at
its default settings — a fresh, second flaky test (`test/meta/lint-rules.test.ts`) joined the
previously-quarantined `test/entries/minified.test.ts` in this dispatch's two repeats, each failing
in a different run. Per protocol, a repeat is a measurement, not a retry: this is reported as-is,
not smoothed over by re-running until green. `tests_green` and `evidence_reproduced` should NOT be
set to `passed` from `npm test` at its current (default-parallelism) configuration. See
`qa/determinism-report.md` for the full quarantine record and discriminating-check evidence.
