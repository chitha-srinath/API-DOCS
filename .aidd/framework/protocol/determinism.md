# Determinism Proof

**A green claim that gates delivery is not trusted until it has been reproduced.**

AIDD already refuses assertions without executed evidence (`evidence.md`). This protocol
closes the obvious next hole: an executed run can still be a lie, because a suite that passes
once and fails once is not a passing suite — it is a suite whose result is a coin flip, and
every agent framework in the field trusts the flip that happened to land green.

Reproduction is cheap relative to what it protects. The rest of this file is what "reproduced"
means exactly, how many times, what a difference proves, and what happens to the test that
produced it.

## 1. The claims that need reproduction

Exactly three classes — the ones a delivery decision rests on:

| # | Claim | Where it is made |
|---|---|---|
| 1 | The **full-suite green at Construction close** — the suite run the `tests_green` gate rests on | `../playbooks/30-construction.md` integration check, re-proved in QA |
| 2 | The **clean-state E2E green** — every canonical command from a clean state | `../playbooks/40-qa.md` step 7 |
| 3 | **Any test whose FAIL closed a fix-loop iteration** — the test that went red, drove a fix, and then went green | `../playbooks/40-qa.md` step 6 |

Class 3 is the load-bearing one people forget: that test's green is the entire evidence that
the defect is gone. If it is nondeterministic, the fix loop closed on noise.

Everything else — exploratory runs, a category that gated nothing, lint and typecheck — needs
no repeat. But if lint or typecheck ever *does* flap, it is a flake by the definition in §3
and the quarantine in §5 applies to it unchanged.

## 2. How many repeats, per rigor mode

| claim class | `fast` | `standard` | `critical` |
|---|---|---|---|
| full suite (class 1) | 1 run, no repeat required | **2 runs** | **2 runs** |
| clean-state E2E (class 2) | not run at all (`rigor-modes.md`) | 1 run — recorded as **corroboration**, not a repeat | **2 runs** of the full canonical command set |
| fix-loop-closing test (class 3) | 1 run | **2 runs** | **2 runs** |
| gate | `evidence_reproduced: na`, `reason: rigor:fast` | earned | earned |

**Why these numbers, in cost terms:**

- **Two is the smallest number that can disagree.** One run cannot detect nondeterminism at
  all; it can only report the outcome it happened to get. Going from 1 → 2 buys the entire
  detection capability, and it is the only step in the sequence that does.
- **Three is not worth it as a standing cost.** A third run only catches flakes whose per-run
  failure probability is low enough that two runs missed them — and for those, the
  discriminating checks in §4 find the *source* faster and cheaper than more repeats find the
  *symptom*. So the third run is spent only when a difference has already appeared.
- **`standard` does not double the E2E** because the E2E's own suite invocation is already a
  second execution of the same tests in a *different environment*. That is corroboration of a
  different kind and the report labels it as such — it is not counted as one of the two
  repeats, and it is not pretended to be one.
- **`critical` doubles the E2E** because clean-state runs include environment setup — fresh
  dependency installs, first-run caches, network, service startup ordering — which is the
  richest source of nondeterminism in the whole pipeline, and a `critical` change is where an
  unnoticed flake costs the most.
- **`fast` repeats nothing** and says so. A `fast` change is docs, copy, comments, formatting,
  or test scaffolding, where the suite green is not proving a behavior change. A repeat there
  buys nothing worth its cost — recorded `na` with its reason, never silently skipped.

The total added cost is therefore: **one extra full-suite run** in `standard`; **one extra
full-suite run plus one extra clean-state canonical set** in `critical`; **nothing** in
`fast`. All of it lands inside the E2E Verifier's existing dispatch (§7), so it adds runtime,
not dispatches.

## 3. What "the repeats agreed" means — and the retry that is forbidden

Two runs **agree** when both hold:

1. identical exit code, and
2. an identical map of test id → outcome (`PASS` | `FAIL` | `SKIP` | `ERROR`).

They do **not** need identical stdout bytes, identical durations, or identical output
ordering. Timing noise in a log is not a disagreement.

A test present in one run and absent from the other **is** a disagreement — collection
nondeterminism, not a skip. Where the runner cannot enumerate test ids, the comparison falls
back to `(exit code, passed/failed/skipped counts)` and the determinism report records that
degradation explicitly (`evidence.md` degradation discipline).

> **A repeat is a measurement, never a second chance.** Run 1 FAIL followed by run 2 PASS is a
> **disagreement** — the test is nondeterministic and it is quarantined. It is not a pass, it
> is not "flaky infrastructure", and it does not close anything. Re-running a red claim until
> it comes back green is forbidden outright, and doing it is a supervision VIOLATION whether
> or not the final run was green.

## 4. Seed, clock, network — naming the source, mechanically

A repeat-difference report **must name the suspected source**. Six sources cover essentially
all of it, and each has one cheap check that changes exactly one variable:

| source | signature | discriminating check |
|---|---|---|
| unseeded randomness | different values, inputs, or ids each run; UUID/order-dependent assertions | re-run with a **fixed seed** (`PYTHONHASHSEED=0`, `--seed <n>`, the framework's seed flag). Stable across ≥2 seeded runs and unstable unseeded ⇒ confirmed |
| wall-clock / timezone | fails near midnight, month end, DST, or only in some regions | re-run with **`TZ=UTC` and a pinned clock** (libfaketime, the language's clock-freeze fixture); then re-run at a shifted `TZ` to confirm |
| network calls | intermittent timeouts, DNS errors, rate limits, a third-party response in the trace | **re-run offline** (egress blocked, `--offline`, network namespace down). Failing offline proves the test touched the network |
| shared fixtures / leaked state | passes alone, fails inside the suite (or vice versa) | **run the test alone**, single-test invocation. Passing alone ⇒ state leaked from a sibling |
| test-order dependence | outcome changes when the suite order changes | **re-run in reverse order** (`--reverse`), or shuffle with an explicitly **recorded** seed so the order is reproducible |
| uncontrolled concurrency | only fails under parallel execution; races, deadlocks, port clashes | **re-run with parallelism 1** (`-j1`, `-p 1`, `--jobs 1`). Stable at 1 ⇒ concurrency |

Each check is one re-run with one variable changed, and each produces its own evidence block.
`suspected_source: unknown` is permitted **only** after all six checks have been run and
recorded with their evidence — and the test is quarantined anyway. "Probably flaky
infrastructure" is not a source.

## 5. Quarantine

The moment repeats disagree, the test is **quarantined**. Mechanically:

1. **Recorded** in `qa/determinism-report.md` (`../templates/determinism-report.md`): the
   command, every run's outcome, the ACs it was proving, the discriminating checks run, the
   suspected source, and the disposition. Mirrored into change state
   (`determinism.quarantined`).
2. **It may NOT be used as evidence for any AC, any quality gate, or any debate defence.** Its
   rows in `ac-matrix.md` and `qa/test-report.md` read `QUARANTINED` — never `PASS`.
3. **Every AC it was proving reverts to unproven** and feeds the **existing** fix loop
   (`../playbooks/40-qa.md` step 6, via the AC-matrix FAIL path). No new loop, no new budget.
   An AC that another *executed, reproduced* test also proves stands on that test alone — the
   report says which.
4. **Disposition**, exactly one of:
   - `fixed` — the nondeterminism is removed and the repeats now agree, with fresh evidence
     blocks. A "fix" without agreeing repeats is not a fix.
   - `accepted` — a human accepts the flaky test with a **recorded reason**
     (`determinism.quarantined[].accepted_reason`). Acceptance means "we ship knowing this test
     is unreliable"; it does **not** promote the test back to evidence. A quarantined test
     never proves an AC again until it is `fixed`.
   - `pending` — unresolved. A `pending` quarantine at G3 makes G3 **forced-human in both
     autonomy modes** (`gates.md` escalation flag): delivering on ACs whose only proof is a
     coin flip is exactly the case a human must see.
5. **A quarantined test silently counted as green is a supervision VIOLATION.** The Supervisor
   itemizes the rule, the artifact that counted it (the AC-matrix row, the test-report row, the
   debate defence), and the remediation — the AC returns to unproven and the step re-runs.

## 6. The `evidence_reproduced` quality gate

Same shape as every other quality gate (`pending` | `passed` | `failed` | `na`), in the
`quality_gates` object of `core/schemas/change-state.schema.json` — the authoritative set
(`gates.md` §Quality gates enumerates all sixteen and points here for this one's definition;
it carries the identical must-be-`passed`-or-`na` rule before Delivery pushes).

| value | when |
|---|---|
| `passed` | every repeat the mode requires ran, and either they all agreed, or each disagreement is quarantined with a terminal disposition **and** no AC or gate rests on a quarantined test |
| `failed` | a flake gated delivery unresolved: a quarantine still `pending`, an AC whose only proof is quarantined, or a required repeat that was never run |
| `na` | `fast` mode, with `reason: rigor:fast` |

A rigor escalation out of `fast` voids that `na` — the gate flips to `pending` and the repeats
run in the new mode, exactly as `rigor-modes.md` §Escalation back-fills every other skipped
step.

## 7. Who performs it

The **E2E Verifier** (`../roles/e2e-verifier.md`), inside its existing QA step 7 dispatch. It
already re-runs every canonical command from a clean state and trusts no prior green claim, so
the repeat is a marginal extension of a dispatch that is happening anyway — which is why this
capability costs runtime rather than agents. It performs the repeats for all three claim
classes, compares them by the §3 rule, runs the §4 discriminating checks on any difference, and
writes `qa/determinism-report.md`.

In `fast` there is no E2E Verifier dispatch, nothing is repeated, and the gate records `na`
with its reason. No other role may set `evidence_reproduced`.

## 8. State

Recorded in change state under `determinism` (closed object, optional at top level so a
change created before this protocol shipped still validates and reads as un-reproduced):

```yaml
determinism:
  repeats_required: 2      # runs required PER reproduced claim in the current mode
  repeats_done: 0          # the LOWEST run count recorded across those claims
  report: null             # qa/determinism-report.md, null until it exists
  quarantined: []          # {test, ac_ids, suspected_source, disposition, accepted_reason}
```

The **orchestrator** writes all four and nobody else (`state-protocol.md` rule 1), reading
them off the E2E Verifier's `qa/determinism-report.md`. The counts are **per claim class**
(§1), not cumulative:

| field | semantics |
|---|---|
| `repeats_required` | how many runs **each** reproduced claim class must have in the current rigor mode — `0` in `fast`, `2` in `standard` and `critical` (§2). Seeded when the mode resolves. It is deliberately a per-claim count and never a total, because how many class-3 claims exist is not known until the fix loop closes. |
| `repeats_done` | the **lowest** run count recorded over the claim classes the mode requires — a minimum, not a sum. That is what makes `repeats_done >= repeats_required` the entire arithmetic of the gate: one under-repeated claim cannot be masked by another that ran twice. `0` while any required claim is unrun. |
| `report` | repo-relative path to `qa/determinism-report.md`; `null` until the E2E Verifier writes it. `evidence_reproduced: passed` alongside a `null` report is a supervision VIOLATION — the gate would be resting on a document that does not exist. |
| `quarantined` | one row per test whose repeats disagreed (§5), append-only within the change. `disposition` moves `pending` → `fixed` or `accepted`, never back, and `accepted` never restores the test to the evidence set. |

A rigor escalation out of `fast` re-seeds `repeats_required` to `2` and resets `repeats_done`
to `0`: the `na` earned under the outgone mode is void and the repeats run in the new mode
(`rigor-modes.md` §Escalation).

A quarantine is a state transition, so it emits exactly one progress line like any other step
(`progress.md` §1) — `[qa 7/17] 2 tests quarantined · qa/determinism-report.md · gates: 2/4 ·
rigor: standard · next: post evidence` — never a narration of the comparison that produced it.

## 9. What this protocol is not

- **Not a retry mechanism.** §3. A green that only appears sometimes is not a green.
- **Not a flake-suppression tool.** Quarantine removes a test from the *evidence* set, never
  from the suite. Deleting or skipping a flaky test to make a gate pass is a fix-loop defect,
  not a resolution.
- **Not a substitute for the fix loop.** A quarantined test hands its ACs back to the existing
  loop with the existing budget; it does not create a parallel process.
- **Not proof of correctness.** Two agreeing runs prove the *result is stable*, not that the
  test is right. A test that reliably asserts the wrong thing is the Auditor's and the test
  debate's problem, and they still run.
