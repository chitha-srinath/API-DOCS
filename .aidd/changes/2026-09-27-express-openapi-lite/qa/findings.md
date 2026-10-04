# QA Findings — master list (collated & deduped)

Orchestrator collation of QA step 1 (post-review × 5 dimensions + delta + security). Source
files: `qa/findings-{correctness,security,performance,test-coverage,spec-compliance,delta}.md`,
`qa/security-report.md`. No same-file+line+claim duplicates found across dimensions — where
a file recurs (e.g. `src/config/merge.ts`), each dimension's finding is a distinct claim
(prototype-pollution vs. aliasing/mutation), so both are kept as separate rows.

Total: 20 findings — 1 CRITICAL, 3 HIGH, 8 MEDIUM, 8 LOW. Plus the security auditor's
separate threat matrix (0 CRITICAL/HIGH, 2 LOW dependency findings) in `qa/security-report.md`.

**Post-adversarial-verification update (step 3, see `qa/verdicts.md`):** F-01 CONFIRMED
(scope widened — reachable via the default adapter, not only the opt-in zod subpath).
F-02 CONFIRMED. F-04 CONFIRMED. **F-03 REFUTED at HIGH and demoted to LOW** — the
underlying O(n) lookup is real but the "breaches ADR-26" framing does not hold (wrong
budget applied) and the claimed magnitude/growth shape did not reproduce (measured
linear growth, well under budget). Effective counts after verification: 1 CRITICAL,
2 HIGH, 8 MEDIUM, 9 LOW. Three findings (F-01, F-02, F-04) enter the step 6 fix loop.

## CRITICAL (1) — requires adversarial verification (step 3)

| # | Source dim | file:line | Claim |
|---|---|---|---|
| F-01 | spec-compliance #1 | `src/spec/build.ts:107-131` | `.meta({id})`-tagged (named/reused) Zod schemas in `params`/`query` produce a dangling `$ref` to a dropped `$defs` bag — the resulting `/openapi.json` fails `OpenApiParser.validate()`, falsifying AC-015/AC-016 for an ordinary, spec-sanctioned Zod pattern. |

## HIGH (3) — requires adversarial verification (step 3)

| # | Source dim | file:line | Claim |
|---|---|---|---|
| F-02 | correctness #1 | `src/spec/glob.ts:5-9` | `escapeChar`'s global-flagged regex `.test()` leaves shared `lastIndex` state, silently failing to escape every other consecutive metacharacter in `autoDetect.exclude`/`include` globs — can silently over- or under-match routes. |
| F-03 | performance #1 | `src/introspect/index.ts:69` + `src/registry/registry.ts:22-25` | `findByHandle` is `O(n)` per walked layer, making introspection `O(n²)` in route count — measured 252ms at 2000 routes, breaching the 200ms ADR-26 budget; no bench/perf test exceeds 2 routes. |
| F-04 | performance #2 | `src/serve/router.ts:50-52`, `src/route/typed.ts:61-68` | `memoizeAdapter` (ADR-03) is defined, tested in isolation, and never wired into either composition-root adapter-resolution call site — dead code; every spec rebuild re-derives every schema's JSON Schema from scratch. |

## MEDIUM (8)

| # | Source dim | file:line | Claim |
|---|---|---|---|
| F-05 | correctness #2 | `src/introspect/paths.ts:67` | Non-global `.replace()` on `NAMED_WILDCARD` only converts the first of multiple named wildcards in one path; subsequent ones ship as literal `*name` in the OpenAPI path template with no warning. |
| F-06 | security #1 | `src/config/merge.ts:27-43` | `mergeTwo` has no `__proto__` denylist; a `JSON.parse`-sourced override object can substitute the merged result's prototype (scoped, not global-`Object.prototype`, hence MEDIUM not CRITICAL). |
| F-07 | security #2 | `src/index.ts:4`, `src/introspect/auto-record.ts:34` | Default-entry import unconditionally patches the process-wide `express` module at import time; two package-version copies race on the `Symbol.for` guard with only a debug-level mismatch log, no opt-out except importing `manual.ts`. |
| F-08 | test-coverage #1 | `src/config/merge.ts:39` | `mergeTwo` never clones pass-through values, so merged results can alias nested objects still owned by `defaults`/`global` inputs — untested; in-place mutation of a resolved options object could corrupt shared global config. |
| F-09 | test-coverage #3 | `src/config/validate.ts:31` | Zero test coverage for the top-level "not a plain object" rejection path (`validateOptions(5)`, `([])`, `('x')`). |
| F-10 | test-coverage #4 | `src/config/validate.ts:36-41` | Both branches of the group-key check (`undefined` → skip, non-object → throw) are untested for `docs`/`openapi`. |
| F-11 | test-coverage #5 | `src/adapter/zod.ts:29-33` | The `catch { return {}; }` fallback in `zodAdapter.toJSONSchema` is never actually triggered by any test — the "unrepresentable" test case doesn't throw, so a future regression removing the catch's safety would pass every test while breaking spec generation. |

## LOW (8)

| # | Source dim | file:line | Claim |
|---|---|---|---|
| F-12 | correctness #3 | `src/spec/build.ts:56-70` | `dedupe()`'s equal-rank tie-break silently degrades from `id`-based to array-position ordering when `id` is absent, contradicting its own doc comment's intent. |
| F-13 | security #3 | `src/docs/render.ts:36` | Unquoted `data-url=` HTML attribute in the docs UI template; `encodeSpecUrl` escapes quotes but not spaces, allowing attribute injection via a crafted `docs.specUrl`. |
| F-14 | security #4 | `src/docs/cdn.ts:8-10`, `src/docs/render.ts:37,53` | No Subresource Integrity (`integrity=`) on version-pinned CDN `<script>`/`<link>` tags for the docs UI. |
| F-15 | spec-compliance #2 | `src/adapter/zod.ts:30` | Zod's raw output (including its own top-level `$schema` keyword) is embedded unstripped into nested `requestBody`/`response` sub-schemas — unusual, not proven to break validation. |
| F-16 | test-coverage #2 | `src/config/merge.ts:31` vs `:36-40` | Explicit `null` override vs. `undefined` distinction is untested in a three-layer merge. |
| F-17 | test-coverage #6 | `src/adapter/standard.ts:50` | `out ?? NO_JSON_SCHEMA` fallback for a Standard Schema adapter that returns `null`/`undefined` from `jsonSchema[io]` is untested; matters for `memo.ts`'s reference-equality warn-once logic. |
| F-18 | test-coverage #7 | `src/adapter/errors.ts:28-29` | `ApiDocsSchemaError`'s optional `route` constructor argument and its message-template branch are never exercised by any test. |
| F-19 | test-coverage #8 | `src/route/typed.ts:55` | Per-route `meta.validateRequests` override (unlike its `validateResponses`/`onValidationError` siblings) has zero test coverage. |

## New from exhaustive testing (QA step 5)

| # | Source | file:line | Claim | Severity |
|---|---|---|---|---|
| F-21 | state-concurrency-idempotency (`qa/tests/state-concurrency-idempotency.md`) | `src/registry/registry.ts:11-16`, `src/spec/build.ts:55-72` | `RouteRegistry.register()` has no dedup; `dedupe()`'s first-registration-wins tie-break silently discards a developer's accidental duplicate `route()`/`describe()` call for the same method+path with no `EAD_*`-style warning. No AC violated. | LOW/advisory |

## New from step 6 fix-loop closure re-check

| # | Source | file:line | Claim | Severity |
|---|---|---|---|---|
| F-22 | spec-compliance closure re-check | `src/spec/build.ts` `hoistSchemaDefs` (~line 151, `if (!(name in defs))`) | Two different schemas sharing the same `.meta({id})` name silently collide: first-writer-wins, the second schema's actual definition is discarded, but both operations' `$ref`s point at the surviving entry — a structurally-valid but semantically-wrong OpenAPI doc (e.g. a route documented as accepting a `string` when its real schema is a `number`), with no error or warning. Independently reproduced via probe: `OpenApiParser.validate()` passes (so this does NOT reopen F-01), but the mismatch is silent. | MEDIUM |

## Delta (0 findings, 2 degradations)

F-20 area (informational, not a numbered finding): `qa/findings-delta.md` confirms ADR-54/55/56 intent-fidelity, structure-fit, and (within the `na`-sigma scope) no regression. Two protocol-compliant degradations noted there: the pre-construction snapshot predates the source tree (no literal tree-diff possible for structure-fit), and both quality-baseline.md packs carry `coverage: na`/`lint: na`, so sigma-regression on those two axes is out of scope per `context-snapshots.md`.

## Security-report threat matrix (separate artifact, not renumbered here)

`qa/security-report.md`: 0 CRITICAL/HIGH. 2 LOW (T-1 non-critical dev-dependency advisories — esbuild CWE-22/CVSS 2.5, qs×3 CWE-476/770/CVSS 5.3— both devDependency-only, never reach `dist/`). Threat matrix rows T-1/T-2/T-3 overlap conceptually with F-13/F-14 (cdnUrl/specUrl hardening) — cross-referenced, not double-counted.

## Adversarial verification queue (step 3)

CRITICAL/HIGH findings requiring one Adversarial Verifier each (cap 6, 4 needed): **F-01, F-02, F-03, F-04**.
