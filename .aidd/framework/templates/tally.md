# Tally — <change-id>

<!-- Tally, qa (after post evidence, before critic). One row per tracked work item
     (Jira ticket, PRD AC, or story) joined against the implementation and its
     before/after evidence. -->

| item id | type | ACs | stories | diff files | tests | pre evidence | post evidence | verdict RECONCILED\|GAP |
|---|---|---|---|---|---|---|---|---|

<!-- RECONCILED only when every column above is non-empty or explicitly `na` with a
     stated reason; otherwise GAP. Missing AC proof → note for the AC-matrix fix loop. -->

## Orphans

<!-- Diff files traceable to no work item — not owned by any story's file_scope
     (../protocol/file-scope.md). Each becomes a finding for adversarial verification;
     the note column carries the finding in qa-findings row format. -->

| diff file | note |
|---|---|

## Routed

<!-- AC-proof notes addressed to the AC matrix fix loop, and routed diff findings. -->

| item id | destination | note |
|---|---|---|

## Summary

items: N, reconciled: N, gaps: N, orphans: N
