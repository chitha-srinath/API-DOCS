# Judge Scorecard — judge 2

<!-- One per Arch Judge. Fixed rubric; 1–5 each; no ties in ranking. -->

Degradation: `.aidd/context/snapshot.md` was not re-read. All three candidates cite it as showing an empty tracked tree, which is consistent with the git status (only untracked `.aidd/`, `.claude/`, `.gitignore`, `AGENTS.md`). There is no repo precedent, so every score cites the candidate text, prd.md or constitution.md.

| Candidate | Fit-to-constitution | Simplicity | Risk | Testability | Evolvability | Total |
|---|---|---|---|---|---|---|
| simplicity-first | 4 | 5 | 3 | 4 | 3 | 19 |
| scalability-first | 4 | 2 | 3 | 4 | 5 | 18 |
| risk-first | 4 | 3 | 5 | 5 | 4 | 21 |

## Ranking & rationale (≤5 lines per candidate)

1. **risk-first (21), the winner.** It isolates the top risk, Express private internals, in separate `introspect/express4.ts` and `express5.ts` modules. Every layer is walked under a try/catch and degrades to "undocumented route" (C5, trade-offs). This fits AC-023 and AC-032–034 best.
   - It is the only candidate that gates the dual build with `publint` and `attw --pack` (C10). That directly de-risks AC-002 and AC-003.
   - Its stack fingerprint counts layers across nested stacks (C7), so it covers AC-032 for nested routers.
   - Deductions: it uses internal Zod for config (C1), which couples core to the peer the `SchemaAdapter` promises to abstract (Fit/Evolvability -1). It also has two introspectors and a canonical sorter, about double the test surface by its own admission (Simplicity 3).
   - It does not mention Stryker, the constitution's 70% mutation floor.
2. **simplicity-first (19).** It has about 10 files, zero runtime dependencies, and one `OPTION_SPEC` table that drives `DEFAULT_OPTIONS`, the types, validation and the README test (C1). That is an elegant answer to AC-029, AC-036 and AC-046. It also includes a real environment probe with exit 0.
   - Its risk is weak on two points. First, the cache is keyed on top-level stack length only, and the candidate admits routes added to a nested router are missed. That makes AC-032 fragile. Second, `res.json`-only response validation leaves `res.send` uncovered for AC-012–014.
   - Implicitly reading `package.json` via `process.cwd()` is a hidden side effect. It has a single `detect.ts` with "two small version shims" and no contract-test isolation.
   - No mutation testing is mentioned.
3. **scalability-first (18).** It has the strongest evolvability: ports, `invalidate()`, per-version introspectors and a hand-written validator that keeps core adapter-agnostic (C1, C6, C10). It is the only candidate that cites Stryker, which fits the constitution.
   - It is over-built for a greenfield library. The fragment cache, ETag/304, component hashing, `bench/` and a `picomatch` runtime dependency add about 4 modules, and the candidate itself says "<50 routes gain is not measurable" (Simplicity 2).
   - More caches add more invalidation surface. The candidate admits the in-place layer-replace miss (Risk 3).
   - Component hoisting by structural hash could perturb byte-identity (AC-034) unless the hash is fully deterministic.

## Best ideas worth grafting from non-winners

- **From simplicity-first:**
  - Use a single declarative `OPTION_SPEC` table as the source of truth for defaults, validation, types and the README table test. It could replace risk-first's internal Zod config schema, which removes the peer coupling.
  - Keep zero runtime dependencies and an in-house glob limited to `*`/`**`.
  - Resolve `app` from `req.app` so auto-detection needs no extra config.
- **From scalability-first:**
  - Expose a public `invalidate()` escape hatch.
  - Compile validators and memoize JSON Schema conversions in a `WeakMap` at definition time, keeping the hot path O(1).
  - Run Stryker on `config/`, `introspect/` and the registry to meet the constitution's 70% mutation floor.
  - Test Express 4 and 5 in one run through an `express4` npm alias. Risk-first also proposes this.
- **Reject:** ETag/304, component hash-hoisting and the bench harness, because they are unneeded for v1.
