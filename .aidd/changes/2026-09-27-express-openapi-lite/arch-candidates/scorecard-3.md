# Judge Scorecard — judge 3

<!-- One per Arch Judge. Fixed rubric; 1–5 each; no ties in ranking. -->
<!-- Degradation: .aidd/context/snapshot.md not re-read; all three candidates quote it as an empty greenfield tree, so no repo evidence exists and ecosystem precedent is used. -->

| Candidate | Fit-to-constitution | Simplicity | Risk | Testability | Evolvability | Total |
|---|---|---|---|---|---|---|
| simplicity-first | 4 | 5 | 3 | 4 | 3 | 19 |
| scalability-first | 3 | 2 | 3 | 4 | 4 | 16 |
| risk-first | 5 | 2 | 5 | 5 | 4 | 21 |

## Ranking & rationale (≤5 lines per candidate)

**1. risk-first (21).**
- It puts the highest-risk ACs behind their own isolated ports, each with contract tests: auto-detection (023/031–034), the dual build (002/003) and type inference (006/046). The Express 4 and Express 5 introspectors are separate (C5).
- The layer walk is wrapped in try/catch per layer, so an unknown layer degrades instead of throwing. This lowers the risk for AC-034.
- The config schema is written once with `.strict()`, and the types come from the same schema, so the runtime check and the types cannot drift (AC-045/046).
- The `publint` and `attw` gates cover the constitution's "strict" and dual-build bars. The stack fingerprint counts layers in nested stacks too, which fixes AC-032 for nested routers.
- Its cost is simplicity: it adds 4 ports and roughly doubles the test surface (Trade-offs §1). Using Zod internally for config also couples config validation to the peer dependency, which `SchemaAdapter` was meant to avoid.

**2. simplicity-first (19).**
- It is the leanest design: about 10 files and zero runtime dependencies. One `OPTION_SPEC` table drives the defaults, the types, the validation and the README test (AC-029/036), which is elegant.
- It carries two real risks:
  - The cache is keyed only on the length of the top-level stack. The candidate accepts that routes added later to nested routers are missed ("Trade-offs", cache bullet). That puts AC-032 at risk.
  - Reading `info` implicitly from `package.json` via `process.cwd()` breaks deterministic output across working directories.
- There is a single `detect.ts` with shims for both versions, and no try/catch per layer.
- Evolvability is capped: it states that nothing is extensible beyond `SchemaAdapter` and the strategy functions.

**3. scalability-first (16).**
- It optimizes for 1k-route performance, which no AC and no constitution bar asks for (the only budget is p95 200ms). The ETag, fragment cache and component-hash modules are speculative complexity.
- It adds `picomatch` as a runtime dependency, which widens the supply-chain surface against the constitution's clean-audit rule.
- Hoisting and deduplicating components by structural hash risks changing the output that AC-016 expects and complicates byte identity (AC-034).
- Its cache fingerprint also admits missed mutations (Trade-offs §2).
- It is strong on evolvability: `invalidate()` and ports for each variant. The bench plus Stryker plan is good.

## Best ideas worth grafting from non-winners

- **From simplicity-first:**
  - A single declarative `OPTION_SPEC` table that drives `DEFAULT_OPTIONS`, the validation and the README parity test. If the winner keeps its Zod config schema, generate the table from that schema.
  - `req.app` discovery on the first spec request, so the user does not have to pass the app.
  - The probe evidence on the environment's Node, Zod and Express versions.
  - `unrepresentable: 'any'` on `z.toJSONSchema`.
- **From scalability-first:**
  - Compile and memoize validators and JSON Schemas per schema in a `WeakMap`.
  - Wrap `res.json` only when `validateResponses` is not false.
  - A public `invalidate()` escape hatch for stale caches.
  - A Stryker scope on `config/`, `introspect/` and `registry/` to meet the 70% mutation floor.
  - An optional, non-blocking `bench/` job.
- **Reconsider in the winner:** use a hand-written or table-driven config validator instead of internal Zod. This keeps core independent of the schema library, which is the point of `SchemaAdapter` (Q0b).
