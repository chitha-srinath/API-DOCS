# QA Test Report — boundary-edge

Test Engineer, category: boundary-edge. Design+execute combined (one-shot; design debate deferred to the consolidated challenge).

Test file: `test/aidd-exhaustive/boundary-edge/aidd_exhaustive_boundary.test.ts` — 52 executed cases (TC-EDGE-001..052).

**Tally: 52 designed / 49 passed / 3 failed / 0 blocked / 1 NA (documented, not AC-mapped).**

Coverage areas: `src/spec/glob.ts` boundary sweep (empty/bare/consecutive/balanced metacharacters, unicode, whitespace, 2000-char patterns — AC-030/034/041), `src/config/merge.ts` + `DEFAULT_OPTIONS` (empty overrides, undefined-never-overrides, all four AC-044 cases, array-replace, opaque function objects, null vs undefined, 5-level nesting, deep-freeze — AC-036/044), `src/introspect/paths.ts` (empty string, root `/`, RegExp/wildcard skips, optional segments, 20-segment stress, unicode, determinism — AC-023/034/042).

## Defects found (3 executed FAILs — all independently confirm and EXPAND F-02)

**TC-EDGE-005 (HIGH, confirms F-02):** `matchGlob('.', 'x')` returns `true` instead of `false` — the same shared-`lastIndex` state bug F-02 already identified, reproduced blind (this tester designed the case without prior knowledge of F-02, per instruction).

**TC-EDGE-010 (HIGH, NEW aspect of F-02 not in the original finding — a crash, not just a mismatch):** a pattern containing one of every metacharacter in balanced arrangement throws `SyntaxError: Invalid regular expression: ... Unterminated character class` — `toRegExp` can construct a syntactically invalid regex under certain metacharacter sequences, and the call throws uncaught rather than degrading gracefully. **This is a DoS-adjacent crash path the original F-02 finding did not identify** — any code path passing user-influenced `include`/`exclude` patterns to `matchGlob`/`matchAnyGlob` can crash spec generation entirely, not just silently mismatch.

**TC-EDGE-020 (MEDIUM, confirms F-02):** `matchGlob('\\\\', '\\\\')` (two literal backslashes) returns `false` instead of `true` — a pattern should always self-match literally.

**Root cause (independently re-derived):** `REGEXP_METACHARS` at `src/spec/glob.ts:5` is a module-level `/g`-flagged regex; `escapeChar`'s `.test()` calls share its `lastIndex` across every invocation for the lifetime of the module — a cross-call, order-dependent state-corruption bug, not merely a within-pattern one. Suggested minimal fix: drop the `g` flag (a stateless `.test()` needs no global flag).

## Minor finding (not scored as a defect)

**TC-EDGE-038:** `convertExpressPath('', logger)` returns `{path: '', ...}` instead of `/` — the module's own `normalize()` helper exists but isn't applied to the initial top-level call. No AC mandates this (Express apps don't register `''` directly). Flagged for builder awareness only.

## Consolidation note for step 6 fix loop

**This report widens F-02's scope beyond the original finding.** The fix loop dispatch for F-02 must address not just the escape-alternation mismatch but also the crash case (TC-EDGE-010). The suggested fix (drop the `g` flag from `REGEXP_METACHARS`) should resolve both, but the builder must verify the crash case specifically, not just the original mismatch case, before calling F-02 closed.
