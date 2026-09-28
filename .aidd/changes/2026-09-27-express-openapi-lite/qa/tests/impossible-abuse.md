# QA Test Report — impossible-abuse

Test Engineer, category: impossible-abuse. Design+execute combined (one-shot; design debate deferred). This bucket is non-empty as required.

Test file: `test/aidd-exhaustive/impossible-abuse/abuse-matrix.test.ts` — 31 executed cases (TC-ABUSE-001..030, plus 014b).

**Tally: 31 designed / 31 passed / 0 failed / 0 blocked.**

Coverage: truncated/invalid/oversized/wrong-content-type/deeply-nested JSON bodies against typed routes (all rejected gracefully, AC-007); injection strings (script tags, SQL-like, path traversal) as path/query values treated as opaque data, never executed (AC-008/016); prototype-pollution payloads via `__proto__`/`constructor` as **query-string keys** and **JSON-body keys** reaching the request-validation path (`src/route/validate-request.ts`) — confirmed clean, extending the security reviewer's `config/merge.ts`-scoped finding into the request-validation surface, a genuinely different code path; config impossible-states (all throw `ApiDocsConfigError` correctly — AC-043/045); replayed registration (`route()`/`describe()` called twice for the same method+path, same router mounted at two prefixes, same mount replayed) — no crash, no duplicate explosion (AC-022/023); circular objects into `mergeOptions` (bounded, no hang); self-referential objects to `res.json()` (caught, no process crash); extreme bracket-nesting and array-length query strings (bounded); numeric/array/null-byte query edge cases (all rejected 400 or handled gracefully); `onValidationError` hooks that themselves throw or return malformed output (propagate correctly, never silently succeed with 200).

No FAIL defects. Every case has executed evidence (no case left pending). TC-ABUSE-009/010 (prototype pollution via request-path keys) are a genuine extension of the security reviewer's finding #1 (scoped to config-merge only) — both confirmed clean on this separate path.

Not re-litigated: F-01, F-02, F-04.
