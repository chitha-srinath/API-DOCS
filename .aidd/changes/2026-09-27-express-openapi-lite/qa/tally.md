# Tally — 2026-09-27-express-openapi-lite

No Jira ticket for this change (`jira.ticket: null`, `jira.sync: false` in `state.yaml`) —
per dispatch instructions the Jira read ladder is skipped; every tracked work item below
is a PRD AC (AC-001..AC-047, `prd.md`) joined to its claiming story/stories (`stories/*`
frontmatter `ac_ids`), the diff files that realized it (from each story's Builder Report
`git diff --stat`), the tests that prove it (`ac-matrix.md`, cross-checked against
`qa/test-report.md`), and its pre/post evidence (`evidence/pre/manifest.md`,
`evidence/post/manifest.md`).

`prd.md`'s "Affected flows" table lists only 7 end-to-end flows (F-1..F-7) against 47 ACs;
most ACs are proven at the unit/integration level (`ac-matrix.md`), not by a dedicated
F-flow. Per the tally role's step-3 rule, ACs with no owning flow get `na` with that stated
reason in the pre/post evidence columns — this is not a gap, since AC-matrix already
supplies independently-executed, green test evidence for every AC.

| item id | type | ACs | stories | diff files | tests | pre evidence | post evidence | verdict RECONCILED\|GAP |
|---|---|---|---|---|---|---|---|---|
| AC-001 | PRD AC | AC-001 | ST-001, ST-007 | `package.json`, `LICENSE`, `.gitignore` (ST-001); `src/index.ts`, `src/manual.ts`, `src/zod.ts` (ST-007) | `test/dist/manifest.test.ts`, `test/entries/parity.test.ts` | `evidence/pre/F-1.txt` (ABSENT — no package.json, exit 127) | `evidence/post/F-1.txt` (PRESENT — build+pack exit 0) | RECONCILED |
| AC-002 | PRD AC | AC-002 | ST-001 | `tsup.config.ts`, `package.json`, `src/index.ts`, `src/manual.ts`, `src/zod.ts`, `src/auto-record.ts` | `test/dist/pack.test.ts`, `test/dist/build-shape.test.ts` | `evidence/pre/F-1.txt` | `evidence/post/F-1.txt` | RECONCILED |
| AC-003 | PRD AC | AC-003 | ST-007 | `test/entries/parity.test.ts` (new), `src/index.ts`, `src/manual.ts` | `test/entries/parity.test.ts`, `test/aidd-exhaustive/regression-compat/aidd_exhaustive_regression.test.ts::TC-REG-004` | na — no dedicated F-flow; ESM/CJS parity is a unit-level check, not one of prd.md's F-1..F-7 flows | na — same reason | RECONCILED |
| AC-004 | PRD AC | AC-004 | ST-001, ST-003, ST-007 | `package.json` (ST-001); `src/adapter/standard-types.ts`, `src/adapter/zod.ts` (ST-003); `src/manual.ts`, `src/zod.ts` (ST-007) | `test/dist/manifest.test.ts`, `test/adapter/standard-floor.test.ts`, `test/entries/manual.test.ts`, `test/entries/no-zod-load.test.ts`, `test/entries/zod-subpath.test.ts` | `evidence/pre/F-1.txt` | `evidence/post/F-1.txt` | RECONCILED |
| AC-005 | PRD AC | AC-005 | ST-002, ST-003, ST-004, ST-006 | `src/config/spec-table.ts`, `src/config/validate.ts` (ST-002); `test/fixtures/stub-adapter.ts` (ST-003); `src/route/typed.ts` (ST-004); `src/spec/build.ts` (ST-006) | `test/route/stub-adapter.test.ts`, `test/spec/stub-adapter.test.ts`, `test/serve/schema-adapter.test.ts`, `test/aidd-exhaustive/functional-happy-path/happy-path.test.ts::TC-HAPPY-005` | na — no dedicated F-flow (F-7 is closest but exercises `schemaAdapter` end-to-end, see AC-047) | na — same reason | RECONCILED |
| AC-006 | PRD AC | AC-006 | ST-003, ST-004 | `src/adapter/standard-types.ts` (ST-003); `src/route/typed.ts` (ST-004) | `test/adapter/infer.test-d.ts`, `test/route/typed.test-d.ts` | na — type-level AC, no runtime F-flow | na — same reason | RECONCILED |
| AC-007 | PRD AC | AC-007 | ST-004 | `src/route/validate-request.ts`, `src/route/problem.ts` | `test/route/request-validation.test.ts`, `test/aidd-exhaustive/negative-error-handling/negative.test.ts::TC-NEG-030..032,036` | `evidence/pre/F-4.txt` (ABSENT — no server, curl exit 7) | `evidence/post/F-4.txt` (PRESENT — HTTP 400 problem+json body captured) | RECONCILED |
| AC-008 | PRD AC | AC-008 | ST-004 | `src/route/validate-request.ts` | `test/route/request-validation.test.ts`, `TC-NEG-033`, `test/aidd-exhaustive/api-contract/run.mjs::TC-CONTRACT-017` | na — no dedicated F-flow beyond the single F-4 body case | na — same reason | RECONCILED |
| AC-009 | PRD AC | AC-009 | ST-004 | `src/route/validate-request.ts`, `src/route/typed.ts` | `test/route/request-validation.test.ts`, `TC-HAPPY-007-009` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-010 | PRD AC | AC-010 | ST-004 | `src/route/validate-request.ts` | `test/route/request-validation.test.ts` (`AC-044d` case), `TC-NEG-034` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-011 | PRD AC | AC-011 | ST-004, ST-006 | `src/route/problem.ts` (ST-004); `src/spec/build.ts` (ST-006) | `test/route/problem.test.ts`, `test/spec/build.test.ts`, `TC-HAPPY-010` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-012 | PRD AC | AC-012 | ST-004 | `src/route/validate-response.ts` | `test/route/response-validation.test.ts`, `TC-NEG-039` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-013 | PRD AC | AC-013 | ST-004 | `src/route/validate-response.ts` | `test/route/response-validation.test.ts`, `TC-NEG-038` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-014 | PRD AC | AC-014 | ST-004 | `src/route/validate-response.ts` | `test/route/response-validation.test.ts`, `test/route/send-delegation.test.ts`, `TC-NEG-037`, `TC-CONTRACT-027` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-015 | PRD AC | AC-015 | ST-006 | `src/spec/build.ts` | `test/spec/build.test.ts`, `TC-CONTRACT-012/013/018` | `evidence/pre/F-3.txt` (ABSENT — connection refused) | `evidence/post/F-3.txt` (PRESENT — HTTP 200, `openapi:"3.1.0"`) | RECONCILED |
| AC-016 | PRD AC | AC-016 | ST-003, ST-006 | `src/adapter/zod.ts` (ST-003); `src/spec/build.ts` (ST-006) | `test/adapter/zod-jsonschema.test.ts`, `test/spec/build.test.ts` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-017 | PRD AC | AC-017 | ST-006 | `src/spec/build.ts` | `test/spec/build.test.ts` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-018 | PRD AC | AC-018 | ST-007 | `src/docs/render.ts`, `src/docs/cdn.ts`, `src/serve/router.ts` | `test/docs-ui/render.test.ts` | `evidence/pre/F-5.txt` (ABSENT — connection refused) | `evidence/post/F-5.txt` (PRESENT — HTTP 200, Scalar CDN body captured) | RECONCILED |
| AC-019 | PRD AC | AC-019 | ST-007 | `src/docs/render.ts`, `src/docs/cdn.ts` | `test/docs-ui/render.test.ts` | `evidence/pre/F-5.txt` | `evidence/post/F-5.txt` | RECONCILED |
| AC-020 | PRD AC | AC-020 | ST-001, ST-007 | `package.json` (ST-001); `src/docs/render.ts` (ST-007) | `test/docs-ui/render.test.ts`, `test/dist/pack.test.ts` | `evidence/pre/F-1.txt` | `evidence/post/F-1.txt` | RECONCILED |
| AC-021 | PRD AC | AC-021 | ST-004 | `src/route/typed.ts`, `src/registry/registry.ts` | `test/route/incremental.test.ts`, `TC-HAPPY-018` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-022 | PRD AC | AC-022 | ST-005 | `src/route/describe.ts` | `test/describe/describe.test.ts`, `TC-HAPPY-019` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-023 | PRD AC | AC-023 | ST-005, ST-006 | `src/introspect/index.ts`, `src/introspect/paths.ts` (ST-005); `src/spec/build.ts` (ST-006) | `test/introspect/walk.test.ts`, `test/spec/ac023.test.ts` | `evidence/pre/F-6.txt` (ABSENT — connection refused) | `evidence/post/F-6.txt` (PRESENT — `/widgets-plain` auto-detected) | RECONCILED |
| AC-024 | PRD AC | AC-024 | ST-004 | `src/route/async.ts` | `test/route/async.test.ts`, `TC-NEG-040/041`, `TC-HAPPY-024` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-025 | PRD AC | AC-025 | ST-001 (gate) | (all `src/**`, coverage is a whole-suite gate, not one file) | `npm test` coverage output (98.56/93.35/99.45/99.34%, all ≥90) | `evidence/pre/F-2.txt` (ABSENT — no package.json, exit 127) | `evidence/post/F-2.txt` (PRESENT — 78 files/637 passed, coverage ≥90 all dims) | RECONCILED |
| AC-026 | PRD AC | AC-026 | ST-001 (gate) | `eslint.config.js`, `.prettierrc` (ST-001) | `npm run lint`, `npx tsc --noEmit` (both exit 0 per ac-matrix) | na — lint/typecheck are whole-repo gates, not one of the F-1..F-7 flows | na — same reason | RECONCILED |
| AC-027 | PRD AC | AC-027 | ST-001 | `.github/workflows/ci.yml` | `test/meta/workflows.test.ts` | na — CI workflow structure, no runtime F-flow (CI itself does not execute in this sandbox, noted in ST-001 Builder Report) | na — same reason | RECONCILED |
| AC-028 | PRD AC | AC-028 | ST-001 | `.github/workflows/release.yml` | `test/meta/workflows.test.ts` | na — same reason as AC-027 | na — same reason | RECONCILED |
| AC-029 | PRD AC | AC-029 | ST-008 | `README.md`, `CHANGELOG.md`, `examples/basic/app.ts`, `examples/basic/server.ts` | `test/docs/readme-sections.test.ts`, `test/docs/readme-table.test.ts`, `test/docs/example-smoke.test.ts` | na — documentation AC, no dedicated F-flow (example-smoke test is its own harness, not F-1..F-7) | na — same reason | RECONCILED |
| AC-030 | PRD AC | AC-030 | ST-005, ST-006 | `src/introspect/index.ts` (ST-005); `src/spec/build.ts`, `src/spec/glob.ts` (ST-006) | `test/introspect/walk.test.ts`, `test/spec/build.test.ts` | `evidence/pre/F-6.txt` | `evidence/post/F-6.txt` | RECONCILED |
| AC-031 | PRD AC | AC-031 | ST-005, ST-006 | `src/introspect/index.ts` (ST-005); `src/spec/build.ts` (ST-006) | `test/introspect/walk.test.ts`, `test/spec/build.test.ts` | `evidence/pre/F-6.txt` | `evidence/post/F-6.txt` | RECONCILED |
| AC-032 | PRD AC | AC-032 | ST-005, ST-006 | `src/introspect/index.ts` (ST-005); `src/spec/cache.ts` (ST-006) | `test/introspect/walk.test.ts`, `test/spec/cache.test.ts` | `evidence/pre/F-6.txt` | `evidence/post/F-6.txt` | RECONCILED |
| AC-033 | PRD AC | AC-033 | ST-005, ST-006 | `src/introspect/index.ts` (ST-005); `src/spec/build.ts` (ST-006) | `test/introspect/walk.test.ts`, `test/spec/build.test.ts` | `evidence/pre/F-6.txt` | `evidence/post/F-6.txt` | RECONCILED |
| AC-034 | PRD AC | AC-034 | ST-005, ST-006 | `src/introspect/paths.ts` (ST-005); `src/spec/build.ts` (ST-006) | `test/introspect/paths.test.ts`, `test/spec/build.test.ts`, `TC-NEG-050/051/052`, `TC-CONC-001/002` | na — determinism check (byte-identical specs), no dedicated F-flow | na — same reason | RECONCILED |
| AC-035 | PRD AC | AC-035 | ST-003, ST-007 | `src/adapter/standard.ts` (ST-003); `src/serve/router.ts` (ST-007) | `test/adapter/standard.test.ts`, `test/serve/zero-config.test.ts`, `TC-REG-001` | `evidence/pre/F-3.txt` | `evidence/post/F-3.txt` (zero-options app covers this scenario) | RECONCILED |
| AC-036 | PRD AC | AC-036 | ST-002, ST-007 | `src/config/defaults.ts` (ST-002); `src/serve/router.ts` (ST-007) | `test/config/defaults.test.ts`, `test/serve/zero-config.test.ts`, `TC-HAPPY-034` | na — deep-freeze/resolved-config equality is a unit-level check, not an F-flow | na — same reason | RECONCILED |
| AC-037 | PRD AC | AC-037 | ST-007 | `src/serve/router.ts` | `test/serve/paths.test.ts`, `TC-CONTRACT-015`, `TC-HAPPY-035` | na — custom-path config is exercised by F-7's custom-options half but no separate manifest row exists | na — same reason | RECONCILED |
| AC-038 | PRD AC | AC-038 | ST-002, ST-006 | `src/config/merge.ts` (ST-002); `src/spec/build.ts` (ST-006) | `test/spec/build.test.ts`, `TC-HAPPY-036` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-039 | PRD AC | AC-039 | ST-002, ST-006 | `src/config/merge.ts` (ST-002); `src/spec/build.ts` (ST-006) | `test/config/merge.test.ts`, `test/spec/build.test.ts`, `TC-HAPPY-037` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-040 | PRD AC | AC-040 | ST-002, ST-004 | `src/config/validate.ts` (ST-002); `src/route/validate-request.ts` (ST-004) | `test/route/request-validation.test.ts`, `TC-NEG-035`, `TC-HAPPY-038` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-041 | PRD AC | AC-041 | ST-002, ST-006 | `src/config/validate.ts` (ST-002); `src/spec/build.ts` (ST-006) | `test/spec/build.test.ts`, `TC-HAPPY-039` | na — F-7 is the closest flow but has no separate `include`/custom-default-response row | na — same reason | RECONCILED |
| AC-042 | PRD AC | AC-042 | ST-002, ST-006 | `src/config/validate.ts` (ST-002); `src/spec/build.ts`, `src/spec/naming.ts` (ST-006) | `test/spec/build.test.ts`, `TC-HAPPY-040` | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-043 | PRD AC | AC-043 | ST-007 | `src/serve/router.ts` | `test/serve/toggles.test.ts`, `TC-NEG-046/047/048`, `TC-HAPPY-041` | `evidence/pre/F-7.txt` (ABSENT — connection refused) | `evidence/post/F-7.txt` (PRESENT — stub-adapter route covers schemaAdapter override path; toggles proven by `test/serve/toggles.test.ts`, not a separate F-row) | RECONCILED |
| AC-044 | PRD AC | AC-044 | ST-002, ST-004 | `src/config/merge.ts` (ST-002, cases a/b); `src/route/response-validation` path, `src/route/validate-request.ts` (ST-004, cases c/d) | `test/config/merge.test.ts` (`AC-044a`, `AC-044b`), `test/route/response-validation.test.ts` (`AC-044c`), `test/route/request-validation.test.ts` (`AC-044d`) | na — no dedicated F-flow | na — same reason | RECONCILED |
| AC-045 | PRD AC | AC-045 | ST-002, ST-007 | `src/config/validate.ts`, `src/config/errors.ts` (ST-002); `src/serve/router.ts` (ST-007) | `test/config/validate.test.ts`, `test/serve/config-error.test.ts`, `TC-CONTRACT-028` | na — synchronous-throw-before-mount is a unit-level check | na — same reason | RECONCILED |
| AC-046 | PRD AC | AC-046 | ST-002 | `src/config/types.ts` | `test/config/options.test-d.ts` | na — type-level AC, no runtime F-flow | na — same reason | RECONCILED |
| AC-047 | PRD AC | AC-047 | ST-002, ST-003, ST-004, ST-006, ST-007 | `src/config/spec-table.ts` (ST-002); `test/fixtures/stub-adapter.ts` (ST-003); `src/route/typed.ts` (ST-004); `src/spec/build.ts` (ST-006); `src/serve/router.ts` (ST-007) | `test/adapter/contract.test.ts`, `test/config/defaults.test.ts`, `test/route/stub-adapter.test.ts`, `test/spec/stub-adapter.test.ts`, `test/serve/schema-adapter.test.ts` | `evidence/pre/F-7.txt` | `evidence/post/F-7.txt` (PRESENT — `npx vitest run test/route/stub-adapter.test.ts`, 7/7, per-route override over global confirmed) | RECONCILED |

## Orphans

None found. Every diff file in every story's Builder Report `git diff --stat` falls inside
that story's own `file_scope.owns`/`creates` (`../protocol/file-scope.md`); each Builder
Report explicitly states this and it was independently cross-checked here for all 8
stories (ST-001..ST-008) against the frontmatter `file_scope` blocks read directly from
each story file. `test/aidd-exhaustive/**` and `qa/tests/**` are test-engineer/QA-phase
artifacts (not a Builder diff against a story's `file_scope`), so they are out of scope
for this orphan scan, not silently-owned orphans.

| diff file | note |
|---|---|

## Routed

No missing AC proof to route: `ac-matrix.md` (QA step 9, AC Assessor) already records
all 47/47 ACs as PASS with a directly-executed, green test reference for each, cross-checked
against every owning story's `ac_ids` and Builder Report here. The one procedural gap on
record — `evidence_contract: receipts-v1` mechanical capture (`aidd-evidence.py capture`)
cannot run on this Windows host (`os.name != 'posix'` hard-fail; no usable WSL distro with
Python 3.9+) — is not an AC-proof gap or a diff-ownership finding; it is already documented
in `ac-matrix.md`'s "Environment gap" section and is routed here for visibility only,
addressed to the delivery/QA-gate loop (not the AC-matrix fix loop, since no AC verdict is
affected):

| item id | destination | note |
|---|---|---|
| receipts-v1 (evidence contract) | delivery/QA-gate loop | `evidence/receipts/**` and `evidence/acceptance.json` remain unproduced on this host per `ac-matrix.md`'s "Environment gap" section (`aidd-evidence.py capture` requires POSIX process groups; this host is native Windows with no usable WSL Python 3.9+ distro). Does not flip any AC's semantic verdict — all 47 ACs are independently proven by directly-executed test output — but the receipts-v1 machine-readable artifacts must be produced on a POSIX host (CI/WSL) before delivery can claim receipts-v1 compliance. |

## Summary

items: 47, reconciled: 47, gaps: 0, orphans: 0, routed notes: 1
