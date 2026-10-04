# Supervisor Report — Construction Phase Boundary (refreshed 2026-10-04)

Change: 2026-09-27-express-openapi-lite · Rigor: critical · Refresh of the con4 audit of 2026-09-28T07:31:52Z against the current cost ledger, audit.log, interrogation artifacts and state.

## Verdict: VIOLATIONS

Prior verdict (con4, 2026-09-28): VIOLATIONS on `cost.by_phase.construction` (stale). That item is CLOSED (verified below). The refresh finds three new or still-open items, all process-level; no story-level TDD, ownership or green-evidence finding was reopened.

## Violations (itemized)

| ID | Rule | Evidence of breach | Required remediation |
|---|---|---|---|
| C-1 | `protocol/supervision.md` cost checks: one `cost/ledger.md` row per `returned`/`rejected` line in audit.log (phase + role + unit); no missing row | Audit.log returned lines with no ledger row: `supervision/audit.log:90` (builder ST-001, wave 1, 2026-09-27T13:34:34Z), `:91` (master-agent wave-1, 13:34:34Z), `:92` (auditor ST-001, 13:34:34Z) — the ledger's first construction rows are at 14:39:02 (`cost/ledger.md:81`). `:106` (master-agent wave-3, second return at 17:18:24Z, duplicate of `:104`) and `:115` (master-agent wave-4, second return at 19:30:35Z, duplicate of `:112`) have one ledger row each (`:89`, `:93`). `:118` (architect ADR-56, returned 19:32:17Z) has no ledger row (`cost/ledger.md:91`, `:95` cover ADR-54 and ADR-55 only). | Append rows for `:90`, `:91`, `:92`, `:118` (`not measured` where the runtime gave no usage). For the duplicate master-agent returns `:106`/`:115`, either log each as its own row or annotate that they are one dispatch returning twice. Re-run `aidd-cost.sh` and reconcile. |
| C-2 | Supervision: counters in change-state audit must match artifacts; `interrogation.md` §counter (per subject) | Verdict files use two conventions: `audit/interrogation/ST-001-verdict.md:5` "Rounds used: 1/2" and `ST-005-verdict.md:3` "Round used: 1 of 2"; `ST-006-verdict.md:4` and `ST-007-verdict.md:4` "Rounds used: 0". `state.yaml:250-252` `rounds_used: 0`, `max: 2`. | Adopt one convention in `interrogation.md` (round 1 = the initial interrogation counts as used) and make each verdict file state its count under it. Set the counter to match the last subject's verdict. |
| C-3 | `protocol/supervision.md` Verdicts: "per-phase result mirrored into change-state `supervision`" | `state.yaml:247` `supervision: {}`. No construction verdict is mirrored. | Orchestrator mirrors this verdict (and the inception and QA verdicts) into `supervision:` after C-1 and C-2 are closed. |

## Closed since the 2026-09-28 audit

- `cost.by_phase` consistency: VERIFIED. `state.yaml:17-26` by_phase.construction = 2718693 tok / 525.9 min; by_phase.inception = 2694542 / 102.0; sum with qa (2473351 / 1547.7) = 7886586 / 2175.6 = `spent_tokens` / `spent_minutes`. Construction's own span = ledger cumulative at construction close (5413235, 627.9 min, `cost/ledger.md:107`) minus inception close (2694542, 102.0, `:79`) = 2718693 / 525.9 ✓. (Recomputed by hand; `aidd-cost.sh` not runnable in this session.)

## Checks that hold (re-verified)

- Story status: ST-001..ST-008 `built` (`state.yaml:211-245` region); TDD evidence and Builder reports cited in the wave notes.
- Monitoring: `audit/monitoring/construction-wave-1.md` … `construction-wave-7.md` present (wave-5 misfile corrected per audit.log:122).
- Auditor verdicts: eight files present (`audit/interrogation/ST-001..ST-008-verdict.md`), every claimed AC PROVEN, 0 DISPUTED; no negotiation entries required.
- Dispatch-plan discipline: parallel dispatch at audit.log:107 is recorded as one plan with its disjointness rationale before execution; no mid-step re-decision found.
- Ownership: the three documented exceptions (Build Fixer on `test/dist/*` at wave 6; ST-007 one-element `sideEffects` edit under ADR-55; ADR-54/56 doc-only ratifications) remain authorised per the construction report's prior citations (audit.log:124, :114–116, :118).
- Stash incident (audit.log:132) — remediation recorded, verified in the prior audit; no open item.

## Notes (not violations)

- Rows with backflow (`audit.log:110`, `:116`, `:118`) are architect dispatches; per `rigor-modes.md` backflows raise no mode change here.
- The G2 digest claims in the prior report (ADR-54/55/56 "zero rework") remain consistent with ST-004/ST-005 verdicts; the G2 rehash that followed in delivery is covered in `delivery-report.md` (D-2), not here.

## Required remediation

Close C-1 (ledger rows), C-2 (counter convention), then C-3 (mirror). Re-run this boundary's cost check after C-1 with `aidd-cost.sh` when a shell is available.
