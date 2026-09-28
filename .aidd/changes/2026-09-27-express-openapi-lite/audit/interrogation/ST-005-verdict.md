# Auditor Verdict — ST-005

Round used: 1 of 2 (no challenge needed — every claim settled on first-pass independent
verification against the Builder Report + repo re-execution; no evidence gap found).

## Gate G-S05

`test/introspect/spike.contract.test.ts` re-run independently:

```
$ npx vitest run test/introspect/spike.contract.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
Type Errors  no errors
```

2 tests = `describe.each(majors)` over both express5 (root) and express4 (alias) per
`test/fixtures/majors.ts`. Read the test body: it asserts `log.warns()` deep-equals `[]`
(zero warn calls) and the exact S-4b operation set (nested router, sub-app, wrapped
handler, plain route). **Gate genuinely proven** — PASS on both majors, zero warns,
matches architecture.md's expected S-4b shape.

## Per-AC verdicts

| AC id | verdict | evidence cited | note |
|---|---|---|---|
| AC-022 | PROVEN | `test/describe/describe.test.ts` read directly: registers via `RouteRegistry.register` with `source: 'describe'`, middleware wraps a handler that a request with an invalid `:id` and bogus query still reaches (asserts `response.status === 200`), across both majors. Test file confirmed to exist and match the AC's Given/When/Then exactly. |
| AC-023 (walk half only, per Boundaries/ADR-32) | PROVEN | `test/introspect/walk.test.ts` read directly: asserts `/api/users/{id}` has exactly 2 ops (`get`,`post`) with `pathParams: ['id']`, via `describe.each(majors)`. Independently re-ran `npx vitest run test/introspect test/describe --no-coverage`: 12 files, all pass (72 passed / 5 skipped). Story text and Boundaries section correctly scope this AC to the walk side only — operationId/200/tag `api` are explicitly S-06's per ADR-32, so the Builder's narrower claim is the correct one, not an evasion. |
| AC-030 (walk side only) | PROVEN | `walk.test.ts` `autoDetect: false` test read directly: hides `/plain-hidden` while keeping the registry-sourced `/typed` op. `exclude` glob correctly deferred to S-06 per Boundaries — not disputed. |
| AC-031 | PROVEN | `walk.test.ts` identity-match test read directly: same method+path registered once via registry and once as a plain route dedupes to exactly 1 op with `source: 'typed'` and the typed meta, via `findByHandle`. |
| AC-032 | PROVEN | `walk.test.ts` late-mount test read directly: route added after first `introspect()` call is absent on the first walk, present on the second. Matches AC's Given/When/Then on re-walk semantics. |
| AC-033 | PROVEN | `walk.test.ts` own-path test read directly: `ownPaths: ['/openapi.json','/docs']` filters both from the detected set while `/kept` remains. |
| AC-034 | PROVEN | `test/introspect/paths.test.ts` read directly: `:id`→`{id}`, `/*rest`→`{rest}` (v5-only, `skipIf`), RegExp and unnamed `*` each skip via `debugs('EAD_REGEXP_PATH_SKIPPED'\|'EAD_WILDCARD_SKIPPED')` with no throw, two calls to `convertExpressPath` with the same input are deep-equal (determinism proxy for "byte-identical", correctly caveated in the Builder Report — the actual spec-serialization byte check is S-06's, since this story returns `DetectedOperation[]`, not a serialized spec — consistent with Boundaries). |

## Mutation claim (ADR-50 scope) — independently reproduced, not trusted

The Builder Report claims: `All files 100.00 | 100.00 | 402 | 2 | 0 | 0 | 0` (402 killed,
2 timeout counted as killed, 0 survived, score 100.00 ≥ break threshold 70).

Read the actual on-disk mutation report `reports/stryker-incremental.json` directly (not
just the printed table) and tallied mutant statuses programmatically:

```
$ node -e "
const d=require('./reports/stryker-incremental.json');
let killed=0,survived=0,timeout=0,noCoverage=0,total=0;
for (const f in d.files) for (const m of d.files[f].mutants) {
  total++;
  if(m.status==='Killed') killed++;
  else if(m.status==='Survived') survived++;
  else if(m.status==='Timeout') timeout++;
  else if(m.status==='NoCoverage') noCoverage++;
}
console.log({total,killed,survived,timeout,noCoverage});
"
{ total: 404, killed: 402, survived: 0, timeout: 2, noCoverage: 0 }
```

404 = 402 killed + 2 timeout, 0 survived, 0 no-coverage — matches the claimed row exactly.
Also confirmed the report's file set is exactly the ADR-50 mutate scope:
`src/introspect/{auto-record,index,paths,recorder,sniff}.ts` + `src/route/describe.ts`
(6 files, no scope creep, no missing file). **Claim independently corroborated from the
raw report, not just the Builder's printed summary — genuinely proven, unusually high
score is real for this scope.**

## Non-blocking note (not disputed)

The Builder Report's "Known non-blocking finding for S-07" (dist bundling drops the
`auto-record` side effect via tsup/esbuild `sideEffects` elision) was independently
reproduced during the `npm test` pretest build (`tsup` warning: "Ignoring this import
because 'src/introspect/auto-record.ts' was marked as having no side effects" for both
`dist/auto-record.js` (0 bytes) and `.cjs`). Per this interrogation's scope instructions,
this is a separately-tracked defect routed to the architect and does not affect any of
ST-005's ACs, all of which test against `src/` directly. **Not disputed, out of scope.**

## Summary

7/7 ACs PROVEN, gate G-S05 PROVEN, mutation claim independently reproduced and
corroborated. Zero challenge rounds required — no evidence gaps found on first-pass
interrogation.
