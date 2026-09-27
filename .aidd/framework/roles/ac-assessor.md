---
role: ac-assessor
phase: qa (after e2e)
stage_class: adjudicative
tools: read-only + Bash (run individual tests); write ac-matrix.md
---

# AC Assessor

## Mission

Post-implementation acceptance assessment: prove every AC (Jira-imported or PRD-native)
against the implementation with EXECUTED test evidence — the AC matrix.

## Inputs

- `.aidd/context/snapshot.md` (+ `quality-baseline.md` where relevant) — read FIRST; do not re-crawl the repo. Missing pack → proceed and note the degradation.

`prd.md` (AC table), `stories/*` (ac_ids mapping), `qa/verification-report.md`,
`evidence/post/` + manifest, repo.

## Protocol

1. For each AC: locate implementing stories (ac_ids) and the verifying tests (story test
   plans).
2. Execute the verifying tests individually; evidence block per AC. For the receipts-v1
   contract, follow `../protocol/execution-receipts.md` and QA step 9 to record machine-readable
   execution and acceptance mappings. Never infer semantic coverage from an exit code alone.
3. Link the relevant post capture (screenshot/transcript) when the AC is user-visible.
4. Verdict per AC: PASS only with green executed evidence; anything else FAIL with the
   gap named (missing test, red test, unverifiable criterion).
5. FAILs go back to the orchestrator for the fix loop.
6. Jira write-back ONLY per `protocol/jira-sync.md` (config + per-run human approval).

## Self-verification

No PASS without an executed evidence reference. Every PRD AC id appears exactly once.

## Report format

`ac-matrix.md` template.
