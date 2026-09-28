# QA Test Report — negative-error-handling

Test Engineer, category: negative-error-handling. Design+execute combined (one-shot; design debate deferred).

Test file: `test/aidd-exhaustive/negative-error-handling/negative.test.ts` — 53 executed cases (TC-NEG-001..053).

**Tally: 53 designed / 53 passed / 0 failed / 0 blocked.**

Coverage groups (all PASS, all executed with real evidence):
1. **Config validation errors (TC-NEG-001..026, AC-045/043/A-9):** unknown keys, invalid enums, wrong types at every level, malformed group objects, missing required subfields, non-plain-object options (array/string/null), the A-9 cross-field rule (serveSpec:false + serveDocs:true without specUrl throws; with specUrl doesn't), no partial instance survives a config error.
2. **ApiDocsConfigError brand semantics (TC-NEG-027..029, ADR-49):** stable code/name, plain Error and duck-typed impostors are NOT instanceof (brand-based, not shape-based).
3. **Request validation / RFC 9457 (TC-NEG-030..036, AC-007/008/010/040):** missing fields, wrong types, malformed JSON body, all-three-locations-invalid, onValidationError override, validateRequests:false, empty body → 400 not 500.
4. **Response validation (TC-NEG-037..039, AC-012/013/014):** error mode withholds+500, warn mode sends+logs once, default sends silently.
5. **Async error propagation (TC-NEG-040..041, AC-024):** thrown and rejected-promise handlers both reach Express error middleware.
6. **Adapter-level schema errors (TC-NEG-042..045, ADR-31):** ApiDocsSchemaError shape, brand rejects impostors, standardSchemaAdapter on non-conforming input doesn't crash.
7. **Serve-level 404s/partial mounting (TC-NEG-046..049, AC-043/037):** every serveDocs/serveSpec combination.
8. **Malformed auto-detected route shapes (TC-NEG-050..052, AC-034):** RegExp routes and Express-4 bare `*` don't crash spec generation; Express-5's own router rejects bare `*` before this package ever sees it (framework behavior, not a defect — correctly scoped to Express 4 only).
9. **Partial-failure isolation (TC-NEG-053):** one route's validation failure doesn't affect a sibling route.

**Observational note (not filed as a new finding, flagged for consolidation):** TC-NEG-045 shows `standardSchemaAdapter.validate` on a non-Standard-Schema bogus object either throws or returns a structured `{ok:false}` result — both branches are safe (no crash), but the adapter could duck-type-guard before calling `validate` at all. No crash observed; not scored as a defect.

No FAIL defects. Not re-litigated: F-01, F-02, F-04 (see `qa/verdicts.md`).
