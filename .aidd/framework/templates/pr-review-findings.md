# PR Review Findings — <unit key: file path | bundle | sweep id | dimension | cross-cutting>

<!-- Written by pr-file-reviewer (mode=file|bundle|sweep), by a dimension specialist, or by
     pr-cross-cutting-reviewer. One artifact per unit — the units are artifact-disjoint by
     construction, which is what makes the fan-out parallel (protocol/dispatch.md rule 1). -->

- Unit key: `<path | bundle-id | sweep-id | dimension | cross-cutting>`
- Paths covered: `<one or more repo-relative paths>`
- BASE: `<merge-base sha>` · HEAD: `<source-tip sha>`
- Invariants read: `<AGENTS.md | CLAUDE.md | constitution — or "none present (degradation)">`
- Ticket: `<KEY / work-item id / none>`

## Findings

| # | raised_by | Dimension | file:line | side | Proposed severity | Defect claim (one sentence) | Concrete failure scenario (inputs/state → wrong outcome) | Invariant / ticket ref | Shared symbol? |
|---|---|---|---|---|---|---|---|---|---|

<!-- side: `right` for added/modified code (line at HEAD), `left` for removed code (line at BASE).
     Dimension: the §16 review dimension this finding belongs to — it is what makes the report's
     per-dimension verdict table and the per-lens funnel (§17.1) add up.
     Proposed severity is a PROPOSAL. The adversarial verifier sets the final severity, and the
     confidence and blast radius with it (protocol/pr-review.md §6.3, §17.4).
     A finding without a concrete failure scenario is invalid by format and never reaches
     verification — same standard, same wording, as templates/qa-findings.md. "This looks risky"
     is an impression, not a scenario.
     A style finding a repo linter config already enables is dropped as duplicate-of-linter,
     citing the config path and the rule id (§17.3).
     A finding without raised_by is rejected by format — it is what makes the different-agent
     routing rule mechanical (protocol/pr-review.md §6.1).
     Shared symbol = yes ⇒ the consumer trace below is mandatory BEFORE the finding is raised. -->

## Consumer traces (mandatory for every shared/exported symbol)

<!-- protocol/pr-review.md §10. Per consumer, with the grep that proves it. A "breaking change"
     verdict reached by matching the metadata shape, with no importer grep, is refused at
     verification. -->

| Finding # | Symbol | Consumer (importer) | Can the changed input class reach it? | Grep that proves it | Per-consumer verdict |
|---|---|---|---|---|---|

## Same-named keys checked

<!-- Different engines often evaluate identically-named keys. List every other evaluator found
     for the key(s) this change touches, or state `none found` with the search you ran. -->

| Key | Other evaluator found | File | Consumers routed to it |
|---|---|---|---|

## Evidence

<!-- protocol/evidence.md blocks: the diff and show commands, the greps, any probe run. -->

```text
$ <command>
<trimmed output>
[exit <code>] <ISO-8601 timestamp>
```

## Degradations

<!-- Anything the unit could not do and why: no invariants file, no ticket linkage, a config
     glob matching nothing, a tool absent. Never silently skipped, never reported as a pass. -->

- `<none>`

## Dedup

<!-- pr-cross-cutting-reviewer only. One row per merged group: the surviving finding id, the
     ids merged into it, and which evidence survived. -->

| Surviving # | Merged ids | Evidence kept |
|---|---|---|
