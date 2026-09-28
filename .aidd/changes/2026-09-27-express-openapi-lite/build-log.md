# Build Log

## Entry: Wave integration check red — 2 stale test assertions (test/dist/**)

**Trigger:** `npm test` reported 2 failed / 65 passed test files (362/369 tests) at wave
integration check, both failures confined to `test/dist/**` (owned by ST-001/S-01,
already built/committed/audited).

**Diagnosis:**

1. `test/dist/pack.test.ts` — `sideEffects matches the auto-record entries` asserted the
   old 2-element `pkg.sideEffects` array. ADR-55 (backflow, ratified) authorized a third
   element, `"src/introspect/auto-record.ts"`, to fix a real defect where esbuild's
   `sideEffects`-array elision stripped the recorder's install call from
   `dist/auto-record.{js,cjs}` during the build. `package.json` already carries the
   corrected 3-element array (confirmed via `grep`); only the test's expectation was
   stale.
2. `test/dist/build-shape.test.ts` — `does not inline the recorder install call` banned
   the literal substring `installRecorder(` anywhere in `dist/index.{js,cjs}`. Per
   ADR-40, the actual guarantee is that the *auto-install call site* (the bare
   `installRecorder(express, log)` invocation inside `src/introspect/auto-record.ts`,
   triggered by `autoRecord()`) stays exclusively in the external
   `dist/auto-record.{js,cjs}` entry. ST-007 legitimately exports `installRecorder` as a
   public composition-root function (ADR-41), so `dist/index.js`/`index.cjs` now contain
   its declaration (`function installRecorder(expressModule, log = noopLogger) {`) and a
   warn-message string mentioning it — both false positives under the old ban. Verified
   via `grep` that neither index file contains the actual invocation pattern
   `installRecorder(express, log)` or `autoRecord()` — only `dist/auto-record.js` (line
   119) and `dist/auto-record.cjs` do.

**Files touched:**
- `test/dist/pack.test.ts` — updated the `sideEffects` assertion to the ADR-55 3-element
  array (`./dist/auto-record.js`, `./dist/auto-record.cjs`,
  `src/introspect/auto-record.ts`).
- `test/dist/build-shape.test.ts` — replaced the blanket `installRecorder(` substring ban
  with two precise checks: absence of the invocation `installRecorder(express, log)` and
  absence of `autoRecord()` in `dist/index.js`/`dist/index.cjs`, matching ADR-40's actual
  intent (no accidental inlining of the auto-install call site, not a ban on the
  identifier's legitimate export/declaration).

No changes to `package.json`, `tsup.config.ts`, or any `src/**` file — those were already
correct.

**Evidence (green run):**

```
$ npm test
...
 Test Files  67 passed (67)
      Tests  364 passed | 5 skipped (369)
Type Errors  no errors
   Start at  12:16:55
   Duration  21.53s
```

0 failures, all 67 test files pass (364 passed, 5 skipped of 369 total).
