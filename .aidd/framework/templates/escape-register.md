# Escape Register

<!-- Repo-level, append-only index of every analyzed escape. Written to
     .aidd/escapes/register.md. Canonical rules: ../protocol/escape-analysis.md §7.
     One row per escape, id ascending, never reused and never rewritten — a correction is a
     new row whose `notes` name the row it corrects, the same discipline the cost ledger and
     rigor.escalations use. The Metrics section is recomputed on EVERY append. -->

## Escapes

<!-- `verdict`: layer-blind | no-layer-at-reasonable-cost | out-of-scope.
     `blind_layers`: exactly the rows whose should_have_caught is `yes` and did is `no` —
     from L1-review, L1-tests, L2-auditor, L2-tally, L2-debate, L3-supervisor, critic,
     e2e-mutation, evidence-capture. `—` when the verdict is not layer-blind.
     `disposition`: open | closed | escalated. `closed` requires the regression test's RED
     and GREEN evidence blocks to exist and the report to cite them (§4a); a repeat is
     `escalated` and is never closed by an agent (§5). -->

| id | date | change id | defect class | verdict | blind layers | regression test | amendment | disposition | repeat_of |
|---|---|---|---|---|---|---|---|---|---|

## Metrics

<!-- Recomputed on every append. ALWAYS print the numerator and the denominator: a bare
     percentage over three escapes is a number pretending to be evidence. A window with no
     analyzed escape reads `not measured` — never `0%`, which would be a claim nobody
     measured (§7). Window default: the last 20 merged changes, tunable in constitution.md
     as `escapes.window_changes`. -->

**Window:** last `<N>` merged AIDD changes (`<first-change-id>` … `<last-change-id>`)

**Escape rate:** `<escapes attributed>` / `<AIDD changes merged in the window>` = `<pct>`
— or `not measured` when the window has no analyzed escape.

### Layer blindness

<!-- Per layer: escapes in the window whose blind_layers include it, over escapes analyzed
     in the window. All nine rows, always — a layer with a zero numerator is evidence, an
     omitted layer is not. -->

| layer | blind | analyzed | rate |
|---|---|---|---|
| `L1-review` | | | |
| `L1-tests` | | | |
| `L2-auditor` | | | |
| `L2-tally` | | | |
| `L2-debate` | | | |
| `L3-supervisor` | | | |
| `critic` | | | |
| `e2e-mutation` | | | |
| `evidence-capture` | | | |

<!-- These two metrics are the honest counter-metric to every detection claim this framework
     makes. Any document reporting what AIDD caught must be readable next to this file: a
     detection number published without its escape rate is an unfalsifiable claim. -->
