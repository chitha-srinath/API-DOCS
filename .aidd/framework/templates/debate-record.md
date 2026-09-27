# Debate Record — <category> — <change-id>

<!-- One record per test category (../protocol/test-debate.md). Append-only across all
     three surfaces — design, execution, results — never a file per surface, never an
     overwrite. Exchange numbers are drawn from the shared pool and are globally unique
     within the change: a batched challenge carries the SAME number into every category
     record it touches. -->

**Surfaces covered:** design | execution | results

## Exchanges

| # | challenger | claim | response | outcome amended\|defended |
|---|---|---|---|---|

<!-- `#` is the pool exchange number. `challenger` is master-agent | auditor (design rounds
     batch both into one artifact). `claim` names the contested TC id(s) and what is wrong,
     concretely — vague claims are invalid by format. `response` is the owning Test
     Engineer's answer, citing evidence blocks (../protocol/evidence.md). An exchange that
     leaves an item contested keeps `outcome` empty at the exchange level — the terminal
     disposition (DISPUTED | advisory) lives in the AC-mapping table below, not here. -->

## AC mapping

| TC id | ac_ids | surface | disposition amended\|defended\|DISPUTED\|advisory |
|---|---|---|---|

<!-- Mandatory: every debate item cites the AC id(s) the contested test evidences. On
     exhaustion an AC-mapped item goes DISPUTED into ../protocol/negotiation.md; an item
     whose ac_ids is `na` or empty is advisory — never blocks, never negotiates. Every
     row is terminal. -->

## Budget arithmetic

exchanges: design <n>/2 · execution <n>/2 · results <n>/2 · pool <used>/6 · remaining <n>

<!-- Orchestrator-owned. CHANGE-GLOBAL: `design <n>/2`, `execution <n>/2`, and `results <n>/2`
     are surface-global counts — total exchanges spent on that surface across the whole
     change, mirroring per-surface spend — not per-category counts, and this line is
     IDENTICAL across every category's record. An uncontested category still gets its
     record, with an empty exchange table but the same change-global arithmetic line, reading
     `pool 0/6` only when nothing at all was contested. The shared cap dominates every
     per-surface allowance; unused exchanges never roll over. The `/6` denominator is the
     shipped default and follows `audit.debate.max`. `pool <used>` must equal change-state
     `audit.debate.exchanges_used` counted as DISTINCT exchange numbers across
     audit/debate/* — the Supervisor checks this arithmetic (../protocol/supervision.md). -->

## Degradation

<!-- Results-surface live re-proof only: which path ran — Playwright MCP browser run
     (screenshots attached), CLI/API transcript, or the ../templates/playwright-capture.mjs
     fallback where MCP is unavailable — and why. Explicit, never silent. `none` if the
     results surface opened no live re-proof. -->
