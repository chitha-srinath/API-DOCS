# Regression Supervision Report — 2026-09-27-express-openapi-lite

Scope: session-wide regression surface on the current tree (branch aidd/2026-09-27-express-openapi-lite-rebuild, HEAD 6db61fc). Process audit only; product quality is QA's remit.
Date: 2026-10-06. Supervisor dispatch (regression lens).

## Verdict: VIOLATIONS

Recomputation limits: Bash is disabled in this session, so `aidd-cost.sh` and `aidd-validate.py` could not be run. Cost was recomputed by hand from `cost/ledger.md`. Validation is UNVERIFIED.

## Answer to the explicit question

The recorded QA "47/47 PASS" claim is NOT consistent with a red typecheck and a red prettier on the current tree. The QA evidence is bound to an earlier commit, not to the current tree:

- `qa/verification-report.md:7` names commit `98c51d3` as the tree it ran on.
- Its typecheck (`verification-report.md:57-59`, `npx tsc --noEmit` exit 0) and lint (`:48-52`, `npm run lint` exit 0) are true only for `98c51d3`.
- `examples/basic/app.ts` was added or changed by commit `15f3907` and later commits (per `git log .git/logs/HEAD` lines 61-86). Those commits are after G3 and after the QA evidence. No audit, ledger, or gate entry covers them.

So the 47/47 claim may have been true for its tree, but it says nothing about the current tree. Any AC that cites `vitest --typecheck` (AC-006, AC-046) or `npm run lint` (AC-026, AC-027) is not currently reproducible.

## Itemized violations

**R1. Red typecheck on current tree (tests_green / e2e_verified no longer hold).**
- Evidence: `npx vitest run --typecheck` and `npm run typecheck:v4` fail with TS2532 at `examples/basic/app.ts:177`. Regression run by orchestrator; not re-run here.
- Probable cause (from reading the file, not verified): line 177 is `(req.headers['content-type'] ?? '').split(';')[0].trim()`. With `noUncheckedIndexedAccess`, `[0]` is `string | undefined`. The `?? ''` guards only the header, not the index.
- Introduced after the QA tree: `git log` shows `15f3907 feat(example): dummy 500, auth, and file upload endpoints`.
- Remediation: fix the index access (for example `(... .split(';')[0] ?? '').trim()`), then re-run the full clean-state canonical set (build, test with typecheck, lint, typecheck:v4) and re-bind the evidence. Re-run QA step 7 on the current tree.

**R2. Red lint gate (`npm run lint` = eslint && prettier --check).**
- Evidence: eslint exit 0; prettier exit 1 with 34 files flagged, including `src/serve/router.ts`, several test files, and untracked `.playwright-mcp/` artifacts.
- Remediation: run `npx prettier --write` on the flagged source and test files. Remove `.playwright-mcp/` or add it to ignore config. Re-run `npm run lint`.

**R3. Post-G3 changes outside the audit trail.**
- Evidence: commits from `2e5bcbe` through `6db61fc` (per `.git/logs/HEAD`) include a package rename to `express-api-contract` (`82cdd24`, `e73ae16`), a shadcn docs UI, and CI changes. `supervision/audit.log` ends at line 198 (2026-10-01, delivery). `cost/ledger.md` has no rows after 2026-09-30. `state.yaml` gates still show 47/47 ACs and hashes bound to the pre-rename artifacts.
- Whether an agent or a human made these commits is not recorded. If agents made them, the dispatches are unlogged (violation). If a human made them, they fall outside any QA or gate evidence.
- Remediation: open a new change or amendment. Record the commits in the audit log with their authors, re-run QA scoped to the changed surfaces, and re-approve any stale gate per the gates.md staleness rule (cited in `state.yaml` g2_plan note) before delivery.

**R4. Determinism record contradicts the audit trail and quarantine register.**
- Evidence: `qa/determinism-report.md:97-108` states "Quarantined tests: None" and "disagreed: 0". `state.yaml:199-209` lists two quarantined tests (`test/entries/minified.test.ts`, `test/meta/lint-rules.test.ts`) with disposition `accepted`. `audit.log:179-198` and `build-log.md:147-180` record run-to-run disagreements (minified FAIL then clean; lint-rules FAIL then PASS on the same dispatch).
- The protocol says a repeat is a measurement, never a retry, and quarantined tests must appear in `qa/determinism-report.md`. Neither happened. The report was written as if the disagreements never occurred.
- Remediation: rewrite `qa/determinism-report.md` to record the disagreements and the two quarantined tests with their dispositions. Then re-run the two determinism repeats on the current tree and record the new results as measurements.

**R5. The final E2E PASS is bound to a superseded tree.**
- Evidence: `qa/verification-report.md:5-7` says the PASS ran on commit `98c51d3`. Git history shows `98c51d3` precedes the fix commits `2b77352` (vitest timeout config), `afd973b` (maxWorkers concurrency fix), and the RED re-run `6f307d7`. The PASS commit is `e910f7d` (after `6f307d7`).
- `state.yaml` history dates the PASS `2026-09-29T23:50:20Z`, which is listed before three `2026-09-30` RED entries. The orchestrator then set `evidence_reproduced: passed` at 13:05 from that stale entry (`audit.log:190`), overriding the latest RED (`02:05`, `evidence_reproduced: failed`).
- Remediation: re-run step 7 (E2E plus two determinism repeats) on the current HEAD. Set `tests_green`, `e2e_verified`, and `evidence_reproduced` from that run only. Re-hash the verification and determinism reports.

**R6. Audit counters do not match artifacts.**
- Evidence: `state.yaml:250-252` `audit.interrogation.rounds_used: 0`. `audit/interrogation/qa-final-verdict.md:3` says "Settled in round 1". `ST-001-verdict.md:5` says "Rounds used: 1/2". `ST-006-verdict.md:4` says "0 of 2". `supervision/qa-final-report.md` item Q-7 flagged this and it is not remediated.
- Remediation: pick one convention (rounds_used = interrogation rounds actually issued). Set the counter to match the verdict files and note the convention in each verdict.

**R7. Cost ledger missing a row; ceiling raises without stop rows.**
- Ledger row missing: `audit.log:118` (2026-09-27T19:32:17Z, architect, ADR-56 backflow, returned). `cost/ledger.md` has rows for ADR-54 (17:19:48) and ADR-55 (19:31:03) only.
- Ceiling raises with no `cost.stops` `disposition: raised` row: `budget_tokens` 5.6M to 20M (2026-09-28T20:13:53Z, human), `budget_minutes` 300 to 1200 (2026-09-27T17:19:30Z), `budget_minutes` 1200 to 2500 (2026-09-29T20:07:17Z). `state.yaml:28-32` has only the 12:59:42Z row.
- Remediation: append the ADR-56 row (tokens "not measured", source "reconstructed", never 0). Append `cost.stops` raised rows for each of the three ceiling raises.
- Cost recompute (manual): last `cum_tokens` 7886586 and `cum_minutes` 2175.6 match `spent_*`. Phase sums match state: inception 2694542/102.0 (ledger row 79), construction 2718693/525.9 (rows 81-107), qa 2473351/1547.7 (rows 108-146). No `na` gate is cost-justified. No `not measured` row carries a 0.

**R8. Validation unverified.** `aidd-validate.py` was not run (no python3 and no Bash). Schema validity of `state.yaml` and the ledger is therefore unknown and must not be claimed as COMPLIANT. Remediation: run `python3 .aidd/framework/scripts/aidd-validate.py` on a host with python3 and attach the output.

## Not violations (checked)

- Adjudication: `audit.negotiation.rulings` is empty and no DISPUTED AC remains (`qa-final-verdict.md`).
- Budget maxima: `audit.interrogation.max` 2, `audit.negotiation.max` 2, `audit.debate.max` 6. These match the critical row of `rigor-modes.md`.
- Ledger chain: cumulative sums in `ledger.md` are arithmetically consistent row to row (spot-checked rows 135-139).

## Required supervisor-log line (not appended; see note)

`2026-10-06T00:00:00Z | all | supervisor | regression surface (typecheck, prettier, post-G3 commits) | returned | VIOLATIONS R1-R8; 47/47 claim not consistent with current tree; validation unverified`

Note: the audit log could not be appended. My tools (Read, Grep, Glob, Write) cannot append to a file without rewriting its 198 existing lines, and rewriting an evidence log by hand risks corruption. The orchestrator should append the line above.
