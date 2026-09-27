# Supervision Protocol

The Supervisor is the framework's internal QA of the process itself. It audits every
agent flow — including the orchestrator.

## Audit log

Every dispatch appends one line to `.aidd/changes/<id>/supervision/audit.log`:

```text
<ISO-8601> | <phase> | <role> | <story-or-scope> | dispatched|returned|rejected | <note>
```

On Claude Code the `session-log` hook appends automatically; on other runtimes the
orchestrator appends per protocol.

## Phase-boundary audit

At every phase end (before the phase is marked complete) the Supervisor replays the audit
log and artifacts against the phase checklist in the corresponding playbook. Checks include:

- Inception: clarifying questions asked/answered before PRD; judge scorecards present;
  disjointness verified; pre-review findings resolved or waived; gate hashes recorded.
- Construction: per-story failing-test evidence precedes implementation evidence; diffs
  confined to ownership sets; integration green evidence present; a Master Agent monitoring
  note present for every wave (`audit/monitoring/*`); Auditor interrogation verdicts
  complete for every wave (each claimed AC exactly `PROVEN` or `DISPUTED`); audit budgets
  respected — **the maxima are read from change state, never assumed**: interrogation rounds
  per subject ≤ `audit.interrogation.max` and negotiation exchanges per disputed AC ≤
  `audit.negotiation.max`, with those values themselves checked against the row
  `rigor-modes.md` §Seeded audit budgets gives the change's current `rigor.mode`
  (`standard` 1 / 1 / 2, `critical` 2 / 2 / 6). A budget seeded above the mode's row is
  itself a VIOLATION — it buys rounds the mode did not pay for. Counters in change-state
  `audit` must match the artifacts on disk.
- QA: every CRITICAL/HIGH finding has a verdict; fix loop within budget; E2E clean-state
  evidence; **determinism repeats present for the modes that require them**
  (`determinism.md`: `standard`/`critical` — the gating suite twice and every
  fix-loop-closing test twice, `critical` also the canonical set twice; `fast` —
  `evidence_reproduced: na` with `reason: rigor:fast`), each repeat with its own evidence
  block; **no quarantined test counted as evidence** — a test in
  `qa/determinism-report.md` appearing as a `PASS` in `ac-matrix.md`, `qa/test-report.md`, or a
  debate defence is a VIOLATION, and so is a red claim re-run until it came back green (a
  repeat is a measurement, never a retry); post captures present; AC matrix complete; a Master Agent monitoring note
  present per QA batch (review, test, verification) (`audit/monitoring/qa-*.md`);
  debate records present
  (`audit/debate/*`) with their budget arithmetic consistent with change-state
  `audit.debate` (exchanges counted in the records equal `exchanges_used`, within `max`);
  tally complete (`qa/tally.md`) with zero unwaived `GAP` rows and no unrouted orphans;
  negotiation log terminal — every disputed AC closed by short-circuit, accept, or
  Supervisor ruling, no dangling `DISPUTED`.
- Delivery: PR body embeds verdict table, funnel, AC matrix, evidence links, the cost summary
  and the one-line reversibility note; CI watched.

## Cost checks (every phase boundary)

Mode-independent, from `cost-governance.md`. Recompute with
`bash .aidd/framework/scripts/aidd-cost.sh` rather than trusting the state numbers:

- `cost/ledger.md` present, with one row per `returned`/`rejected` line in
  `supervision/audit.log` (matched on phase + role + unit) — no missing row, no phantom row.
- `cost.spent_tokens` equals the ledger's last `cum_tokens`; `cost.spent_minutes` equals its
  last `cum_minutes`; `cost.by_phase` sums to both.
- **No `na` justified by cost.** A `quality_gates` value of `na` whose reason names cost,
  budget, tokens, time, or spend is a VIOLATION; the only legitimate `na` reason vocabulary is
  `reason: rigor:<mode>` (plus `reason: cost:no-dispatches` for `within_cost_budget` itself).
  The reason is read from the gate's **object form**, `{status: na, reason: ...}`
  (`gates.md` §The `na` encoding) — an `na` recorded as a bare scalar carries no reason at
  all and is itself the VIOLATION.
- Every `cost.stops` row has a terminal `disposition`; none is still `pending` past the phase
  boundary that recorded it.
- No `source: not measured` row carries a numeric `0` in a token column, and no median was
  computed over one.
- No `cost.budget_*` ceiling changed without either a formula re-derivation history event or a
  `cost.stops` row with `disposition: raised`.

## Verdicts

`COMPLIANT` or `VIOLATIONS` (itemized: rule, evidence of breach, required remediation).
Written to `supervision/<phase>-report.md`; per-phase result mirrored into change-state
`supervision`. Any VIOLATION blocks phase advance until the violated step re-runs. A
repeated violation of the same rule = phase FAIL + human escalation. The final session
report summarizes all phases and appears in the delivery report and PR body.
