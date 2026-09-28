# Auditor Verdict — ST-003-schema-adapter

Round 1 only — every AC settled without a written challenge round, because the one gap the
Builder Report itself flagged (the live zod@4.2.0 floor install-test, and the scoped Stryker
mutation run) was closed by the auditor running the missing evidence directly rather than
issuing a formal challenge/response cycle, per protocol step 4 ("verify independently...
do not take the evidence block's word for it").

Independent verification performed:
- `npm test` — 24 files / 138 tests passed, coverage 97.01/92.26/100/97.38 (src/adapter
  97.56/86.95/100/98.71), all ≥ 90/90/90/90.
- `npm run lint` — exit 0, Prettier clean. `npx tsc --noEmit` — exit 0.
- **Zod floor gap closed live:** `npm i --no-save zod@4.2.0` (confirmed installed via
  `node_modules/zod/package.json` version `4.2.0`), then
  `npx vitest run test/adapter/standard-floor.test.ts` → `Test Files 1 passed (1)`,
  `Tests 1 passed (1)`. Restored the devDependency afterward with `npm ci`, re-confirmed
  `node_modules/zod/package.json` version `4.6.5`.
- Read `test/adapter/contract.test.ts`, `standard.test.ts`, `infer.test-d.ts` in full;
  confirmed every claimed assertion (isSchema, valid/invalid, nested dotted path, toJSONSchema
  shape, duck-type/no-zod-source scan, `Infer<S>` type equality with a `@ts-expect-error`)
  exists verbatim.

| AC id | verdict | evidence cited | note |
|---|---|---|---|
| AC-004 | PROVEN | Manifest slice (peerDependencies `express ^4.21.0\|\|^5.0.0`, `zod ^4.2.0`, `peerDependenciesMeta.zod.optional: true`, `engines.node >=22`) confirmed by reading `package.json` directly. Zod-free `standard.ts`/`standard-types.ts`/`errors.ts` confirmed by `standard.test.ts`'s source-scan assertion, re-run green. **Floor claim re-proven live** by the auditor: `npm i --no-save zod@4.2.0` + `npx vitest run test/adapter/standard-floor.test.ts` → 1/1 passed, then devDependency zod 4.6.5 restored via `npm ci`. | Builder skipped this exact check ("time-boxed"); it is now independently PROVEN rather than resting on the builder's unexecuted claim. `./zod` subpath/main-entry ESM+CJS load tests are explicitly S-07 scope per the story note — not claimed here, not required for this verdict. |
| AC-005 | PROVEN | `test/adapter/contract.test.ts` `describe.each` over `standardSchemaAdapter`, `zodAdapter`, `stubAdapter`, `memoizeAdapter(stubAdapter)` — read in full; stub case validates via the same shared contract suite as the real adapters, and "passes the ADR-38 duck-type check" + "has no zod or ~standard in its source" cases confirmed present and green in `npm test`. | Route/spec wiring (routes "appear in the generated spec") is explicitly S-04/S-06 scope per the story note; the port + stub-fixture-passes-the-contract slice this story owns is fully proven. |
| AC-006 | PROVEN | `test/adapter/infer.test-d.ts` read in full: `expectTypeOf<Infer<typeof zodSchema>>().toEqualTypeOf<{id:string}>()`, same for the stub path, plus a `// @ts-expect-error` on `{id:1}`. `npm test` (`--typecheck`) reports "Type Errors: no errors" across all 24 files. | Matches AC text's type-level requirement exactly for the `Infer` hook this story owns. |
| AC-016 | PROVEN | `test/adapter/zod-jsonschema.test.ts` and `standard.test.ts` (read) prove draft-2020-12 `$schema`, `required` arrays, and input/output divergence for a `.default()` field — the schema-conversion slice. | Route/path-level behavior (`/users/{id}`, path/query params, requestBody assembly) is explicitly ST-004/ST-006 scope per the story note; not claimed by this story, correctly excluded here. |
| AC-035 | PROVEN | `standard.test.ts` (read): `validate(z.object({id:z.coerce.number()}), {id:'3'})` deep-equals `{ok:true,data:{id:3}}`, proving `standardSchemaAdapter` accepts Zod v4 schemas with zero core-side zod import (cross-checked against the no-zod-import source-scan test in the same file). `npm test` green. | The e2e slice (`GET /openapi.json`/`GET /docs`/400 problem+json) is explicitly S-07 scope per the story note; default-adapter behavior this story owns is proven. |
| AC-047 | PROVEN | `test/fixtures/stub-adapter.ts` exists and is exercised by `contract.test.ts`'s `describe.each` (including `memoizeAdapter(stubAdapter)`), proving the fixture's `validate`/`toJSONSchema` members behave to the shared contract. | Route/spec-level wiring ("stub adapter's parse and toJsonSchema are used, per-route overrides global") is explicitly S-04/S-06/S-07 scope per the story note; the fixture-delivery slice this story owns is proven. |

## Open item — not blocking the ACs above, factored explicitly

The Builder Report also flagged skipping the **scoped Stryker mutation run**
(`npx stryker run --mutate "src/adapter/**" --incremental`, break threshold 70, ADR-50(a)).
This is a **merge-gate** requirement (ADR-27(d)/ADR-50(a)/test-strategy #7), not language any
of the six interrogated ACs (AC-004, AC-005, AC-006, AC-016, AC-035, AC-047) ties its proof
to — none of their PRD text or this story's test-plan items name a mutation score as the
evidence for those specific ACs. It is therefore **not** grounds to mark any of the six
DISPUTED, but it is an outstanding gate item: **this story's merge cannot be certified
complete until the scoped mutation run is executed and its score (>= 70) is recorded** per
ADR-50(a) and the story's own "Merge gate" section. Flagging to the Master Agent as a
required follow-up before merge sign-off, separate from this AC verdict.

## Summary

6 ACs interrogated, 6 PROVEN, 0 DISPUTED. The builder-flagged zod@4.2.0 floor gap was closed
directly by the auditor (live install + test run, passed 1/1, devDependency restored) rather
than via a challenge round, since it was reproducible in one command. The builder-flagged
scoped-mutation gap remains open as a merge-gate item (not an AC-proof gap) and is escalated
to the Master Agent for a required pre-merge follow-up.
