# Phase: Delivery

Purpose: a merged-ready PR — reviewed, evidenced, traceable — with CI. Never merges.

## Steps

Phase boundary: rebuild the snapshot pack
(`bash .aidd/framework/scripts/build-snapshot.sh pre-delivery` per
`../protocol/context-snapshots.md`) before Step 1.

1. In parallel (sequential fallback: Doc Writer first):
   - Doc Writer (`../roles/doc-writer.md`) → docs/README/CHANGELOG edits +
     `delivery/docs-notes.md`.
   - Delivery Agent (`../roles/delivery-agent.md`) prep: rebase on default branch
     (non-trivial conflicts escalate to human in BOTH modes), story-grouped conventional
     commits, traceability graph (`templates/traceability.mmd` pattern) →
     `delivery/traceability.mmd`.
2. Delivery Agent: ensure CI workflow exists (adapt `templates/ci-workflow.yml` with the
   canonical commands) — commit if new.
3. Assemble PR body from `templates/pr-description.md`: verdict table, findings funnel,
   assumptions, AC matrix summary, evidence links, supervision summary, traceability.
   - **Cost summary** — the `cost/ledger.md` roll-up from
     `bash .aidd/framework/scripts/aidd-cost.sh` (`../protocol/cost-governance.md`): spend
     against both ceilings, per-phase totals, the projection (marked a lower bound when a
     class was never measured), `within_cost_budget`, and every `cost.stops` row with its
     disposition. A row the runtime could not measure reads `not measured`, never `0`.
   - **Reversibility** — one line stating how to undo this change: the revert commit
     (`git revert <sha>`), the migration down-path (the exact command), or the feature flag
     (its name and the value that disables it). "Not reversible" is an allowed answer only
     with the reason; a blank line is not.
4. **Mechanical preflight (all tiers).** Run
   `python3 .aidd/framework/scripts/aidd-ready.py .aidd/changes/<change-id> --json`
   immediately before pushing; save its output to `delivery/readiness.json`.
   A nonzero exit blocks delivery. Resolve every reported issue and re-run; changed gate
   artifacts require renewed approval per `../protocol/gates.md`, never silently rehash an
   existing approval. If rebase or documentation preparation changed in-scope source after
   QA, return to the affected QA checks, capture fresh suite/AC receipts and renew G3, then
   resume here without repeating already completed delivery preparation. The checker does
   not replace evidence review or execute tests.
   If Python is unavailable, delivery blocks until this check runs on a capable host.
   Then push branch; open PR (`gh pr create`); watch CI (poll, bounded 30 min).
   CI red → Build Fixer (max 2 attempts, re-push, re-watch) → exhausted = human
   escalation with logs.
5. Optional Jira write-back per `../protocol/jira-sync.md` (config + per-run approval).
6. **Supervisor final session report** → `supervision/final-report.md`.
7. Write `delivery/delivery-report.md`: per-phase verdicts/scores + funnel + links, the cost
   summary, and the reversibility line from step 3 — the delivery report is where "how do we
   undo this" is recorded for whoever needs it at 3am, not only in the PR body.
   Mark phase complete; global `changes.<id>` stays `in_progress` until retro.

## Scoring (orchestrator, rule-driven)

Per-phase verdict: FAIL (exit criterion unmet / open CONFIRMED CRITICAL / budget
exhausted) · CONCERNS (met with compromises: waivers, low-confidence assumptions,
forced-wave fallback, HIGH advisories, coverage in floor band, backflow) · PASS.
Score: 100 − deductions — CONFIRMED CRITICAL open −40 · AC FAIL at phase end −40 ·
backflow −15 · perf regression −15 · waiver −10 · missing evidence −10 · supervision
violation −10 · fix-loop iteration beyond first −5 · CONFIRMED HIGH fixed −5 ·
PLAUSIBLE HIGH −5 · ownership/TDD re-dispatch −5 · low-confidence assumption −3 ·
other advisory −2 · coverage below target −1/point. Floor 0.
Rollup: final verdict = worst phase; final score = 0.15·inception + 0.30·construction +
0.40·qa + 0.15·delivery.

## Exit checklist

- [ ] PR open, CI green, body embeds verdict/funnel/AC/evidence/supervision
- [ ] docs + changelog updated; samples verified
- [ ] PR body + delivery report carry the cost summary (`within_cost_budget`, no `pending`
      stop) and the one-line reversibility note
- [ ] delivery report written
