# Auditor Verdict — ST-008

Round 1 only; no challenge round issued — every claim in the Builder Report was
independently reproducible against the actual repo state, so no evidence gap exists.

| AC id | verdict PROVEN\|DISPUTED | evidence cited | note |
|---|---|---|---|
| AC-029 | PROVEN | Independently re-ran `npx vitest run test/docs --no-coverage`: `Test Files 4 passed (4)`, `Tests 57 passed (57)`, exit 0 — matches Builder Report's green run exactly. Read README.md (364 lines) directly and confirmed all required `##` headings present (Install, Quick start, SchemaAdapter, Security, Docs UI, Response validation, Error shape, Incremental adoption, Route auto-detection, Configuration, Internals) via a case-insensitive heading grep. Confirmed error-shape section uses `err.code === 'EAD_ASYNC_SCHEMA'` and `instanceof ApiDocsConfigError`/`ApiDocsSchemaError` with explicit "across ESM/CJS copies... minification" wording, and no `err.name`/`constructor.name` matching guidance (only a caveat listing what NOT to use). Confirmed zod section: `Requires zod >= 4.2`, `^4.2.0` peer, no `below 4.2` / `< 4.2` / `<4.2` / `^4.0.0` substrings, no `import { zodAdapter } from 'express-api-contract'` literal. Confirmed Internals section uses versioned `express-api-contract.v1.meta` / `.v1.mount` / `.v1.child` / `.v1.recorder` keys only, no unversioned `express-api-contract.meta`. Confirmed CHANGELOG.md has a `## [0.1.0]` entry mentioning `installRecorder`, `/manual`, `/zod`, `schemaAdapter` and "Node.js >= 22" (read file directly, 41 lines). | Parity-test audit (see note) confirms the test genuinely walks every `OPTION_SPEC` key, not a hardcoded/stale subset. |

## Parity-test independent verification (not a partial/stale check)

Read `test/docs/readme-table.test.ts` directly: it imports the live `OPTION_SPEC` from
`src/config/spec-table.ts` and drives `it.each(Object.keys(OPTION_SPEC))(...)` — i.e. the
list of required keys is derived dynamically from the shipped source at test-run time, not
copy-pasted into the test file. This means the test cannot go stale relative to
`OPTION_SPEC`/`DEFAULT_OPTIONS`: any future key addition/removal in `src/config/spec-table.ts`
automatically changes what the test demands.

Independently counted `OPTION_SPEC` rows: `grep -n "path:" src/config/spec-table.ts` → **20**
matches (specPath, docsPath, ui, cdnUrl, serveSpec, serveDocs, docs.specUrl, openapi.info,
openapi.servers, openapi.tags, securitySchemes, security, validateRequests, validateResponses,
onValidationError, autoDetect, detectedDefaultResponse, operationIdStrategy, tagStrategy,
schemaAdapter).

Independently extracted the README Configuration table rows via
`grep -n '^| \`' README.md` (lines 286-305) → **20** rows, keys matching the `OPTION_SPEC`
list exactly 1:1, each with a non-empty default and description, `schemaAdapter` default
`null` as required by ADR-38.

Note: the Builder Report's self-check text says "19 rows" — this is a minor miscount in the
narrative (actual count is 20 both in source and README); it does not affect the test's
correctness since the test iterates `Object.keys(OPTION_SPEC)` dynamically rather than
trusting the Builder's stated count. No evidence gap results from this; not escalated.

## Full-suite verification (final wave, ADR-29 gate)

Independently ran `npm test` (`vitest run --coverage --typecheck`) myself:

```
Test Files  70 passed (70)
     Tests  416 passed | 5 skipped (421)
Type Errors  no errors

Statements   : 97.76% ( 787/805 )
Branches     : 90.9%  ( 470/517 )
Functions    : 98.33% ( 177/180 )
Lines        : 98.63% ( 720/730 )
```

Exit code 0. All four coverage metrics clear the 90% floor. Matches the Builder Report's
cited full-suite run number-for-number.

Checked the 5 skipped tests for staleness: all 5 are `it.skipIf(major !== 4)` /
`it.skipIf(major !== 5)` / `it.skipIf(!v4)` / `it.skipIf(!v5)` conditionals in
`test/introspect/warn.test.ts`, `sniff.test.ts` and `paths.test.ts` — legitimate
Express-major-version matrix guards (the suite runs once per Express major in CI), each
with a named, load-bearing condition, not unexplained/leftover skips.

## Verdict summary

AC-029: **PROVEN**. No DISPUTED ACs for this subject; no challenge round required; no
negotiation entry filed.
