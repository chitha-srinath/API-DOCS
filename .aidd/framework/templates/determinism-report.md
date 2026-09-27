# Determinism Report — <change-id>

<!-- E2E Verifier, QA step 7 (inside its existing dispatch). Written to
     qa/determinism-report.md. Canonical rules: ../protocol/determinism.md.
     A repeat is a MEASUREMENT, never a second chance: run 1 FAIL + run 2 PASS is a
     disagreement, not a pass. -->

| field | value |
|---|---|
| rigor mode | <fast \| standard \| critical> |
| repeats required | <per ../protocol/determinism.md §2> |
| repeats done | <N> |
| verdict | <reproduced \| flakes quarantined \| na (rigor:fast)> |

## Repeats

<!-- One row per gating claim, per run. Agreement = identical exit code AND identical
     test-id -> outcome map. Output bytes, durations, and ordering do NOT have to match.
     A test present in one run and absent in the other IS a disagreement.
     Where the runner cannot enumerate test ids, compare (exit code, pass/fail/skip counts)
     and say so in `notes` — degradation is explicit, never silent. -->

| claim class | command | run 1 | run 2 | agreed? | evidence ref | notes |
|---|---|---|---|---|---|---|
| full suite (Construction close) | | | | | | |
| clean-state E2E | | | | | | |
| fix-loop-closing test(s) | | | | | | |

<!-- In `standard`, the clean-state E2E row records ONE run labelled `corroboration
     (different environment)` — it is not counted as a repeat and is not pretended to be one. -->

## Quarantined tests

<!-- Any test whose repeats disagreed. It may NOT serve as evidence for any AC, gate, or
     debate defence; its ac-matrix and test-report rows read QUARANTINED, never PASS.
     Every AC it was proving reverts to unproven and feeds the EXISTING fix loop.
     disposition: fixed (repeats now agree, fresh evidence) | accepted (human, with reason —
     acceptance does NOT restore it as evidence) | pending (G3 becomes forced-human in both
     autonomy modes). -->

| test id | claim class | outcomes | ACs affected | suspected source | disposition | accepted reason |
|---|---|---|---|---|---|---|

## Discriminating checks

<!-- Required for every disagreement: one re-run per check, one variable changed, one evidence
     block each. `unknown` is permitted ONLY after all six ran and are recorded — and the test
     is quarantined anyway. "Probably flaky infrastructure" is not a source. -->

| test id | fixed seed | pinned clock/TZ | offline | run alone | reverse order | parallelism 1 | conclusion |
|---|---|---|---|---|---|---|---|

## Evidence blocks

<!-- One block per run and per discriminating check (../protocol/evidence.md):
     command, trimmed output, exit code, timestamp. Nothing here is asserted. -->

## Summary

repeats: <N> · agreed: <N> · disagreed: <N> · quarantined: <N> (pending <N>) ·
ACs reverted to unproven: <N> · gate `evidence_reproduced`: <pending|passed|failed|na>
