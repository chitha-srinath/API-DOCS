# Escape Report — E-NNN <slug>

<!-- Escape Analyst, post-merge, outside the phase machine. Written to
     changes/<id>/escapes/E-NNN-<slug>.md (archived changes included).
     Canonical rules: ../protocol/escape-analysis.md. -->

| field | value |
|---|---|
| escape id | E-NNN |
| change id | <the attributed AIDD change> |
| reported at | <ISO-8601Z> |
| source | <issue url \| incident \| support escalation \| internal report> |
| defect class | <shared vocabulary — see bench/harness.md> |
| verdict | <layer-blind \| no-layer-at-reasonable-cost \| out-of-scope> |
| repeat of | <E-NNN \| none> |

## Symptom and reproduction

<!-- What went wrong in the field, and the reproduction. One evidence block per command run
     (../protocol/evidence.md). A defect you could NOT reproduce says so explicitly and states
     what the analysis relied on instead — never an asserted mechanism. -->

## Attribution

<!-- The commit(s) that introduced the defect and how they map to the change:
     git log -S / git blame -> commit -> branch aidd/<change-id>. If no AIDD change owns the
     code, the verdict is out-of-scope and the analysis stops here. -->

## Per-layer verdict table

<!-- ALL NINE ROWS, ALWAYS. Never omitted, never merged, never blank.
     should_have_caught: yes requires naming the artifact that WOULD have carried the catch.
     did: yes is the caught-then-dropped case (REFUTED, waived, downgraded, ruled) — the more
     dangerous escape.
     why_missed: cite the blind artifact BY PATH and state what it actually contained.
     preventable_by: ONE minimal change to a named file. "More review" / "be more careful" /
     "raise the rigor mode" are invalid by format. `—` only on should_have_caught: no rows. -->

| layer | should_have_caught | did | why_missed | preventable_by |
|---|---|---|---|---|
| L1-review (dimension: <name>) | | | | |
| L1-tests (category: <name>) | | | | |
| L2-auditor | | | | |
| L2-tally | | | | |
| L2-debate | | | | |
| L3-supervisor | | | | |
| critic | | | | |
| e2e-mutation | | | | |
| evidence-capture | | | | |

## Verdict argument

<!-- layer-blind: name the blind layers and, for each, the one artifact that was blind.
     no-layer-at-reasonable-cost: ALL THREE are required —
       (1) what WOULD have caught it (the specific technique),
       (2) what that costs on every change,
       (3) why that cost is not worth paying here.
     A verdict missing any of the three is invalid. -->

## Regression test (mandatory — both verdicts)

<!-- Specification only. A Builder authors it under TDD inside the fix change: observed RED
     against the defective code, GREEN after the fix, both as evidence blocks. A regression
     test never observed red proves nothing and does not close this escape. -->

| field | value |
|---|---|
| file | <path> |
| test name | <name> |
| reproduction input | <the exact input/state that triggers the defect> |
| assertion | <what must hold> |
| binds to | <AC id or invariant> |
| RED evidence | <evidence block ref — before the fix> |
| GREEN evidence | <evidence block ref — after the fix> |

## Amendment (proposal — never auto-applied)

<!-- ONE minimal, diff-level change against a NAMED file (core/protocol/*.md, core/roles/*.md,
     a playbook checklist, or the test matrix in core/roles/test-engineer.md). State the file,
     the anchor, and the exact text. A human decides; no agent applies this.
     `no amendment proposed` is valid ONLY under no-layer-at-reasonable-cost with the cost
     argument stated above. -->

| field | value |
|---|---|
| file | <path> |
| anchor | <section or table> |
| proposed text | <the exact addition or change> |
| status | proposed (a human decides — never auto-applied) |

## Repeat escalation

<!-- Only when repeat_of is set. Four facts, no re-proposal of the prior amendment:
     the prior escape id, the prior amendment text, whether it was ever applied (cite the
     commit or state `not applied`), and the evidence it did not prevent recurrence.
     A repeat is never closed by an agent. -->

## Learning entry

<!-- The L-NNN entry appended to learnings.md through the existing learning loop
     (../protocol/learning.md) — same format, same dedupe, evidence = this report's path. -->
