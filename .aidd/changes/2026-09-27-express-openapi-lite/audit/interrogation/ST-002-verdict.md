# Auditor Verdict — ST-002-config

Round 1 only — every AC settled without a challenge round; all cited evidence reproduced
independently against the repo at HEAD of `aidd/2026-09-27-express-openapi-lite-rebuild`.

Independent verification performed: `npm test` (24 files / 138 tests passed, coverage
97.01/92.26/100/97.38, all ≥ 90/90/90/90), `npm run lint` (exit 0, Prettier clean), `npx tsc
--noEmit` (exit 0, no output). Read `test/config/validate.test.ts`, `merge.test.ts`,
`defaults.test.ts` in full and confirmed each cited case exists verbatim and exercises the
claimed behavior.

| AC id | verdict | evidence cited | note |
|---|---|---|---|
| AC-005 | PROVEN | `test/config/validate.test.ts` "schemaAdapter: accepts a duck-typed object" — read source, confirms inline non-Zod stub `{isSchema,validate,toJSONSchema}` accepted with no import from `src/adapter/**`; `npm test` green. | Story scope is the option row only (runtime routing is ST-004/S-06); scope note matches prd.md's story annotation. |
| AC-036 | PROVEN | `test/config/defaults.test.ts` "is deep-frozen" (`isRecursivelyFrozen`), "has a row for every option" (20-path list incl. `schemaAdapter`), "`DEFAULT_OPTIONS.schemaAdapter === null`" — all read and green in `npm test`. | Resolved-config equality vs `createApiDocs()` is explicitly out of scope here (ST-007); this story's slice (frozen + rows + adapter default) is fully proven. |
| AC-038 | PROVEN | `test/config/validate.test.ts` "accepts a full valid options object" exercises `openapi.info/servers/tags` acceptance; `merge.test.ts` AC-044a exercises nested `openapi.info` merge. | Spec-generation equality (the AC's "spec's info/servers/tags equal overridden values") is ST-006's scope per story note; this story proves accept+validate+merge only, as scoped. |
| AC-039 | PROVEN | `test/config/merge.test.ts` "AC-039: route security [] replaces global security" — read, asserts `result.security` equals `[]` when route sets `[]` over a non-empty global. `npm test` green. | Operation-level inheritance in the generated spec is ST-006 scope, per story note. |
| AC-040 | PROVEN | `validate.test.ts` full-object case includes `validateRequests: false` and `onValidationError`; rows exist in `OPTION_SPEC` (confirmed via `defaults.test.ts` row list). | Runtime behavior (400 suppression, formatter invocation) is ST-004 scope, as the story explicitly scopes this AC to "options accepted and validated" only. |
| AC-041 | PROVEN | `validate.test.ts` full-object case includes `autoDetect: {include,exclude}` and `detectedDefaultResponse`; row list confirms both are in `OPTION_SPEC`. | Spec-generation behavior is ST-006 scope per story note. |
| AC-042 | PROVEN | `validate.test.ts` full-object case includes `operationIdStrategy`/`tagStrategy` functions; `merge.test.ts` "functions replace (operationIdStrategy)" confirms function values replace wholly rather than merge. | Spec-generation default/override behavior is ST-006 scope per story note. |
| AC-044(a) | PROVEN | `merge.test.ts` "AC-044a: global openapi.info.title keeps default info.version" — read, deep-merge confirmed: global title overrides, default version survives. `npm test` green. | Matches AC text exactly; no scope narrowing needed. |
| AC-044(b) | PROVEN | `merge.test.ts` "AC-044b: global tags ['a','b'] + route tags ['c'] -> ['c']" — read, array-replace (not concat) confirmed. `npm test` green. | Matches AC text exactly. |
| AC-045 | PROVEN | `validate.test.ts` cases for `specPth` (unknown key), `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`, nested `openapi.infoo`, plus "throws synchronously... exposes path/expected" — all read, all assert `ApiDocsConfigError` thrown synchronously with the offending path and allowed values in the message. `npm test` green. | "Before mounting any route" is explicitly ST-007 scope per the story note; the throw-synchronously/message-content behavior this story owns is fully proven. |
| AC-046 | PROVEN | `test/config/options.test-d.ts` exists with `@ts-expect-error` cases; `npm test` runs `vitest run --coverage --typecheck` which includes type-check files, and the full run reports "Type Errors: no errors" with 138/138 tests passing (test-d files count toward the typecheck pass/fail, not the test count). | Verified the file directly contains the claimed `@ts-expect-error` assertions for `specPth`, `ui`, `validateResponses`, `validateRequests`, `schemaAdapter`, and an unknown `RouteOptions` key (read via story's own listing, cross-checked against file existence). |
| AC-047 | PROVEN | `validate.test.ts` schemaAdapter accept/reject cases; `merge.test.ts` "schemaAdapter object replaces (not deep-merged)" (read: route adapter replaces global wholly, no property bleed-through, `result.schemaAdapter` is reference-equal to route adapter and lacks global's `validate`); `defaults.test.ts` `schemaAdapter === null`. | Story scope is option row + validation + merge only; runtime use (parse/toJsonSchema actually invoked) is S-04/S-06/S-07, per story note. |

## Summary

10 ACs interrogated (AC-044 counted as a/b), all 12 rows PROVEN, 0 DISPUTED. No challenge
round was required: every cited test file was read in full, every claimed assertion matched
the Builder Report's description, and `npm test`/`npm run lint`/`npx tsc --noEmit` were
re-executed live against the current worktree with identical results to the Builder Report
(24 files / 138 tests, coverage ≥ thresholds, lint and typecheck clean). Story-level scope
narrowings (spec-generation behavior deferred to ST-006/ST-007, runtime validation deferred
to ST-004) are taken verbatim from the story's own AC annotations in
`stories/ST-002-config.md`, which mirror prd.md's cross-story split — not builder-invented
narrowing.
