# Phase: Retro

Purpose: the run makes future runs smarter. Runs after Delivery completes.

## Steps

1. Dispatch Retro Learner (`../roles/retro-learner.md`) → appends deduplicated lessons to
   `learnings.md` per `../protocol/learning.md`. Its inputs include this change's escape
   reports (`escapes/E-*.md`) where any exist — the escape channel is part of the same loop,
   not a second one.
2. Orchestrator archives the change folder → `changes/_archive/<id>/`; sets global
   `changes.<id>: done`, clears `active_change`; final state write + dashboard render.

## The escape channel (after the change is done)

A defect found after merge re-enters this phase without re-opening any other
(`../protocol/escape-analysis.md`): `/aidd:escape` attributes it, the Escape Analyst
(`../roles/escape-analyst.md`) fills the nine-row per-layer verdict table, and the two
mandatory outputs land — a regression test (authored TDD in the fix change) and one amendment
**proposal**. The orchestrator then dispatches the Retro Learner again as a **retro addendum**
for that change, so the escape's lessons append to the same `learnings.md` under the same
dedupe. A **repeat** escape is escalated to the human with the prior amendment, never
re-proposed. Nothing here re-runs a gate, and no agent applies an amendment.

## Exit checklist

- [ ] learnings appended (or explicit "no new lessons" entry)
- [ ] every escape report on this change produced a lesson or a recorded repeat escalation
      (`../protocol/escape-analysis.md`)
- [ ] change archived; global state valid
