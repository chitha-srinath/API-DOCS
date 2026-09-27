# Escape Analysis

Every layer in this framework verifies **forward**: reviewers judge a diff, testers execute a
matrix, the Auditor interrogates a claim, the Supervisor audits the process. Nothing in
v0.3.0 looked **backward** at a defect that got through all of it.

That gap is the industry's, not just this framework's. Detection claims are published; the
misses are not. A framework that only ever counts what it caught is marketing. This protocol
is the counter-metric: when a defect reaches production — or is found after merge at all —
it determines **which layer should have caught it and why it did not**, produces a permanent
regression test and a concrete protocol amendment, and records the miss where the framework's
own numbers have to live next to it.

An escape is not a failure of the run. Not knowing which layer went blind is.

## 1. Trigger and scope

Escape analysis starts when either happens:

- `/aidd:escape <description | issue-url | change-id>` is invoked on a **merged** change; or
- a post-merge bug report (issue, incident, Jira ticket, support escalation) references an
  AIDD change id, or names code an AIDD change delivered.

It runs **outside the phase machine**. The change is `done` and usually archived
(`changes/_archive/<id>/`). Escape analysis therefore:

- does NOT re-open the change's phase, re-run a gate, or flip a quality gate;
- does NOT block anything — it is retrospective by construction;
- DOES append to that change's state (`escapes`, §6) and to the repo-level register (§7),
  under the same single-writer rule as every other state write (`state-protocol.md` rule 1).

### Attribution first, analysis second

Before any layer is judged, the orchestrator establishes that an AIDD change actually
produced the defective code:

1. Locate the defective line(s); `git log -S'<token>'` / `git blame` back to the commit.
2. Map the commit to its change (branch `aidd/<change-id>`, or the change id in the commit or
   PR body).
3. No AIDD change owns it ⇒ record the escape in the register with
   `verdict: out-of-scope (not produced by an AIDD change)` and **stop**. The framework is not
   credited for code it never processed, and it is not blamed for it either.

The escape id is `E-NNN`, assigned in register order, and never reused.

## 2. The Escape Analyst

One dispatch, sequential, `stage_class: adjudicative`, read-only over the repo and the change
folder, writing only its own report (`../roles/escape-analyst.md`). Its inputs are the escaped
defect (reproduction, symptom, the fix if one exists) and the change's complete artifact set:
`prd.md`, `stories/*`, `pre-review/*`, `qa/findings*`, `qa/verdicts.md`, `qa/tests/*`,
`qa/test-report.md`, `qa/verification-report.md`, `qa/tally.md`, `qa/critic-verdict.md`,
`ac-matrix.md`, `audit/*`, `evidence/*`, `supervision/*`, and change state.

## 3. The per-layer verdict table (mandatory, every row, every time)

The Analyst produces exactly these nine rows. A row is never omitted, never merged with
another, and never left blank — "we did not consider that layer" is the failure this table
exists to make impossible.

| layer token | what it covers |
|---|---|
| `L1-review` | Reviewer findings — name the dimension(s): `correctness`, `security`, `performance`, `test-coverage`, `spec-compliance`, the `delta` bindings, and the pre-review dimensions |
| `L1-tests` | Test Engineer categories — name the category that owned this defect class |
| `L2-auditor` | Auditor interrogation of the AC that covers the defective behavior |
| `L2-tally` | Work-item reconciliation and the orphan-diff scan |
| `L2-debate` | Test debate, all three surfaces (design, execution, results) |
| `L3-supervisor` | Process compliance over the super-context |
| `critic` | The consolidated pre-merge verdict |
| `e2e-mutation` | Clean-state E2E and mutation testing |
| `evidence-capture` | Pre/post capture, the manifest, and the perf budget |

The first six tokens are byte-identical to the `visible_to` vocabulary in `bench/harness.md`,
so a benchmark defect and a production escape are described in the same words. The last three
extend it: escape analysis covers layers a defect catalogue's `visible_to` does not enumerate.

Every row carries four columns:

| column | rule |
|---|---|
| `should_have_caught` | `yes` \| `no`. `yes` requires naming the artifact that **would** have carried the catch — `qa/findings-correctness.md`, `qa/tests/boundary-edge.md`, `audit/interrogation/<subject>-verdict.md`. A `yes` with no named artifact is invalid by format. |
| `did` | `yes` \| `no`. `yes` is possible **and important** — the **caught-then-dropped** case: the layer flagged it and the flag was dropped, REFUTED by adversarial verification, waived at a gate, downgraded to advisory, or closed by a negotiation ruling. A `did: yes` escape is a *disposition* failure, not a detection failure, and it is the more dangerous kind. |
| `why_missed` | Concrete, citing the artifact that was blind **by path** and stating what it actually contained. "Not applicable", "out of scope", and "insufficient coverage" are rejected by format. For `did: yes`, cite the verdict, waiver, or ruling that dropped the finding. |
| `preventable_by` | One specific, **minimal** change to a named protocol, role, checklist, or test-matrix file — file path plus the sentence or row to add. "More review", "be more careful", and "raise the rigor mode" are rejected by format. `—` is allowed only on rows whose `should_have_caught` is `no`. |

### The honest verdict: `no-layer-at-reasonable-cost`

Every row `should_have_caught: no` is a **legitimate and important** outcome, not a failure to
analyze. It is not a default: claiming it requires the report to state

1. what *would* have caught the defect (the specific technique — a property-based test over a
   space of 2³², a production-traffic replay, a formal proof, a week of soak testing), and
2. the cost of running that on every change, and
3. why that cost is not worth paying here.

A `no-layer-at-reasonable-cost` verdict still produces the regression test (§4). It is the
verdict that keeps the other verdicts honest: without it, every escape becomes a new checklist
row, and the framework accretes ritual until nobody runs it.

## 4. Two mandatory outputs

### (a) A permanent regression test — non-negotiable

A test lands in the repository that **fails on the escaped defect and passes after the fix**.
This is the framework's own proof it will not recur, and it is required for both verdicts.

- The Analyst **specifies** it exactly: file path, test name, the reproduction input, the
  assertion, and the AC (or invariant) it binds to. The Analyst does not write product code or
  product tests — it is read-only outside its report.
- The test is **authored under the normal TDD rule** by a Builder inside the fix change
  (`../playbooks/30-construction.md` step 2b): observed RED against the defective code, GREEN
  after the fix, both as evidence blocks (`evidence.md`). A regression test that was never
  observed red proves nothing and does not close the escape.
- The fix change's rigor mode is **at least** the escaped change's mode. A defect escaped that
  mode; buying less verification for the fix is indefensible.
- The escape is not `closed` in the register until the RED and GREEN evidence blocks exist and
  the report cites them.

### (b) A protocol amendment proposal — a proposal, never an auto-apply

A concrete, diff-level suggestion against a **named** file: `core/protocol/<x>.md`,
`core/roles/<y>.md`, a playbook checklist, or the test-matrix in
`core/roles/test-engineer.md`. It states the file, the anchor (section or table), and the
exact text to add or change — minimal, so a human can accept or reject it in one reading.

It is recorded twice:

1. In the escape report's `## Amendment` section, with the diff-level text; and
2. appended to `learnings.md` as an ordinary `L-NNN` entry via the existing learning loop
   (`learning.md`, `../roles/retro-learner.md`) — same format, same dedupe, with
   `evidence: <escape report path>` and the escape id in the context line.

> **Amendments are never applied automatically.** No agent edits a protocol, role, playbook,
> or checklist file because an escape suggested it. A human reads the proposal and decides.
> The protocol says this plainly because the alternative — a framework that rewrites its own
> rules in response to every incident — accretes unreviewed rules faster than anyone can audit
> them, and the rules are the only thing making the framework trustworthy.

`no amendment proposed` is a valid value for (b) — only under the
`no-layer-at-reasonable-cost` verdict, and only with the cost argument from §3 stated.

## 5. Repeat escapes escalate; they do not re-propose

A new escape is a **repeat** when its `defect_class` matches an earlier escape in the register
**and** it names a layer already recorded blind for that class.

A repeat means the last amendment was insufficient — or was never applied. The protocol is
then:

1. Set `repeat_of: E-NNN` on the new escape.
2. **Do not re-propose the same amendment.** Repeating a proposal that already failed to
   prevent the defect is how a framework generates noise instead of learning.
3. Escalate to a human, in the report and in the register, with exactly four facts: the prior
   escape id, the prior amendment text, whether it was ever applied (cite the commit or state
   `not applied`), and the evidence that it did not prevent recurrence.
4. Record `disposition: escalated`. A repeat is never closed by an agent.

The Retro Learner does the same: a repeat is flagged for human escalation, never distilled
into another lesson that says the same thing (`learning.md`).

## 6. State

Appended to the merged change's state under `escapes` (closed objects, optional at top level,
append-only). Appending does **not** re-open the phase and does not touch any gate:

```yaml
escapes:
  - id: E-001
    at: "2026-09-14T09:20:00Z"
    defect_class: race            # shared vocabulary, see bench/harness.md
    verdict: layer-blind          # layer-blind | no-layer-at-reasonable-cost | out-of-scope
    blind_layers: [L1-tests, L2-debate]
    regression_test: "tests/test_store_append.py::test_concurrent_append_keeps_all_rows"
    amendment: "core/roles/test-engineer.md: add a concurrent-writer row to state-concurrency-idempotency"
    report: "escapes/E-001-store-append-race.md"
    repeat_of: null
```

`blind_layers` lists exactly the rows whose `should_have_caught` is `yes` and whose `did` is
`no` — the machine-readable form of the table, and the input to the blindness metric.

## 7. The register and the two metrics

`.aidd/escapes/register.md` is the repo-level, append-only index, created from
`../templates/escape-register.md`: one row per escape (id, date, change id, defect class,
verdict, blind layers, regression test, amendment, disposition, `repeat_of`), plus a
`## Metrics` section recomputed on every append.

**Escape rate** — how often a delivered change turns out to have carried a defect:

```text
escape_rate = escapes attributed to AIDD changes in the window
              ---------------------------------------------------
              AIDD changes merged in the window

window = the last 20 merged changes (default; tunable in constitution.md as
         cost-free `escapes.window_changes`)
```

**Layer blindness** — per layer, how often it should have caught an escape and did not:

```text
blindness(layer) = escapes in the window whose blind_layers include <layer>
                   ------------------------------------------------------------
                   escapes analyzed in the window
```

Reporting rules, both metrics:

- **Always print the numerator and the denominator.** A bare percentage over 3 escapes is a
  number pretending to be evidence.
- A window with no analyzed escape reads `not measured` — never `0%`. Zero measured escapes is
  not a zero escape rate; it is an absence of data, and the same rule the cost ledger uses for
  unmeasured usage (`cost-governance.md` §3) applies here.
- These are the **honest counter-metric** to every detection claim the framework makes. Any
  document that reports what AIDD caught must be readable next to this register; a detection
  number published without its escape rate is an unfalsifiable claim.

The benchmark harness in `bench/` consumes the same `defect_class` vocabulary and the same
layer tokens (`bench/harness.md`), so an injected defect that a layer misses in the benchmark
and a production defect that the same layer misses in the field are counted in one language.

## 8. Flow (mechanical)

1. Attribute the defect to a change (§1). Out of scope ⇒ register row, stop.
2. Assign `E-NNN`; classify with a `defect_class` from the shared vocabulary.
3. Dispatch the Escape Analyst (one unit, sequential) → `escapes/E-NNN-<slug>.md` from
   `../templates/escape-report.md`.
4. Check the register for a repeat (§5). Repeat ⇒ `repeat_of` + escalate, and skip re-proposal.
5. Route output (a): the regression test specification into the fix change (a new AIDD change
   at ≥ the escaped mode), authored TDD by a Builder, RED then GREEN.
6. Route output (b): the amendment into the escape report AND `learnings.md`. Never applied by
   an agent.
7. Append the `escapes` row to the change's state; append the register row; recompute metrics.
8. Dispatch the Retro Learner as a **retro addendum** (`../playbooks/60-retro.md`) so the
   escape's lessons land in the same `learnings.md` as every other lesson — one learning loop,
   extended, not a second one.

Each of those eight steps emits one progress line in the ordinary format (`progress.md` §1).
Because an escape run sits outside the phase machine there is no change-state `phase` to
print, so `<phase>` carries the literal `escape` and `<total>` is the eight steps above:

```text
[escape 3/8] E-001 attributed to 2026-07-29-user-auth · escapes/E-001-store-append-race.md · gates: 0/0 · rigor: - · next: repeat check
```

`gates: 0/0` because escape analysis opens no gate, and `rigor: -` because the escape run
itself has no rigor mode — the mode belongs to the **fix** change the regression test lands
in (§4a), which is at least the escaped change's.

## 9. What escape analysis must never become

- **Not a blame ritual.** The subject is the layer that went blind, never the agent, and never
  the human who approved the gate.
- **Not an auto-patcher.** §4(b) is a proposal. A human decides.
- **Not a rigor ratchet.** "Raise everything to `critical`" is rejected by format as a
  `preventable_by` value: it is not minimal, not specific, and not a change to a named file.
- **Not optional when the answer is uncomfortable.** `no-layer-at-reasonable-cost` is a
  supported verdict precisely so that the honest answer never has to be dressed up as a
  process gap.
