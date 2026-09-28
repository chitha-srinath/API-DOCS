# QA Findings — delta

Reviewer mode=delta. Inputs read (all four, per reviewer.md mode=delta):
1. `.aidd/context/history/2026-09-27T13-10-45Z-pre-construction/{snapshot.md,quality-baseline.md}` (correct pre-construction pack, not pre-qa).
2. `.aidd/changes/2026-09-27-express-openapi-lite/pre-review/{coupling-risk,feasibility,pattern-fit,test-strategy}.md` (48/67/53/104 lines, read in full).
3. `git diff 4cea289..HEAD` (12 commits).
4. Current `.aidd/context/quality-baseline.md` (2026-09-28T20-13-53Z, pre-qa) vs. the pre pack's copy.

**Degradation noted:** the pre-construction snapshot.md predates all source code (no src/, dist/, or test/ tree beyond the AIDD framework's own count of 1) — it captures architecture.md's documented module map, not a live tracked-file tree. structure-fit below is judged against architecture.md's C-table paths as carried in that pack, corroborated by the current tracked tree, rather than a literal pre/post tree diff.

## Binding 1 — intent-fidelity: 0 findings

ADR-54 (`route()` 4-arg, singular `meta.response`) verified directly in `src/route/typed.ts:19-23` (`RouteMeta.response?: RS`, singular) — matches architecture.md's corrected C3 row. ADR-56 (`createDescribe({registry}) => describe(method, localPath, meta)`) verified verbatim in `src/route/describe.ts:17-18`. ADR-55 (`sideEffects` array fix) verified in `package.json:59-63` — exactly the prescribed third entry `"src/introspect/auto-record.ts"` added, dist entries and tsup.config.ts untouched, and `ST-007-verdict.md:66,68` documents runtime (non-test-framework) verification of the recorder symbol, the evidence class ADR-55 required.

Grepped `pre-review/*.md` for `route(meta`, `api.route`, `describe(`, `createDescribe` — zero hits asserting the original (pre-ADR) 2-arg `route()`/1-arg `describe()` shapes as load-bearing. So there is no pre-review claim the diff contradicts; the divergence being reconciled was between architecture.md's original (unamended) text and ADR-27c's synchronous-registration requirement, exactly as ADR-54/56 state, not a pre-review-vs-diff divergence. All three ADRs' downstream guidance (re-check AC-006/022/031/047 wording, re-check README) is satisfied — README/CHANGELOG land in commit `6a721d8`, after both signature ADRs were ratified.

## Binding 2 — structure-fit: 0 findings

Current `src/{adapter,config,core,docs,introspect,registry,route,serve,spec}` and `test/{...}` mirror architecture.md's component-table module names verbatim (C3 `route/typed.ts`, C4 `route/describe.ts`) as carried in the pre-construction pack's snapshot.md. The three backflow-affected files (`src/route/typed.ts`, `src/route/describe.ts`, `package.json`) sit exactly where architecture.md's C3/C4 rows and ADR-55's ownership clause place them — no ad hoc relocation.

## Binding 3 — sigma-regression: 0 findings raisable

Both packs' quality-baseline.md carry explicit `coverage: na` and `lint: na` rows — per context-snapshots.md § Measured sigmas, these two regression classes are explicitly out of scope for this dispatch since neither pack has a measured row; stating this rather than raising against an `na` row, as required. The only measured rows both packs share: test-file count 1 → 89 (expected growth from 8 stories, not a regression), TODO/FIXME markers 4 → 4 (unchanged). "Largest files" hotspot proxy reads `0 total` in both packs (the probe command no-ops on this repo shape in both), so no hotspot comparison is possible from either pack — a second, narrower degradation, not a finding.

## Summary

0 findings across all three bindings; two degradations noted (pre-construction snapshot predates source tree for literal structure diff; coverage/lint/hotspot sigmas are `na` in both packs, out of scope per protocol).
