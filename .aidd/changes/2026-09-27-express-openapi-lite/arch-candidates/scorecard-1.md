# Judge Scorecard — judge 1

<!-- One per Arch Judge. Fixed rubric; 1–5 each; no ties in ranking. -->
<!-- Degradation: .aidd/context/snapshot.md not read directly; all three candidates state it shows an empty tracked tree (greenfield), so there is no repo precedent to cite. Scores cite candidate text, prd.md and constitution.md. -->

| Candidate | Fit-to-constitution | Simplicity | Risk | Testability | Evolvability | Total |
|---|---|---|---|---|---|---|
| simplicity-first | 4 | 5 | 2 | 4 | 3 | 18 |
| scalability-first | 3 | 2 | 3 | 3 | 5 | 16 |
| risk-first | 5 | 3 | 5 | 5 | 4 | 22 |

## Ranking & rationale (≤5 lines per candidate)

**1. risk-first (22).**
- It puts its effort where the PRD is fragile. It has per-version introspector adapters, walks each layer under try/catch so detection never throws (AC-034), and uses a stack fingerprint that covers nested stacks (AC-032).
- The config schema, the `ApiDocsOptions` type and the runtime check come from one source (component 1), so AC-045 and AC-046 cannot drift.
- publint and `attw --pack` directly cover the dual-package hazard (AC-002/003). The per-port contract tests, which include a stub adapter (AC-005), give the strongest testability.
- Minus: validating config with Zod ties core to the Zod peer, and there are more modules and tests to maintain (it admits the test surface roughly doubles).

**2. simplicity-first (18).**
- It has the lowest surface: about 10 files and zero runtime dependencies. The `OPTION_SPEC` table drives defaults, validation and the README test from one source (AC-029/036).
- It carries three concrete risks:
  - Its cache is keyed only on the top-level stack length. It admits this misses routes added to an already-mounted nested router, which puts AC-032 and the nested case in AC-023 at risk.
  - Default `openapi.info` is read from the consumer's `package.json` through `process.cwd()`. That makes the defaults depend on the environment, which conflicts with AC-036 (a deep-frozen `DEFAULT_OPTIONS` that deep-equals the resolved config).
  - It swaps Express with `npm i express@4 --no-save` per cell, so Express 4 and 5 are not both covered in one local run.
- Its evolvability is limited because it has a single `detect.ts` with shims instead of a port.

**3. scalability-first (16).**
- Its ports are clean and it exposes `invalidate()`, which gives the best evolvability. Its stack-signature cache fixes the nested-router gap.
- But it optimises for 1k-route monoliths the PRD never asks for. The ETag/304 layer, the fragment cache, component hashing and the `bench/` harness add about 4 modules that it admits give "no measurable gain" under 50 routes.
- `picomatch` becomes a runtime dependency, which is allowed by AC-004 but adds supply-chain surface.
- Hoisting components by structural hash adds nondeterminism risk to the byte-identity requirement (AC-034) and to `$ref` correctness.
- Its hand-written config validator gives no single source of truth with the types (AC-046).

## Best ideas worth grafting from non-winners

- **From simplicity-first:**
  - One declarative `OPTION_SPEC` table that also generates the README defaults-table test (AC-029).
  - An in-house glob of `*`/`**` only, with no `picomatch`.
  - Get the app from `req.app` on the first spec request, so the user does not pass `app`.
  - Use `unrepresentable: 'any'` on `z.toJSONSchema`, and document the lossy output.
  - The concrete environment probe (node 24.11.1, zod 4.6.5, express 5.2.1).
- **From scalability-first:**
  - Expose a public `invalidate()` escape hatch for in-place layer replacement.
  - Pre-bind validators and memoize JSON Schema conversion with a `WeakMap` at definition time.
  - Resolve per-route options once, at definition time.
  - Skip wrapping `res.json` entirely when `validateResponses` is off.
  - Stryker on `config/`, `introspect/` and the registry against the 70% mutation floor, which is a constitution bar that only this candidate names.
- **Do not graft:**
  - Reading `openapi.info` defaults from `process.cwd()`, because it conflicts with AC-036.
  - ETag and structural-hash component hoisting, both out of scope for v1.
