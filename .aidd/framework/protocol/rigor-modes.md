# Rigor Modes

How much verification a change earns. Three modes — `fast`, `standard`, `critical` — each
selected by a deterministic classifier from the change's own evidence, never by feel.

Rigor is **orthogonal to autonomy** (`autonomy-modes.md`): autonomy decides WHO approves
(the human at the gates, or `auto`); rigor decides HOW MUCH verification runs before there
is anything to approve. A `take-care` change can be `critical`; a `let-me-look` change can
be `fast`. Neither setting is ever derived from the other.

The reason the framework needs this: three verification layers, exhaustive test teams,
adversarial reviewers, tally, negotiation and supervision are right for an auth bypass and
excessive for a button label. Cost proportional to risk — with a floor that never moves.

## The three modes

| Surface | `fast` | `standard` (default) | `critical` |
|---|---|---|---|
| Layer 2 (Master Agent, Auditor, Tally) | OFF | full cadence | full cadence |
| Interrogation rounds per subject | — | 1 | 2 |
| Negotiation exchanges per disputed AC | — | 1 | 2 |
| Test-debate surfaces | — | design only, 2 exchanges | design 2 · execution 2 · results 2 (pool 6) |
| Pre-review dimensions | 2 (feasibility, pattern-fit) | 4 | 4 |
| Post-review dimensions | 2 (correctness, spec-compliance) | 5 + `delta` | 5 + `delta` |
| Security Auditor | `na` | dispatched | dispatched |
| Test categories | 2 (functional-happy-path, regression-compat) | 5 | 8 |
| Adversarial verification | only once a CRITICAL is raised | every CRITICAL/HIGH | every CRITICAL/HIGH |
| E2E clean-state + mutation | `na` | E2E + mutation | E2E + mutation |
| Evidence capture | build/suite transcript only | pre + post + manifest | pre + post + manifest |
| Critic + Supervisor | ALWAYS | ALWAYS | ALWAYS |

### Seeded audit budgets

Budgets are seeded into change state the moment the mode resolves. This table is the
authority — `core/templates/change-state.yaml` seeds the row for its own `rigor.mode`, and
`tests/rigor.test.sh` reads both and fails if they disagree:

| rigor mode | `audit.interrogation.max` | `audit.negotiation.max` | `audit.debate.max` |
|---|---|---|---|
| `fast` | — | — | — |
| `standard` | 1 | 1 | 2 |
| `critical` | 2 | 2 | 6 |

`fast` seeds nothing — Layer 2 never runs, whatever the template carries stands unused, and
every Layer-2 quality gate records `na` with its reason (`gates.md` §The `na` encoding).

## Mode detail

### `fast`

Trivial, reversible, non-functional change: copy, label, comment, docs, formatting.

- Layer 2 is OFF — no Master Agent monitoring dispatch, no Auditor interrogation, no
  Tally, no test debate. `auditor_approved`, `debate_complete`, `tally_reconciled` record
  `na` with `reason: rigor:fast` (`gates.md`).
- Reviewer `mode: post` covers `correctness` and `spec-compliance` only; no `mode: delta`
  dispatch; no Security Auditor — `security_clean: na`, same reason.
- Test Engineer covers `functional-happy-path` and `regression-compat` only.
- Adversarial verification does not run unless a reviewer raises a CRITICAL. One CRITICAL
  and that finding is verified like any other — and the escalation rule below fires.
- No clean-state E2E, no mutation testing (`e2e_verified`, `mutation_floor_met`: `na`); no
  pre/post evidence capture beyond the build + suite transcript recorded as an evidence
  block (`evidence.md`) — `evidence_captured` and `perf_within_budget`: `na`.
- The Critic (QA step 16) and the Supervisor (every phase boundary) still run. They are
  cheap, and they are the honesty backstop: no mode removes them.

### `standard`

The default, and the mode most changes get. Everything the framework ships, at reduced
breadth:

- Test debate opens the **design surface only**, max 2 exchanges, and `audit.debate.max`
  is seeded `2`. The execution and results surfaces open no exchange: their allowance is
  forfeit under the shared-cap dominance and exhaustion rules of `test-debate.md`, each
  record noting `not opened (rigor:standard)`. Items still terminate — amended, defended,
  DISPUTED, or advisory — so `debate_complete` is earned, never waived.
- Auditor interrogation: **1** round per subject. The round-1 verdict is final.
- Negotiation: **1** exchange per disputed AC; exhaustion escalates to Supervisor
  adjudication exactly as in `critical`.
- Test categories: **5** — `functional-happy-path`, `negative-error-handling`,
  `boundary-edge`, `api-contract`, `regression-compat`. The three left out
  (`impossible-abuse`, `state-concurrency-idempotency`, `performance-smoke`) are recorded
  as not-run with `reason: rigor:standard` in `qa/test-report.md`.
- Everything else — all three Layer-2 agents, all 5 post dimensions plus `delta`, the
  Security Auditor, adversarial verification of every CRITICAL/HIGH, clean-state E2E,
  mutation testing, full pre/post evidence, tally — runs unchanged.

### `critical`

The full machinery, exactly as v0.3.0 specifies it: interrogation 2 rounds per subject,
negotiation 2 exchanges per disputed AC, debate 2 + 2 + 2 under a shared pool of 6, all 8
test categories, mutation testing, full evidence capture, and all three Layer-2 agents at
full cadence. Nothing in this file reduces anything in `critical` mode.

## Classifier (deterministic)

Selection is evidence-based. The orchestrator matches the tables below mechanically
against the **classified surface** and records which row matched.

The classified surface is whatever the change has actually produced at the moment of
classification — the same tables read three progressively better sources:

| When | Classified surface |
|---|---|
| Change creation (before Inception) | the verbatim intent, any path or component it names, the Jira ticket's labels/components |
| G2 (plan resolved) | the epic's `file_scope` ownership sets ∪ `impact-report.md` reach ∪ every story's `risk` marker |
| Construction / QA | the actual diff (`git diff --name-only` against the base) ∪ the above |

Re-classification at a later surface can only raise the mode (see Escalation). It never
lowers it.

### `critical` triggers — ANY one is sufficient

| Trigger class | Path-pattern hints (match mechanically) |
|---|---|
| authn / authz | `**/auth/**`, `**/login*`, `**/signup*`, `**/session*`, `**/token*`, `**/permission*`, `**/role*`, `**/rbac/**`, `**/*guard*`, `**/middleware/auth*` |
| secrets / crypto | `**/crypto/**`, `**/*secret*`, `**/*credential*`, `**/keys/**`, `.env*`, `**/*.pem`, `**/*.key`, `**/*hash*`, `**/*encrypt*` |
| money / billing / pricing | `**/billing/**`, `**/payment*/**`, `**/pricing/**`, `**/invoice*`, `**/subscription*`, `**/checkout*`, `**/*stripe*`, `**/*tax*` |
| tenant isolation / multi-tenancy | `**/tenant*/**`, `**/organization*/**`, `**/workspace*/**`, row-level-security policies, any query whose scoping predicate the diff touches |
| data migration / deletion | `**/migrations/**`, `**/alembic/**`, `**/*migration*`, `**/seeds/**`, any `*.sql` containing `DROP`, `DELETE`, `TRUNCATE` or `ALTER`, any hard-delete path |
| PII handling | fields named `email`, `phone`, `address`, `dob`, `ssn`, `national_id`; export/report generators; anything that logs, forwards, or persists those fields |
| public API contract | `**/openapi*`, `**/*.proto`, `**/schema.graphql`, `**/routes/**`, `**/api/**`, published SDK surface, exported `**/*.d.ts` |
| concurrency / locking | `**/*lock*`, `**/*mutex*`, `**/*queue*`, `**/worker*/**`, `**/*transaction*`, `**/*idempot*`, any change to thread/async primitives |
| infra / deploy config | `Dockerfile*`, `**/k8s/**`, `**/helm/**`, `**/terraform/**`, `**/*.tf`, `.github/workflows/**`, `**/nginx*`, `**/*.service` |

Plus, independent of paths:

- any story in `epic.md` (or its story file frontmatter) carries a `risk: critical` marker;
- the intent, PRD, or Jira ticket names a security or compliance concern — vulnerability,
  CVE, pen-test finding, audit finding, GDPR, HIPAA, SOC 2, PCI, data breach.

### `fast` requires ALL of

- every path on the classified surface matches the fast allow-list: `**/*.md`, `docs/**`,
  `**/*.txt`, comment-only hunks, i18n/copy resources (`**/locales/**`, `**/*.strings`,
  `**/i18n/**`), formatter/lint autofix-only hunks (whitespace, import order), and
  test-only files (`tests/**`, `**/*_test.*`, `**/*.test.*`, `**/*.spec.*`);
- no acceptance criterion describes a behavior change — every AC is about text, docs,
  formatting, or test scaffolding;
- zero `critical` triggers matched.

### Everything else is `standard`

Three tie-breaks, all resolving upward:

1. A path matching both the fast allow-list and any `critical` trigger is `critical`
   (a `tests/auth/**` change to an authz test is `critical`, not `fast`).
2. A surface the tables do not decide is `standard`. The classifier never guesses `fast`.
3. A surface with no readable evidence at all (empty intent, no paths named) is `standard`,
   and the reason records `classifier: insufficient evidence`.

## Escalation — one-way and automatic

Evidence appearing mid-run that the change is riskier than its current mode escalates the
mode UP: `fast` → `standard` → `critical`. **Never down.** De-escalation does not exist —
not by classifier, not by the human, not at a gate.

Triggers (any one, at any point in the run):

- a CONFIRMED adversarial-verification finding whose file matches a `critical` trigger row;
- any security finding — a `qa/security-report.md` entry, or a `security` dimension finding
  that survives verification as CONFIRMED or PLAUSIBLE;
- a DISPUTED AC (`interrogation.md`) on a `critical`-trigger path;
- the diff growing outside the classified surface into a `critical`-trigger path — a Build
  Fixer's cross-ownership repair, a backflow delta story, a seam story;
- a story acquiring a `risk: critical` marker in backflow;
- a CRITICAL raised in a `fast`-mode change (any CRITICAL at all: `fast` presumes there is
  nothing to find).

On escalation the orchestrator, in this order:

1. Writes `rigor.mode` to the new mode, appends the `rigor.escalations` row
   (`from`, `to`, `trigger`, `at`), and records a history event.
2. Re-seeds the audit budgets to the new mode's values. Counters already spent are kept —
   raising a max never resets a used count.
3. Flips every quality gate recorded `na` with `reason: rigor:<old-mode>` back to
   `pending`: an `na` earned by a mode the change has outgrown is void, and the gate must
   now be earned.
4. Re-runs the steps the new mode requires that the old mode skipped or ran at a lower
   budget, per the back-fill table below. Steps already run at or above the new mode's
   budget are NOT re-run.
5. Sets the take-care escalation flag (`gates.md`) — a mode escalation means the risk
   assessment changed, and the human is told at the next gate in both autonomy modes.

### Back-fill table

| Transition | Steps to re-run in the new mode |
|---|---|
| `fast` → `standard` | Construction: Master Agent monitoring + Auditor interrogation over every closed wave's Builder Reports. QA: step 1 remaining post dimensions + `mode: delta` + Security Auditor; step 3 adversarial verification of every CRITICAL/HIGH; step 4 design debate; step 5 the three added test categories; step 7 clean-state E2E + mutation; step 8 pre/post evidence (`pre` re-captured against the pre-construction snapshot, degradation noted if the baseline is gone); step 11 Tally; step 12 Auditor final audit. Inception's pre-review is NOT re-run once G2 has passed — the impact-report and ownership sets it produced are what re-classified the change. |
| `standard` → `critical` | Interrogation: re-open round 2 for every subject whose round-1 verdict left an AC DISPUTED. Negotiation: raise to 2 exchanges; any AC closed by a ruling stays closed. Debate: raise the pool to 6 and open the execution and results surfaces. Testing: dispatch `impossible-abuse`, `state-concurrency-idempotency`, `performance-smoke`. Nothing already proven is re-proven. |
| `fast` → `critical` | Both rows above, in order. |

A back-fill step's own dispatch plan comes from `dispatch.md` like any other — the
orchestrator resolves it once and records it.

## The floor (inviolable in every mode)

Rigor mode reduces **breadth**, never **honesty**. In `fast` exactly as in `critical`:

- TDD evidence — a failing test before green, per story, cited in the Builder Report
  (`../playbooks/30-construction.md` step 2b);
- disjoint file ownership and builder confinement (`file-scope.md`);
- evidence blocks with command, trimmed output, exit code, timestamp (`evidence.md`) —
  no assertion stands in for a run;
- the Supervisor's process audit at every phase boundary (`supervision.md`), and its
  VIOLATIONS verdict blocking phase advance;
- the Critic verdict (`../roles/critic.md`) and the `critic_approved` gate;
- human approval at G3 in `let-me-look`, and every forced-human escalation flag in
  `take-care` (`gates.md`);
- the gate ledger with artifact hashes and staleness (`gates.md`);
- honest `na`: a step a mode skips is recorded in the object form
  `{status: na, reason: rigor:<mode>}` — the canonical encoding is `gates.md`
  §The `na` encoding, and the schema accepts nothing else that carries a reason. Never
  silently absent, never reported as passed.

A mode that would require dropping any floor item is not a mode; it is a bug. The
Supervisor treats a missing floor artifact as a VIOLATION regardless of rigor mode.

## Human override

`/aidd:rigor <mode>` sets the mode explicitly. An explicit user choice **pins** it: the
classifier no longer re-classifies at later surfaces, `rigor.selected_by` becomes `user`,
and `rigor.reason` records the user's words verbatim. A pin still allows escalation — the
triggers above fire regardless of who chose the mode — and an escalation over a pin
records both the pin and the override in `rigor.escalations` plus a history event.

Pinning down (`critical` → `fast` by hand) is allowed **only before Construction starts**
and only in `let-me-look`, where the human is at the gates to see it; in `take-care` a
downward pin sets the escalation flag and stops at the next gate for confirmation.

## State

Recorded in change state under `rigor` (schema shipped):

```yaml
rigor:
  mode: standard          # fast | standard | critical
  selected_by: classifier # classifier | user | escalation
  reason: "no critical-trigger paths; ACs describe behavior change"
  escalations: []         # [{from, to, trigger, at}] — append-only, one-way
```

`mode` and `selected_by` are required within the block; the block itself is optional, so a
change created before this protocol shipped still validates and is read as `standard` /
`classifier`. The resolved mode is echoed in the orchestrator's progress line so the cost
of the run is visible while it runs, in the G2/G3 gate digests, on the dashboard's
**Rigor & cost** card (`../templates/dashboard.html`), and on the `Rigor / autonomy` line of
the PR body (`../templates/pr-description.md`) next to the autonomy mode.
