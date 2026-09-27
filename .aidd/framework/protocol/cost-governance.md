# Cost Governance

Rigor modes (`rigor-modes.md`) decide how much verification a change **intends** to buy.
This protocol governs what it **actually spends**: a per-change budget, an append-only
ledger of measured dispatch cost, a deterministic projection, three thresholds with three
distinct behaviors, and one quality gate.

The reason the framework needs this: the honest criticism of AIDD Delta is that three
verification layers, exhaustive test teams, adversarial verification, tally, negotiation and
supervision are expensive, and an expensive framework with no visible meter is a framework
people abandon mid-run or route around entirely. A budget nobody measures is a wish. So the
cost is measured per dispatch, projected mechanically, and — when it runs out — the run
**stops and asks**. It never quietly buys itself room by verifying less.

## 1. The budget

Two ceilings per change, seeded the moment the rigor mode resolves (change creation, before
Inception):

| rigor mode | nominal planned dispatches | `budget_tokens` | `budget_minutes` |
|---|---|---|---|
| `fast` | 40 | 1,600,000 | 30 |
| `standard` | 85 | 3,400,000 | 65 |
| `critical` | 140 | 5,600,000 | 105 |

Derived, not measured, by exactly this formula:

```text
budget_tokens  = planned_dispatches × dispatch_allowance_tokens
budget_minutes = ceil(planned_dispatches × dispatch_allowance_minutes / parallelism_divisor)

dispatch_allowance_tokens  = 40000   # one snapshot-pack read + one report, per dispatch
dispatch_allowance_minutes = 1.5
parallelism_divisor        = 2       # conservative: caps are 4 and 6, queues are real
planned_dispatches         = the count the dispatch.md decision table yields for this mode
                             over a nominal 5-story epic
```

**These numbers are seeds, not measurements.** No run in this repository has had its token
cost measured; `bench/harness.md` exists to produce those numbers. When it does, replace
these with measured medians. A seed presented as a measurement would be exactly the
dishonesty the rest of this framework is built to prevent.

Every constant above is tunable in `constitution.md` under a `cost:` block —
`budget_tokens_fast`, `budget_tokens_standard`, `budget_tokens_critical`, the three
`budget_minutes_*` keys, `dispatch_allowance_tokens`, `dispatch_allowance_minutes`,
`parallelism_divisor`. Absent keys fall back to the table above.

### Re-derivation vs. a raise

Two different things, and the difference is what keeps the gate honest:

- **Re-derivation** — at G2 the epic resolves, so `planned_dispatches` is no longer nominal:
  the orchestrator re-runs the formula above with the real story count and writes the result
  to `cost.budget_tokens` / `cost.budget_minutes`. Same formula, better evidence. Recorded as
  a history event; **no** approval needed; the escalation flag is NOT set.
- **A raise** — any other change to a ceiling. Requires a human disposition recorded in
  `cost.stops` (§5). An orchestrator that edits a ceiling without a `stops` row has gamed the
  gate, and the Supervisor itemizes it (§8).

A rigor escalation (`rigor-modes.md`) re-seeds the ceilings **upward** to the new mode's
values and keeps `spent_*` untouched — raising a ceiling never resets a spend, exactly as
raising an audit budget never resets a used count.

## 2. State

Recorded in change state under `cost` (closed object, optional at top level so changes
created before this protocol shipped still validate and are read as un-budgeted):

```yaml
cost:
  budget_tokens: 3400000
  budget_minutes: 65
  spent_tokens: 0          # equals the ledger's last cum_tokens — always
  spent_minutes: 0         # equals the ledger's last cum_minutes — always
  by_phase: {}             # phase -> {tokens, minutes}; sums to spent_*
  projection_tokens: null  # §4; null until the first measured row exists
  stops: []                # append-only [{at, phase, reason, disposition}]
```

`stops[].disposition` is one of `raised`, `reduced-breadth`, `narrowed-scope`, `aborted`,
`aborted-dispatch`, `pending`. `pending` is the only non-terminal value and it means the run
is stopped **right now**, waiting for a human: a change may not reach Delivery with a
`pending` stop.

## 3. Recording duty (the orchestrator's, every dispatch, no exceptions)

**After every dispatch returns**, before the next dispatch starts, the orchestrator appends
exactly one row to `cost/ledger.md` (`../templates/cost-ledger.md`) and folds the row into
`cost.spent_*` and `cost.by_phase`:

| column | value |
|---|---|
| `at` | ISO-8601 UTC seconds, when the dispatch returned |
| `phase` | change-state `phase`, verbatim |
| `class` | the **dispatch-class id** — the `Class` cell of the `dispatch.md` decision-table row that produced this dispatch (`qa5-test`, `con2a-builder`, `inc11-prereview`). Never the `Step` text: step cells are not unique (`QA 1` names two rows) and not atomic (`QA 3, 5, 9`), so grouping cost on them would merge unrelated dispatches |
| `role` | the role file dispatched, without `.md` |
| `unit` | the unit key from the row's deterministic order (`boundary-edge`, `ST-004`, `subject-3`) |
| `tokens_in` | measured input tokens, or `not measured` |
| `tokens_out` | measured output tokens, or `not measured` |
| `minutes` | wall-clock minutes, one decimal — always measurable, the orchestrator has a clock |
| `cum_tokens` | running total of measured tokens only |
| `cum_minutes` | running total of minutes |
| `source` | `measured` or `not measured` |

Rules that make the ledger worth reading:

1. **A runtime that does not expose usage records `not measured`.** Never a zero. Never an
   estimate written into a measurement column. `source: not measured` rows still carry real
   `minutes`, still advance `cum_minutes`, and are excluded from every median in §4.
2. **One row per dispatch.** Every `returned` or `rejected` line in `supervision/audit.log`
   has exactly one ledger row with the same phase, role and unit. A missing row is a
   supervision VIOLATION (§8); so is a row with no audit-log line behind it.
3. **The ledger is append-only.** A correction is a new row whose `unit` names the row it
   corrects; rows are never rewritten. Same discipline as `rigor.escalations` and
   `cost.stops`.
4. **`spent_*` is derived, never asserted.** `cost.spent_tokens` equals the last row's
   `cum_tokens` and `cost.spent_minutes` the last row's `cum_minutes`, always. `by_phase`
   sums to both. `aidd-cost.sh` (§7) recomputes all three from the ledger, which is how the
   Supervisor checks them.

## 4. Projection (deterministic, no model, no guessing)

```text
projection_tokens = spent_tokens + Σ over remaining classes c of ( count(c) × median_tokens(c) )

remaining classes = the dispatch-class ids (dispatch.md `Class` column) the resolved
                    dispatch plans still owe at the CURRENT rigor mode, with count(c) =
                    how many units of class c remain
median_tokens(c)  = median of (tokens_in + tokens_out) over ledger rows with class == c
                    and source == measured
                    tie rule: an even number of rows ⇒ the mean of the two middle values,
                    floored to an integer — so two runs project identically
                    zero measured rows for c ⇒ c contributes 0 and is counted as UNKNOWN
```

When any class is UNKNOWN the projection is reported as a **lower bound** with the unknown
count attached (`projection: ≥ 2,180,000 tokens (3 classes unknown)`). A lower bound
labelled as a total would be a lie by rounding.

`projection_minutes` uses the identical formula over the `minutes` column; it is computed and
printed but not recorded in state — the token projection is the one that decides thresholds
alongside measured minutes.

Recompute after every ledger append. Two runs of the same change with the same ledger and the
same remaining plan produce the same number: there is no smoothing, no weighting, no
learned model, and nothing that depends on the order rows were appended in.

## 5. Three thresholds, three distinct behaviors

| threshold | trips when | behavior |
|---|---|---|
| **soft** | `spent_tokens ≥ 0.70 × budget_tokens` **or** `spent_minutes ≥ 0.70 × budget_minutes` **or** `projection_tokens ≥ budget_tokens` | Report and continue. |
| **hard** | `spent_tokens ≥ budget_tokens` **or** `spent_minutes ≥ budget_minutes` | STOP and ask. Forced-human, both autonomy modes. |
| **runaway** | one dispatch's `tokens_in + tokens_out ≥ 5 × median_tokens(its class)` (needs ≥3 measured rows in the class; with fewer, `≥ 0.25 × budget_tokens` for the single dispatch) — or a bounded loop whose cumulative cost `≥ 3 × Σ` the class medians of its planned iterations | Abort that dispatch (or stop that loop). Record. Never silently retry. |

### soft — report, do not stop

The crossing is reported in the orchestrator's **progress line**, in the existing
`<what happened>` field (≤10 words), e.g. `cost soft threshold crossed 72% tokens`. The
progress-line format in `progress.md` is FIXED and this protocol does not extend it: no new
field, no second line, no prose. The same text lands in `history` like any other progress
line, which is what puts the crossing in the dashboard and in the G3 digest.

Reported once per crossing, not per subsequent step. A soft crossing changes nothing else:
no step is skipped, no breadth is reduced, no gate moves.

### hard — STOP and ask (a forced-human gate in both autonomy modes)

The orchestrator finishes the dispatch in flight, appends its ledger row, then:

1. Sets `phase_status: blocked` and `blocked_reason` to the hard-stop text.
2. Appends `{at, phase, reason, disposition: pending}` to `cost.stops`.
3. Sets the take-care escalation flag (`gates.md` §Uniform mechanism step 2) — the same
   mechanism a rigor escalation uses. In `take-care` the next gate therefore behaves exactly
   like `let-me-look`; in `let-me-look` it already does.
4. Emits the BLOCKED progress line (`progress.md` §2) whose `remediation` names this section.
5. Presents the four dispositions — and nothing else, no recommendation dressed as a fact:

| disposition | what it means | constraint |
|---|---|---|
| `raised` | new ceiling, recorded in the `stops` row | The human states the number. The orchestrator never picks it. |
| `reduced-breadth` | take a cheaper path the **current** rigor mode already permits | ONLY where a protocol already offers the alternative: the sequential dispatch fallback (`dispatch.md`), an unopened debate surface forfeiting its allowance (`test-debate.md`), or the human's own downward rigor pin, which `rigor-modes.md` permits **only before Construction starts and only in `let-me-look`**. It never lowers `rigor.mode` by orchestrator action, and it never touches a floor item. |
| `narrowed-scope` | drop ACs or stories from this change | The dropped items are recorded and the ACs they carried are NOT reported as verified. |
| `aborted` | stop the change | Phase stays `blocked`; nothing is delivered. |

The `stops` row's `disposition` is updated from `pending` to the chosen value, with the
raised ceiling (if any) written to `cost.budget_*` in the same state write. Work resumes only
after that write.

### runaway — abort the dispatch, record it, never silently retry

A single dispatch or a loop iteration blowing past its class median by the stated factor is a
malfunction, not a cost problem: a runaway tool loop, a re-read storm, a subagent that
re-crawled the repo instead of reading the snapshot pack.

1. Abort that dispatch. Append its ledger row with the cost it burned and
   `unit: <unit> (aborted runaway)`.
2. Append a `cost.stops` row with `reason` naming the class, the median, and the multiple.
3. **Do not re-dispatch the same unit automatically.** The unit's remediation ladder in its
   playbook is suspended for that unit until a human disposition is recorded — a silent retry
   of a runaway is how one bad dispatch becomes ten.
4. A loop runaway stops the loop at its current iteration and takes the bounded-loop
   exhaustion path in `state-protocol.md` §Bounded loops: `phase_status: blocked` plus
   `blocked_reason`. It does not consume the remaining iterations first.

## 6. Cost never overrides the floor

A budget stop **pauses work for a human decision**. It is not a licence to verify less.

In every rigor mode, at every threshold, cost pressure never skips: the TDD failing-test
evidence, evidence blocks with real exit codes, disjoint file ownership, the Supervisor's
process audit at every phase boundary, the Critic verdict, the AC matrix, or human approval
at G3 in `let-me-look`. That list is the floor in `rigor-modes.md` §The floor and this
protocol does not touch it. If the budget cannot buy the floor, the change is too big for the
budget — which is a `narrowed-scope` or a `raised` decision for a human, not a quieter run.

## 7. `aidd-cost.sh` — it computes, it never writes state

`core/scripts/aidd-cost.sh` (vendored to `.aidd/framework/scripts/aidd-cost.sh`) reads
`cost/ledger.md`, or a `--json <dir>` of per-dispatch usage files where the runtime writes
those, and prints the ledger summary, the per-class medians, the projection, and the
threshold status. Zero dependencies (bash + python3 stdlib), `--help` on every invocation
path, shellcheck-clean at `-S warning`.

It is a **reader**. It never edits `state.yaml`, never edits the ledger, and never decides a
disposition. The orchestrator is still the single writer (`state-protocol.md` rule 1); this
script exists so the numbers in state can be recomputed from the ledger by anyone, including
the Supervisor.

## 8. Anti-gaming (Supervisor-checkable, mechanically)

The budget must never be met by degrading evidence. The one move that would make that
invisible — recording a step as not-applicable because it was expensive — is **forbidden
outright**:

> **An `na` justified by cost is forbidden.** `na` has exactly one legitimate reason
> vocabulary, `reason: rigor:<mode>` (`gates.md` §Rigor modes and `na`), plus **one named
> carve-out**: `within_cost_budget` itself may record `reason: cost:no-dispatches` (§9), and
> nothing else may ever use it. That carve-out records that **no dispatch ran at all**, which
> is the opposite of a step skipped to save money — there was no spend to judge. Cost pressure
> produces a STOP (§5), never a silent reduction. Any other quality gate recording `na` with a
> reason naming cost, budget, tokens, time, or spend is a supervision VIOLATION, and the gate
> reverts to `pending`.

The Supervisor's phase-boundary checklist (`supervision.md`) checks, mechanically:

1. `cost/ledger.md` exists and has one row per `returned`/`rejected` line in
   `supervision/audit.log`, matching on phase + role + unit — no missing rows, no phantom
   rows.
2. `cost.spent_tokens` equals the last row's `cum_tokens`; `cost.spent_minutes` equals the
   last row's `cum_minutes`; `cost.by_phase` sums to both. (Recompute with `aidd-cost.sh`.)
3. No `quality_gates` value is `na` with a reason naming cost, budget, tokens, time, or
   spend — the sole exception being `within_cost_budget: {status: na, reason:
   cost:no-dispatches}` (§9), which is checkable in one step: an empty ledger.
4. Every `cost.stops` row has a terminal `disposition`; no row is still `pending` at a phase
   boundary past the one that recorded it.
5. No `source: not measured` row carries a numeric `0` in `tokens_in` or `tokens_out`, and no
   median in the printed summary was computed over a `not measured` row.
6. No ceiling in `cost.budget_*` changed without either a formula re-derivation history event
   (§1) or a `cost.stops` row with `disposition: raised`.

## 9. The `within_cost_budget` quality gate

Mode-independent, same shape as every other quality gate
(`pending` | `passed` | `failed` | `na`), set by the orchestrator, and part of the
`quality_gates` object in `core/schemas/change-state.schema.json` — which is the
authoritative set (`gates.md` §Quality gates enumerates all sixteen and points here for this
one's definition; it carries the identical must-be-`passed`-or-`na` rule before Delivery
pushes).

| value | when |
|---|---|
| `passed` | the change closed with `spent_tokens ≤ budget_tokens` and `spent_minutes ≤ budget_minutes` — including against a ceiling raised by a recorded, approved `raised` disposition |
| `failed` | a hard stop is unresolved: a `cost.stops` row still `pending`, or spend past a ceiling with no approved raise |
| `na` | no dispatch ran, so no ledger row exists (an aborted change) — with `reason: cost:no-dispatches` |

`na` is available for **no other reason**. In particular a runtime that exposes no token
usage does not earn `na`: `minutes` is always measurable, so the wall-clock ceiling is always
enforceable, and the gate is decided on it. "We did not track cost" is not an `na`; it is a
missing ledger, which is a VIOLATION.

## 10. Where cost is reported

- **Progress line** — soft crossings only, inside `<what happened>` (§5).
- **Gate digests** — G2 and G3 carry one line: spent / budget / projection, and any `stops`
  row (`gates.md` §Uniform mechanism step 1).
- **PR body** — the `## Cost` and `## Reversibility` sections of
  `../templates/pr-description.md`, filled from the ledger summary per
  `../playbooks/50-delivery.md` step 3.
- **Dashboard** — the **Rigor & cost** section of `../templates/dashboard.html`, rebuilt on
  every state write: the rigor mode, spend against both ceilings, the projection, and the
  `stops` count with its unresolved tally. An absent `cost` block reads `not recorded` and an
  unmeasured projection reads `not measured` — the dashboard never shows a `0` nobody
  measured.
- **`/aidd:cost`** — on demand, any time, read-only.
