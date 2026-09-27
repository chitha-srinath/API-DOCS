# Continuous Test-Debate Protocol

Test designs and test results are contested before they are trusted — bounded
challenge/response exchanges over three surfaces of the QA testing pass, never live
dialogue. Artifacts are the only inter-agent channel.

The debate is continuous: it opens BEFORE any case is executed, runs again as each
category's results land, and closes over the consolidated report. Weak coverage is caught
before the execution spend, not after it.

## Surfaces

Three, in pipeline order (`../playbooks/40-qa.md`):

1. **Design debate** — step 4, before execution. Test Engineers publish their TC matrices
   (designed, not yet executed); the Master Agent and the Auditor challenge coverage —
   missing edge cases, weak AC mapping, wrong flows — in ONE batched challenge artifact per
   exchange, covering every category under review. Testers amend their matrices or defend
   them. Max **2 exchanges** on this surface.
2. **Execution debate** — inside step 5, as each category's results land. The Auditor may
   contest specific TCs: wrong assertion, mocked path where real proof was demanded, PASS
   resting on a case that was never actually run. The owning tester re-executes ONLY the
   contested TCs — never the whole category. Contests are batched per dispatch wave, not
   per category. Max **2 exchanges TOTAL on the surface** (not 2 per category).
3. **Results debate** — step 10, over the consolidated `qa/test-report.md`. Disputed PASSes
   are re-proven live (see below). Max **2 exchanges** on this surface.

## Accounting unit

One exchange = one challenge artifact plus its response, as a pair. A batched design-debate
round covering every category in one challenge artifact counts as **1 exchange**, not one
per category; the same holds for a batched execution wave and a batched results challenge.

Exchange numbers are drawn from the shared pool and are globally unique within the change. A
batched challenge writes the SAME exchange number into every category record it touches, so
the count of DISTINCT exchange numbers across `audit/debate/*` equals change-state
`audit.debate.exchanges_used` — rows are not exchanges.

## Budget

Shared pool: **6 exchanges per change**, all three surfaces drawing from it. Per-surface
caps: design **2**, execution **2** (total on the surface), results **2** — 2+2+2 fully
subscribes the pool.

- The shared cap **strictly dominates** every per-surface allowance: with the pool empty no
  surface opens another exchange, even with its own allowance unspent. This dominance only
  binds when `audit.debate.max` is seeded below the 2+2+2 sum; at the shipped default of 6,
  pool and per-surface sum coincide, so a fully-subscribing run never hits the shared cap
  before its own per-surface caps.
- Surfaces draw in pipeline order — design first, then execution, then results.
- Unused exchanges do **not** roll over: an unspent design exchange never raises the
  execution or results allowance above 2.
- The `/6` in each record's arithmetic line (`pool <used>/6`) is the shipped default; the
  denominator always follows `audit.debate.max`, not a hardcoded 6.

Tracked in change-state `audit.debate.exchanges_used` against `audit.debate.max` (schema
shipped, seeded 6). This counter is **per change** and is never reset between surfaces or
between categories — unlike `../protocol/interrogation.md` rounds and
`../protocol/negotiation.md` exchanges, which the orchestrator resets per subject and per
disputed AC.

## Artifact layout

Written under `.aidd/changes/<id>/audit/debate/`:

```text
<category>.md
```

One record per test category (`functional-happy-path` … `performance-smoke`), maintained
across all three surfaces — never a file per surface. Append-only governs the Exchanges
rows and the AC-mapping rows: new rows are added, never overwritten. The budget-arithmetic
line is the one exception — orchestrator-owned, it is written or refreshed once per
surface close (not appended as a new row) so it always carries the current change-global
count. Template: `../templates/debate-record.md`.

Ownership inside a record is strict: challengers append their own challenge rows, the owning
Test Engineer appends its own responses, and the orchestrator owns the budget-arithmetic
line, the AC-mapping dispositions, and the change-state counter. No role edits another's
entries.

An uncontested category still gets its record with an empty exchange table, carrying the same
change-global arithmetic line — which reads `pool 0/6` only when nothing at all was contested.
The budget-arithmetic line is CHANGE-GLOBAL: `design <n>/2 · execution <n>/2 · results <n>/2`
are surface-global counts — total exchanges spent on that surface across the whole change,
mirroring per-surface spend, not per-category — and the identical line is written into every
category's record. Silence is recorded, not assumed: this protocol requires a record per
category; the Supervisor's checklist (`../protocol/supervision.md`) verifies records are
present with consistent arithmetic, so a missing record is a process violation rather than
evidence of an uncontested matrix.

## Challenge

A challenge names, per contested item: the surface, the TC id(s) contested, the claim (what
is wrong, concretely), the **AC id(s)** the contested test evidences, and the exact
amendment or proof demanded. Vague challenges are invalid by format, the same rule as
`../protocol/interrogation.md`: "coverage looks thin" is rejected; "TC-BND-004 asserts on
the mock, not the persisted row — re-execute against the real store and paste the row" is
not.

Challengers by surface: design — Master Agent and Auditor, folded into one batched
artifact; execution — Auditor; results — Auditor, with the Master Agent's quality read
folded into the same artifact where it has one.

## Response

The orchestrator re-dispatches the owning Test Engineer (`../roles/test-engineer.md`) to
answer — its OWN category's TCs only, never another tester's. Every item closes as exactly
one of:

- **amended** — the challenge holds. The matrix gains or corrects the cases, or the
  contested TCs are re-executed by the demanded method, with evidence blocks per
  `../protocol/evidence.md`. An amendment that exposes an executed FAIL becomes a fix-loop
  defect, same as any other FAIL.
- **defended** — the challenge does not hold. The tester cites the existing TC ids, their
  `ac_ids`, and the executed evidence that already covers the claim. Assertion is not a
  defence: a defence missing an evidence block is rejected once with "evidence missing", and
  a second miss on the same item leaves the item still-contested.

## Live re-proof (results surface)

A disputed PASS in `qa/test-report.md` is re-proven at the time of the dispute, never merely
re-cited from the original run:

1. **Playwright MCP** — UI-facing flows are re-driven in a real browser through the
   Playwright MCP server; the screenshots are attached as that item's evidence.
2. **CLI/API transcript** — non-UI flows re-run their command, captured as an evidence block
   (`../protocol/evidence.md`).
3. **Fallback** — a runtime without Playwright MCP falls back to the vendored
   `../templates/playwright-capture.mjs` script. Which path ran, and why, is recorded in the
   record's `Degradation` note: explicit degradation, never silent.

A disputed PASS that no available path can re-prove is NOT defended — it stays contested and
resolves by the exhaustion rule below.

## AC mapping

Mandatory. Every debate item cites the AC id(s) the contested test evidences — TCs already
thread `ac_ids` through the story that owns them.

- On exhaustion (the surface allowance or the shared pool is spent with the item still
  contested), the item marks its mapped AC(s) **DISPUTED**, and that AC enters
  `../protocol/negotiation.md` as a normal disputed AC — same ladder, same budget, same
  terminal rulings (`PROVEN | DEFECT | UNRESOLVABLE`).
- A contested item with **no** AC mapping (a `performance-smoke` observation, a style note)
  is recorded as **advisory**: it never blocks and never enters negotiation.

## Termination

No item and no surface stays open. Every item ends as exactly one of **amended**,
**defended**, **DISPUTED** (exhausted, AC-mapped), or **advisory** (exhausted, unmapped). A
surface is closed once every item on it holds one of those four dispositions — reached by
response, or forced by exhaustion when the surface allowance or the shared pool is spent.

A surface with no further challenge opened is treated as exhausted for its remaining items —
the orchestrator declares the remaining allowance forfeit (it does not roll over) and applies
the exhaustion rule to still-contested items.

## Gate

The orchestrator sets `debate_complete` — the protocol's ONLY setter — once all three
surfaces are closed within budget: every record present with its budget-arithmetic line,
every item terminal, the pool not overdrawn, and the distinct exchange count equal to
`audit.debate.exchanges_used`. A surface left open, an overdrawn pool, or arithmetic
disagreeing with change state fails the gate. Three surfaces closing with **zero** exchanges
spent — nobody found anything to contest — is a legitimate `passed`, provided the records say
so; `na` is reserved for a change whose QA pass ran no test categories at all. It is a mode-independent quality gate —
autonomy modes modulate human approval, never this (`../protocol/gates.md`).

## Learning feed

A debate outcome that invalidates a test design — an amended matrix a challenge exposed as
wrong, a defence the live re-proof refuted — is a retro input exactly like a REFUTED
finding: the Retro Learner distils it into `learnings.md` per `../protocol/learning.md`.
