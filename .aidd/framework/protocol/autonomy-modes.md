# Autonomy Modes

Same playbooks, same artifacts, same phase order, same quality gates. Exactly four
mechanical differences.

Autonomy decides **who approves**. How much verification runs is a separate, orthogonal
axis — the rigor mode (`rigor-modes.md`). Never conflate them: a `take-care` change can be
`critical` rigor, a `let-me-look` change can be `fast`, and neither setting is ever derived
from the other. Nothing in this file reads `rigor.mode`; nothing in `rigor-modes.md` reads
`mode`.

## `take-care` — "handle everything"

1. Gates auto-approve (`approved_by: auto`) unless an escalation flag forces a human stop
   (see `gates.md`).
2. Clarifying questions are self-answered with evidence-backed defaults; every one is
   logged in `intent.md` under **Assumptions** with confidence H/M/L and surfaced in the
   PRD and PR body. Questions flagged BLOCKING (irreversible/destructive actions, external
   credentials, business rules with divergent outcomes) still escalate to the human.
3. On `blocked`: finish what is finishable, then stop with a blocked report.
4. Nothing else changes. Quality gates still block Delivery.

## `let-me-look` — "show me at the gates"

1. G1/G2/G3 stop and await approve / revise / abort.
2. Clarifying questions are asked of the human; answers recorded in `intent.md`.
3. On `blocked`: stop immediately and ask.
4. Nothing else changes.

## Mode selection

`mode` is frozen into the change state at creation (inheriting global `default_mode`) and
may be switched mid-change (e.g. run take-care, drop to let-me-look before G3). The switch
is itself a history event.
