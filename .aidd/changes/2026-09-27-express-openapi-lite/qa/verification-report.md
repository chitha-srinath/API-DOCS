# Verification Report — 2026-09-27-express-openapi-lite

<!-- E2E Verifier: clean-state re-run of EVERY canonical command. Trusts no prior claim. -->

Rigor mode: **critical**. All commands below were run independently from a clean state
(`npm ci`, not `npm install`) on branch `aidd/2026-09-27-express-openapi-lite`, commit
`98c51d3`. Node v24.11.1, npm 11.4.2, Git Bash on win32.

## Command evidence

### 0. Clean install

```
$ npm ci
added 608 packages, and audited 609 packages in 30s
3 vulnerabilities (1 low, 2 moderate)   # pre-existing transitive deps, not a gate here
exit 0
```

### 1. Build

```
$ npm run build      # tsup
ESM ⚡️ Build success in 64ms  (index.js 46.10KB, manual.js 46.06KB, zod.js 2.03KB, auto-record.js 3.86KB)
CJS ⚡️ Build success in 67ms
DTS ⚡️ Build success in 2317ms
exit 0
```

### 2. Full test suite (run 1, clean state — also serves as the class-2 "clean-state E2E" run)

```
$ npm test      # vitest run --coverage --typecheck
 Test Files  79 passed (79)
      Tests  644 passed | 5 skipped (649)
 Type Errors  no errors
   Duration  56.97s
Coverage: Statements 98.56% | Branches 93.35% | Functions 99.45% | Lines 99.34%
exit 0
```

The 5 skips are the same known-legitimate skips carried from the fix-loop closure (not
new). No new failures, no new skips.

### 3. Lint

```
$ npm run lint      # eslint . && prettier --check .
Checking formatting...
All matched files use Prettier code style!
exit 0
```

### 4. Typecheck

```
$ npx tsc --noEmit
(no output)
exit 0
```

### 5. e2e / smoke

Per `architecture.md` Verification Commands: "e2e: n/a. The example smoke test
(`examples/basic`, `GET /openapi.json` → 200) runs inside `npm test`." That smoke assertion
is part of the 644 passing tests above (run 1) — confirmed passing, no separate e2e command
exists for this stack. Recorded here as `n/a — folded into test suite`, not silently skipped.

### 6. Mutation testing (full project-wide scope, run ONCE per human-approved scope decision)

**Scope decision (human-approved, recorded per dispatch instructions):** the full
project-wide mutation run — using `stryker.config.mjs`'s own static `mutate` array
(`src/config/**`, `src/introspect/**`, `src/spec/**`, `src/route/**`, `src/registry/**`,
`src/adapter/**`, i.e. every source directory, not the narrower per-story `--mutate`
scoping used during construction/fix-loop) — runs **once** as the authoritative floor
check, not twice, because of its cost (see run time below). This is a deliberate,
human-approved exception to the "reproduce every canonical command twice" default for
`critical` rigor; it applies to this one command class only. Every other canonical command
(build, full test suite, lint, typecheck) *was* reproduced twice — see
`qa/determinism-report.md`.

**Attempt 1 (aborted, reported for transparency):** a first `npx stryker run` invocation
was started at 2026-09-29T18:26 UTC. Its shell session (wrapped in a `tee` pipeline) was
reaped at ~52 minutes elapsed / 18% progress (223 of 1202 mutants tested, 33 survived, 38
timed out at that point) with `EXIT:127` and no Stryker process left running
(`Get-Process node` showed nothing afterward). This was an infrastructure/session
interruption, not a Stryker or test failure — no error was logged by Stryker itself. It did
**not** produce a usable score and is not counted as the authoritative run.

**Attempt 2 (authoritative):** re-launched detached (`nohup ... &`, no `tee`) at
2026-09-29T~21:15 UTC and polled to completion.

```
$ npx stryker run
Ran 0.97 tests per mutant on average.
-----------------------|--------|---------|----------|-----------|------------|----------|----------|
                       | % Mutation score |          | # killed | # timeout | # survived | # no cov | # errors |
All files              |  84.39 |   84.39 |     1454 |        49 |        278 |        0 |        0 |
 adapter               |  87.16 |          |      128 |         1 |         19 |        0 |        0 |
 config                |  82.89 |          |      426 |        15 |         91  |        0 |        0 |
 docs                  | 100.00 |          |       45 |         0 |          0  |        0 |        0 |
 introspect            |  84.60 |          |      333 |         2 |         61  |        0 |        0 |
 registry              |  95.45 |          |       21 |         0 |          1  |        0 |        0 |
 route                 |  77.27 |          |      101 |        18 |         35  |        0 |        0 |
 serve                 | 100.00 |          |       38 |         0 |          0  |        0 |        0 |
 spec                  |  84.08 |          |      362 |        13 |         71  |        0 |        0 |
INFO MutationTestReportHelper  Final mutation score of 84.39 is greater than or equal to break threshold 70
INFO MutationTestExecutor      Done in 262 minutes and 29 seconds.
exit 0
```

Total mutants: 1731 (1454 killed + 49 timeout + 278 survived + 0 no-coverage + 0 errors).
Report: `reports/mutation/mutation.html` (repo-local, not committed).

`git status --short` after the run: clean — the mutation run left no working-tree drift.

## Coverage vs target

| metric | actual | target | floor (target − 10) | verdict |
|---|---|---|---|---|
| Statements | 98.56% | 90% | 80% | PASS |
| Branches | 93.35% | 90% | 80% | PASS |
| Functions | 99.45% | 90% | 80% | PASS |
| Lines | 99.34% | 90% | 80% | PASS |

All four metrics clear both the 90% target and the 80% floor by a wide margin.

## Mutation vs floor

| metric | actual | floor | verdict |
|---|---|---|---|
| Mutation score (project-wide, all 6 mutated dirs) | 84.39% | 70% | PASS |

Weakest sub-areas (informational, not gate-failing — recorded for the fix-loop backlog if
the orchestrator wants to strengthen tests further): `src/route/problem.ts` 60.00%,
`src/route/typed.ts` 71.43%, `src/spec/cache.ts` 70.00%, `src/config/defaults.ts` 75.61%.
All are above the 70% floor individually except `problem.ts` (60.00%) and `cache.ts`
(70.00% exactly) — `problem.ts` at 60.00% is **below** the 70% floor at the file level,
though the aggregate project-wide score (84.39%) is what the gate is defined against per
`architecture.md`/`constitution.md` (a single project-wide `thresholds.break: 70` in
`stryker.config.mjs`, not a per-file gate). Flagging `src/route/problem.ts` (60.00%, 16
survived / 24 covered) as a finding for consideration — it does not fail the gate as
configured, but it is the weakest file in the project and worth a look.

## Verdicts

| Check | Result | Evidence ref |
|---|---|---|
| build | PASS | §1 |
| tests | PASS (79/79 files, 644/649, 5 known legit skips) | §2 |
| lint | PASS | §3 |
| typecheck | PASS | §4 |
| e2e | PASS (n/a as separate command; folded into test suite smoke assertion) | §5 |
| coverage vs target | PASS (all 4 metrics ≥ 90% target, ≥ 80% floor) | Coverage table |
| mutation vs floor | PASS (84.39% ≥ 70% floor, project-wide, single authoritative run per human-approved scope decision) | §6 |

## Finding for the record (non-blocking)

- `src/route/problem.ts`: 60.00% mutation score (16 survived of 40 covered mutants) —
  weakest file in the project-wide run. Does not fail the configured project-wide gate but
  is the lowest test-strength area found. Recommend the fix loop or a future story
  strengthen assertions here (e.g. exact status-code/body shape checks) if this file is
  touched again.
