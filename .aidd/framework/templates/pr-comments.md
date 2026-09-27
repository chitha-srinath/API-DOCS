# PR Comments — <PR id>

status: not posted

<!-- Emitted by pr-comment-validator (protocol/pr-review.md §8). Nothing here is posted until
     an explicit human approval in the current run (§12). `status` flips to `posted` only
     after that approval, and then records the platform comment ids. -->

- BASE: `<merge-base sha>` · HEAD: `<source-tip sha>`
- Platform: `<azure-devops | github | local>`
- Author addressing: `<off | terse handle>` (`pr_review.comment_style.address_author`)

## Post-ready comments

<!-- Every row needs a resolvable file path, line, AND side. A comment without them is not
     post-ready and belongs in the drop list instead (protocol/pr-review.md §11.3).
     side = `right` for added/modified code (line at HEAD) · `left` for removed code (line at BASE).
     GitHub: --side RIGHT|LEFT. Azure DevOps: rightFileStart.line | leftFileStart.line. -->

| # | Finding | Severity (verifier) | File | Line | Side | Comment (problem → code reason → ask) |
|---|---|---|---|---|---|---|

## Dropped comments

<!-- A comment that fails validation is DROPPED, not softened. Every drop names its failing
     check, so nothing disappears silently. -->

| Finding | Failing check | Why |
|---|---|---|

<!-- Failing check ∈ {factual-accuracy, line-side-unresolvable, contradicted-by-feed, tone} -->

## Style — the contract, with examples

Plain, direct, natural developer tone. Not collegial, not hedged, not "humanized".

**Forbidden literally** (self-check against this list before emitting): `hey <name>` and any
greeting · `I feel` · `I might be wrong here` · `can we maybe` · `just a nit but` · emojis ·
exclamation marks · praise openers (`great work`, `nice job`, `thanks for this`) ·
`thoughts?` / `wdyt?` closers.

**Required shape:** one line stating the problem → the code reason → a clear closing ask
(`please <do X> before merge`). Author name optional and terse; never a chatty greeting.

### Pair 1 — a null-safety defect

Bad:

```text
hey Sam! I might be wrong here, but I feel like this could maybe blow up if the list is
empty? just a nit but can we maybe add a guard? thoughts?
```

Good:

```text
This throws when `items` is empty. `items[0]` is read before the length check on line 42, and
the empty case reaches here from the filtered-search path where every result can be excluded.
Please guard the empty case before merge.
```

### Pair 2 — a hardcoded business token in framework code

Bad:

```text
Nice work on this! Small thought — I think maybe hardcoding the entity types here isn't
ideal long term. Could we possibly consider making it configurable at some point?
```

```text
This array should be metadata-driven.
```

Good:

```text
The entity types are hardcoded in framework code. The array on line 18 lists three business
tokens, so a fourth entity type ships broken until this file is edited — the framework must
read this from field metadata like the sibling gadgets do.
Please drive this from metadata before merge.
```

### Pair 3 — a test that proves nothing

Bad:

```text
Thanks for adding tests! I'm not 100% sure but this one might not be testing much — happy to
be wrong here!
```

Good:

```text
This test passes with the implementation deleted. `formatTotal` is mocked on line 9 and the
assertion on line 14 compares the mock's configured return value with itself, so nothing
about the real function is exercised.
Please assert on the real function's output before merge.
```

<!-- What makes the good versions work: they open on the defect, name the mechanism with a
     line number, and close on an imperative. No hedge, no greeting, no praise, no question
     mark. The tone is not blunt for its own sake — a hedged comment on a real defect gets
     deferred, and a direct comment on a real defect gets fixed. -->

## Posting record

<!-- Filled only after an explicit human approval in the run that posts. -->

| # | Posted at | Platform comment id |
|---|---|---|
