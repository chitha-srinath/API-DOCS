# PR Review Report — <PR id> · <PR title>

<!-- The deliverable a human reads. Conclusion and confirmed findings only — never raw agent
     dumps (protocol/progress.md §3). Everything else stays on disk as the audit trail. -->

## Ground truth

| Field | Value |
|---|---|
| Platform | `<azure-devops \| github \| local>` |
| Repository | `<repo>` |
| Source (head) ref | `<branch>` |
| Target (base) ref | `<branch>` |
| **BASE sha (merge-base)** | `<sha>` |
| **HEAD sha (source tip)** | `<sha>` |
| Ticket | `<KEY / work-item id / none>` |
| Rigor mode | `<fast \| standard \| critical>` |
| Files changed | `<n>` (`<n>` source · `<n>` swept) |

<!-- Both SHAs are mandatory. A report without them is invalid by format: without them the
     review is not re-runnable and no finding's file:line is reproducible
     (protocol/pr-review.md §4.3). -->

```text
$ git merge-base <target> <source>
<sha>
[exit 0] <ISO-8601 timestamp>

$ git rev-parse <source>
<sha>
[exit 0] <ISO-8601 timestamp>
```

## Specialist roster (resolved)

<!-- MANDATORY. The stack-detected roster after detection → config override → availability probe
     → rigor scaling (protocol/pr-review.md §15). Every lens whose signal fired gets a row,
     including the ones that did not run: a lens missing from this table, or a specialist listed
     here that was never dispatched, is a supervision VIOLATION (protocol/supervision.md).
     Degradation is explicit, never silent (protocol/evidence.md). -->

| Lens key | Signal that fired | Default agent | Agent dispatched | Status |
|---|---|---|---|---|
| `<lens>` | `<the path/diff signal, quoted>` | `<pr-file-reviewer mode=lens \| the repo's roster mapping>` | `<agent \| pr-file-reviewer mode=lens>` | `<available \| degraded → pr-file-reviewer mode=lens (agent not exposed by the runtime) \| disabled by config (reason) \| not run (rigor:<mode>)>` |

```text
$ <availability probe: the runtime's agent enumeration>
<trimmed output>
[exit <code>] <ISO-8601 timestamp>
```

<!-- The per-file agents remain the backbone in every mode: specialists are additional lenses
     over the same diff, and every specialist finding goes through the SAME adversarial
     verification, by a different agent, with the severity set by the verifier
     (protocol/pr-review.md §15 rules 1–3). -->

## Conclusion

<!-- One paragraph. What this PR does, whether it should merge, and what has to change first.
     Written last, from the confirmed findings and the acceptance bar — never from the PR
     description. -->

## Acceptance bar

<!-- All three rows, every review, proven against the code and never assumed. A report missing
     any of the three verdicts is INCOMPLETE BY FORMAT (protocol/pr-review.md §9). -->

| # | Item | Verdict | Proof (cited from the code) |
|---|---|---|---|
| 1 | **Additive** — new props/params/fields optional; nothing existing removed or repurposed | `PASS \| FAIL \| N/A (why)` | `<signature/type quoted, or the removed symbol + one broken caller>` |
| 2 | **Non-breaking** — existing call sites and existing data/forms behave identically when the feature is inactive | `PASS \| FAIL \| N/A (why)` | `<the traced inactive path: the guard/early return that makes it a pure pass-through — no extra DOM, no extra behavior>` |
| 3 | **No hardcodes** — no business tokens / field ids / statuses / entity types in framework code; behavior is metadata-driven | `PASS \| FAIL \| N/A (why)` | `<redline scan result + allowlist untouched + escape hatches + test-honesty assessment>` |

### No-hardcodes detail (all four parts reported)

| Part | Result | Evidence |
|---|---|---|
| Redline scan over new framework files | `<clean \| n hits>` | `<command + exit code>` |
| Allowlist file untouched | `<PASS \| FAIL \| N/A (no allowlist configured)>` | `<git diff --name-only excerpt>` |
| New unjustified `any` / escape hatches | `<none \| n flagged>` | `<file:line list>` |
| Do the tests verify real behavior? | `<honest assessment>` | `<per test file: real \| vacuous (string-grep, asserts on a mock, passes with the implementation deleted)>` |

<!-- The test-honesty row is an assessment, stated plainly. Proof standard: protocol/determinism.md
     — a green that gates a merge is not trusted until something shows it would go red. The
     mocked-proof defect class is catalogued at bench/defects/D-008-mocked-proof-patched-add.md. -->

```text
$ <redline scan command>
<trimmed output>
[exit <code>] <ISO-8601 timestamp>
```

## Findings funnel

<!-- raised → confirmed → refuted. The funnel is the review's own honesty record: a review that
     reports only what it confirmed has hidden its false-positive rate. -->

| Stage | Count |
|---|---|
| Raised (all finders) | `<n>` |
| Verified (adversarial, every finding) | `<n>` |
| **CONFIRMED** | `<n>` |
| **REFUTED** | `<n>` |
| Merged by dedup | `<n>` |
| Dropped at comment validation | `<n>` |
| **Post-ready comments** | `<n>` |

| Severity (set by the verifier) | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| Confirmed | `<n>` | `<n>` | `<n>` | `<n>` |

### Per-lens funnel (false-positive discipline)

<!-- One row per finder unit — each per-file agent, each sweep, each dimension specialist, each
     stack lens, the cross-cutting agent, the unknown-unknowns pass (protocol/pr-review.md §17.1).
     A chronically over-flagging lens is invisible in a totals-only funnel and obvious here. -->

| Lens / unit | Raised | Confirmed | Refuted | Confirm rate |
|---|---|---|---|---|

## Review dimensions

<!-- MANDATORY: every dimension whose trigger fired gets a row (protocol/pr-review.md §16). A
     fired trigger with no row is INCOMPLETE BY FORMAT. A dimension that did not fire is
     `N/A (trigger not matched)`; one the mode did not run is `N/A (rigor:<mode>)`. Never absent. -->

| # | Dimension | Verdict | Evidence / findings |
|---|---|---|---|
| 1 | Diff-coverage (are the changed lines exercised by a test that would fail without them?) | `PASS \| FINDINGS (n) \| N/A (why)` | `<test ids per hunk + the red-without-the-change proof, or the mocked-proof call>` |
| 2 | Contract / compat (public API, exported types, schema, wire format, events) | `PASS \| FINDINGS (n) \| N/A (why)` | `<per-consumer trace + semver implication: major \| minor \| patch>` |
| 3 | Failure-mode analysis (null/empty/oversized, timeout, partial failure, retry, concurrency) | `PASS \| FINDINGS (n) \| N/A (why)` | `<per new path: the unhappy-path branch, or its named absence + the input class that reaches it>` |
| 4 | Rollback & migration safety (down-path, data loss, idempotent backfill, deploy ordering) | `PASS \| FINDINGS (n) \| N/A (why)` | `<down migration quoted or named absent; two-version tolerance stated>` |
| 5 | Feature-flag / kill-switch (does OFF equal today's behavior?) | `PASS \| FINDINGS (n) \| N/A (why)` | `<flag name + the OFF-path trace: pure pass-through>` |
| 6 | Observability (can a responder act on the new failure path?) | `PASS \| FINDINGS (n) \| N/A (why)` | `<log/metric with its context fields, or the swallowed handler quoted>` |
| 7 | Dependency & supply-chain delta (why, license, weight, CVEs, stdlib alternative) | `PASS \| FINDINGS (n) \| N/A (why)` | `<manifest hunk + lockfile delta + audit evidence block, or the degradation>` |
| 8 | Secrets & sensitive data in the diff (always on) | `PASS \| FINDINGS (n) \| N/A (why)` | `<scan command + exit code; per hit file:line and value CLASS, never the value>` |
| 9 | Performance on hot paths (N+1, unbounded work, sync work in a render path, missing index) | `PASS \| FINDINGS (n) \| N/A (why)` | `<call site + loop bound or its absence; query in loop; new WHERE/JOIN column vs the index list>` |
| 10 | Concurrency & idempotency (shared state, lock ordering, retry-safe writes) | `PASS \| FINDINGS (n) \| N/A (why)` | `<critical section + its guard; idempotency key or unique constraint, or the duplicate-write scenario>` |
| 11 | Dead / unreachable code and constant drift | `PASS \| FINDINGS (n) \| N/A (why)` | `<the search that found no caller; both locations of the duplicated value>` |
| 12 | Unknown-unknowns — what is NOT in the diff | `PASS \| FINDINGS (n) \| N/A (why)` | `<see the section below — mandatory in every rigor mode>` |

## Unknown-unknowns — what is NOT in the diff

<!-- MANDATORY in every rigor mode (protocol/pr-review.md §16.2), produced by the cross-cutting
     agent as pr-review/unknown-unknowns.md. Every item answered present | missing | n/a WITH the
     search that proves it: a "missing test" claim without the search that came back empty is
     invalid by format. Anything raised here goes through §6 verification like any other finding. -->

| # | Should it be here? | Verdict | The search that proves it |
|---|---|---|---|
| 1 | A test for the changed behavior | `present \| missing \| n/a (why)` | `<command + result>` |
| 2 | A migration down-path | `present \| missing \| n/a (why)` | `<...>` |
| 3 | A kill-switch for a risky or user-visible change | `present \| missing \| n/a (why)` | `<...>` |
| 4 | Doc / changelog / API-reference update this repo's convention requires | `present \| missing \| n/a (why)` | `<the comparable past change that carried one>` |
| 5 | Telemetry on the new failure path | `present \| missing \| n/a (why)` | `<...>` |
| 6 | A sibling call site not updated | `present \| missing \| n/a (why)` | `<the caller grep; the un-updated site named>` |
| 7 | A second implementation of the same rule left stale | `present \| missing \| n/a (why)` | `<the same-named-key search of §10 step 4>` |
| 8 | A config / env key added in code but absent from the example config or deploy manifest | `present \| missing \| n/a (why)` | `<...>` |
| 9 | A schema or type updated on one side of a boundary only | `present \| missing \| n/a (why)` | `<...>` |

## Confirmed findings

<!-- Only CONFIRMED findings appear here. Severity is the VERIFIER's value, not the finder's
     (protocol/pr-review.md §6.3) — both are shown so the drift is visible rather than argued.
     Confidence and blast radius are the VERIFIER's too (§17.4), and they are what tells the
     author what to fix first. Sort: severity desc, then blast radius desc, then confidence desc,
     then finding id asc — deterministic, and also the right fix order. -->

| # | Severity (verifier) | Proposed (finder) | Dimension | Confidence | Blast radius | file:line | side | Why it is a real problem (code reason) | When it manifests (path/conditions/inputs) | raised_by → verified_by |
|---|---|---|---|---|---|---|---|---|---|---|
| `<id>` | `<CRITICAL \| HIGH \| MEDIUM \| LOW>` | `<finder's proposal>` | `<§16 dimension>` | `<proven \| traced>` | `<single call site \| module \| all consumers of X \| every request \| data at rest>` | `<path:line>` | `<right \| left>` | `<...>` | `<...>` | `<unit → verifier-unit>` |

## Cross-cutting

<!-- What no per-file agent could see. One row per class actually found; `none found` is a
     legitimate value and is stated, not omitted. -->

| Class | Finding | Evidence |
|---|---|---|
| Shared-package impact on other consumers | `<...>` | `<importer greps, per consumer>` |
| Platform-only violation | `<...>` | `<...>` |
| Dead / unreachable path | `<...>` | `<the search that found no caller>` |
| Constant drift | `<...>` | `<both locations>` |
| Missing cross-boundary test | `<...>` | `<the boundary and the untested direction>` |

## Consumer traces

<!-- Every shared/exported symbol whose behavior a finding claimed to change
     (protocol/pr-review.md §10). Verdict is per consumer, proven by importer greps. -->

| Symbol | Consumer | Reachable by the changed input class? | Grep | Verdict |
|---|---|---|---|---|

## Coverage

<!-- Which agent read what — the audit surface for "was anything left unreviewed?" -->

| Unit | Mode | Paths | Artifact |
|---|---|---|---|

## Degradations

- `<none>`

## Comments

- Post-ready list: `pr-review/comments.md` — `<n>` comments
- Posting status: **not posted** — an external write requires explicit human approval in this
  run (`protocol/pr-review.md` §12, mirroring `protocol/jira-sync.md` write-back)

## Appendix — refuted findings

<!-- MANDATORY (protocol/pr-review.md §17.5). Every REFUTED finding, with the counter-evidence
     that killed it: the guard the finder missed, the caller that never passes that value, the
     type that makes it impossible. The author learns what was considered and dismissed, and the
     finders stay honest — a lens with a long refuted list and an empty confirmed list is visible.
     Refuted findings are NEVER posted as comments and never counted as confirmed. -->

| # | Claim (one sentence) | Dimension | raised_by | verified_by | Refutation reason (counter-evidence) |
|---|---|---|---|---|---|

## Dropped as duplicate-of-linter

<!-- protocol/pr-review.md §17.3: a style finding the repo's own linter config already enables is
     dropped, citing the config path and the rule id. A reviewer that flags what CI enforces is
     noise. `none` is a legitimate value and is stated. -->

| # | Claim | Linter config that owns it | Rule id |
|---|---|---|---|
