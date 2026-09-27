# Cost Ledger — <change-id>

<!-- Orchestrator, append-only, one row per returned dispatch. Written to
     changes/<id>/cost/ledger.md. Canonical rules: ../protocol/cost-governance.md.
     A runtime that does not expose usage records `not measured` — never a zero, never an
     estimate in a measurement column. Summarize with:
     bash .aidd/framework/scripts/aidd-cost.sh --ledger changes/<id>/cost/ledger.md -->

## Budget

| field | value |
|---|---|
| rigor_mode | <fast\|standard\|critical> |
| budget_tokens | <int> |
| budget_minutes | <int> |
| derived_by | <formula (nominal) \| formula (re-derived at G2) \| raised (stops row N)> |

## Dispatches

<!-- `class` is the dispatch-class id: the `Class` cell of the ../protocol/dispatch.md
     decision-table row that produced this dispatch (e.g. `qa5-test`, `con2a-builder`).
     Medians in the projection group on this column, so it must match the table
     byte-for-byte — and it is the class id, never the `Step` text, because Step cells are
     neither unique (`QA 1` names two rows) nor atomic (`QA 3, 5, 9`).
     `source` is `measured` or `not measured`. cum_tokens counts measured rows only. -->

| at | phase | class | role | unit | tokens_in | tokens_out | minutes | cum_tokens | cum_minutes | source |
|---|---|---|---|---|---|---|---|---|---|---|

## Remaining planned dispatches

<!-- The classes the resolved dispatch plans still owe at the CURRENT rigor mode. The
     orchestrator rewrites this section after every plan resolution; the projection reads it.
     A class with no measured row yet counts as UNKNOWN and makes the projection a lower
     bound. -->

| class | count |
|---|---|

## Stops

<!-- One row per threshold event, append-only, mirrored into change-state cost.stops.
     threshold: soft | hard | runaway. disposition: raised | reduced-breadth |
     narrowed-scope | aborted | aborted-dispatch | pending. -->

| at | phase | threshold | reason | disposition |
|---|---|---|---|---|

## Summary

<!-- Recomputed from the rows above — never asserted. -->

spent: <tokens> tokens / <minutes> min · budget: <tokens> / <minutes> ·
projection: <tokens or "≥ tokens (N classes unknown)"> · status: <within \| soft \| hard> ·
rows: <N> (measured <N>, not measured <N>)
