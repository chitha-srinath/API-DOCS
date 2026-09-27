# Monitoring Report — <phase>-<step>

<!-- Master Agent, mode: monitor. Dispatched after every construction wave and every QA
     step batch. Judges QUALITY of the batch's sub-agent reports — evidence convincing?
     work honest? corners cut? — never process compliance, never dispatch mechanics. -->

## Reports reviewed

<!-- One row per sub-agent report in this batch (Builder Reports, qa/* reports). -->

| report | claim checked | verified against | result |
|---|---|---|---|

## Concerns

<!-- Every concern cites checkable evidence (evidence-block format, ../protocol/evidence.md).
     severity accept: minor, doesn't block. severity challenge: stands against the report's
     claim — feeds the fix loop / becomes the Master Agent's accept in a later negotiation. -->

| report | concern | evidence | severity accept\|challenge |
|---|---|---|---|

<!-- No concerns this batch → state that explicitly; do not omit the section. -->
