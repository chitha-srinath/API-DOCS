# Learning Protocol

Every run makes the next run smarter.

## Retro (after Delivery)

The Retro Learner mines the completed change for:

- Review findings that were REFUTED (reviewer over-flagging patterns to damp).
- take-care assumptions that proved wrong (question-asking patterns to sharpen).
- Fix-loop root causes (construction patterns to avoid).
- Supervision violations (process steps that need reinforcement).
- Friction events (missing commands, flaky verification, unclear templates).
- Memory health: stale or contradicted lessons, and citations whose evidence artifact no longer exists.

## The escape channel

A defect found after merge is the one lesson the run itself could not produce. Escape analysis
(`escape-analysis.md`) feeds this loop rather than starting a second one:

- **Same file, same format, same dedupe.** An escape's amendment proposal is appended to
  `learnings.md` as an ordinary `L-NNN` entry — `evidence:` is the escape report path, and the
  `context:` line carries the escape id alongside the change id and phase.
- **Retro reads escape reports.** The Retro Learner mines `escapes/*` for the change it is
  retro-ing, and any escape that landed on an already-retro'd change is a **retro addendum**:
  the Learner is re-dispatched for that change with the escape report, appending to the same
  `learnings.md`.
- **A lesson from an escape is a proposal, not an applied change.** Nothing in `learnings.md`
  edits a protocol, role, or checklist file (§ below): lessons are advisory context. An
  amendment becomes real only when a human applies it.
- **A repeat escape is escalated, never re-distilled.** Same defect class plus a layer already
  recorded blind means the previous lesson did not work. Re-appending it (or a paraphrase)
  turns the learning loop into noise. The Learner instead flags it for human escalation with
  the prior lesson's L-id, the prior amendment, and whether it was ever applied
  (`escape-analysis.md` §5).

## learnings.md format

Append-only, deduplicated by the Learner before writing:

```markdown
## L-014 — <one-line lesson>
- context: <change-id, phase>
- rule: <imperative guidance a future agent can apply directly>
- evidence: <artifact reference>
```

## Load points

- Master phase loads `learnings.md` into the constitution interview context.
- Inception's Product Analyst and Architect read it before generating.
- The Post-Impl Reviewers read damping lessons to avoid re-raising refuted classes.

Lessons are advisory context, never overrides of the constitution or protocol. That holds for
escape-derived lessons too: an amendment proposal recorded here is read by future agents as
context, and is applied to a protocol file only by a human who decided to
(`escape-analysis.md` §4b).
