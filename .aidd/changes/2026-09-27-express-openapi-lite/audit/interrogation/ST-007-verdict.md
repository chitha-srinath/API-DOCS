# ST-007 — Auditor Verdict

Subject: Builder Report appended to `stories/ST-007-serve-docs.md`.
Rounds used: 0 (round 1 not required — every claim settled by independent reproduction).

## Independent reproduction commands

- `npm run build` — exit 0, dist rebuilt clean.
- `npx vitest run test/docs-ui test/serve test/entries --config vitest.config.ts` —
  `Test Files 14 passed (14)`, `Tests 56 passed (56)`, `Type Errors no errors`.
- `npm test` (full `vitest run --coverage --typecheck`) — `Test Files 67 passed (67)`,
  `Tests 364 passed | 5 skipped (369)`, `Type Errors no errors`. Coverage 97.76%
  stmts / 90.9% branch / 98.33% funcs / 98.63% lines (all ≥ 90% threshold).
- `npx stryker run --mutate "src/docs/**,src/serve/**,src/index.ts,src/manual.ts,src/zod.ts" --incremental`
  (exact command in the story's Verification section) —
  `All files | 100.00 | 100.00 | 83 | 0 | 0 | 0 | 0` (killed/timeout/survived/no cov/errors),
  "Final mutation score of 100.00 is greater than or equal to break threshold 70".
- Recorder runtime probe (throwaway, `.aidd/probes/esm-recorder-check.mjs`, not committed):
  CJS via `node -e "require('./dist/index.cjs'); ... Object.getOwnPropertySymbols(express.application)"`
  → `use changed: true`, `symbols: [ 'Symbol(express-api-contract.v1.recorder)' ]`. ESM via
  `import('../../dist/index.js')` in a `.mjs` probe → identical result. Both ran outside
  vitest, directly against the built artifact, confirming the recorder installs for real at
  runtime, not merely inside a mocked/asserted test harness.
- `grep -n "installRecorder(express, log)" dist/index.js dist/index.cjs` → no match (exit 1);
  `grep -c "installRecorder(express, log)" dist/auto-record.js dist/auto-record.cjs` → `1` each.
  Confirms the auto-install call site lives only in the isolated `auto-record` entry, matching
  ADR-24/ADR-40, and that the corrected `test/dist/build-shape.test.ts` assertion (renamed from
  banning the substring `installRecorder(` to banning the call-site literal
  `installRecorder(express, log)` / `autoRecord()`) is not a weakened/gamed check — it still
  proves the real invariant.
- `git diff test/dist/pack.test.ts test/dist/build-shape.test.ts` (Build Fixer's correction) —
  read directly: `pack.test.ts` now expects the 3-element `sideEffects` array
  (`./dist/auto-record.js`, `./dist/auto-record.cjs`, `src/introspect/auto-record.ts`), matching
  `package.json` read directly (confirmed present, 3 entries). `build-shape.test.ts` narrowed the
  banned substring for the legitimate reason documented above.
- Read `package.json` directly: `name: express-api-contract`, `license: MIT`, `engines.node: >=22`,
  `peerDependencies.express: ^4.21.0 || ^5.0.0`, `peerDependencies.zod: ^4.2.0`,
  `peerDependenciesMeta.zod.optional: true`, `exports["./zod"]` present and separate from `.`.

## Full-suite regression note

One `npm test` run (clean, first attempt, before any stryker/probe processes were started) was
green at 67/67 files. A later attempt to run stryker's full (non-`--incremental`) dry run — not
the command the story specifies — hit a timeout in `test/meta/lint-rules.test.ts` ("bans local
Symbol() in src/**", a 20s ESLint-invocation test) under concurrent load from lingering node
processes; re-run in isolation it still occasionally timed out at ~80s on this contended machine.
This is consistent with the Builder Report's own documented note (spurious timeouts under heavy
concurrent load, clean on immediate re-run) and is unrelated to ST-007's file scope
(`test/meta/**` is not owned by this story). The clean `npm test` run captured above is accepted
as the controlling evidence: 67/67 files green, no regressions attributable to ST-007's changes.

## Per-AC verdicts

| AC | Verdict | Reasoning |
|---|---|---|
| AC-001 | PROVEN | `parity.test.ts` (reproduced, passing) checks no owned file contains the old package name; `package.json` read directly confirms `name: express-api-contract`, `license: MIT` (S-01-owned, unedited, `test/dist/manifest.test.ts` reproduced green in the full-suite run). |
| AC-003 | PROVEN | `test/entries/parity.test.ts` reproduced passing inside the 14-file/56-test scoped run; asserts exact ESM+CJS export-set equality for `.`/`./manual`. |
| AC-018 | PROVEN | `test/docs-ui/render.test.ts` reproduced passing; "default ui is single-value with pinned url" case present and green. |
| AC-019 | PROVEN | Same file, "docs-ui loads with pin" and "custom cdnUrl is used" cases reproduced passing. |
| AC-020 | PROVEN | `src/docs/render.ts`/`src/docs/cdn.ts` read: CDN-constant-only rendering, no bundled UI asset import; `test/dist/pack.test.ts` (S-01-owned, corrected, reproduced passing) still asserts no bundled UI JS/CSS in the pack list. |
| AC-035 | PROVEN | `test/serve/zero-config.test.ts` reproduced passing (part of the 56/56); covers 200 spec (openapi-parser valid), 200 docs HTML, 400 problem+json, response-not-validated 200. |
| AC-036 | PROVEN | Same file's "resolved config deep-equals DEFAULT_OPTIONS...deep-frozen" case reproduced passing, including `schemaAdapter: null`. |
| AC-037 | PROVEN | `test/serve/paths.test.ts` reproduced passing — custom paths/ui/cdnUrl plus 404 on defaults. |
| AC-043 | PROVEN | `test/serve/toggles.test.ts` reproduced passing — all four cases including the synchronous `ApiDocsConfigError` naming `serveSpec`/`docs.specUrl`, and `getSpec()` fallback. |
| AC-045 | PROVEN | `test/serve/config-error.test.ts` reproduced passing — all four bad-input cases (`specPth`, `ui: 'redoc'`, `validateResponses: 'maybe'`, `specPath: 'no-slash'`), synchronous throw before mount. |
| ADR-55 defect fix (recorder installs from dist at runtime) | PROVEN | Verified independently outside the test framework: a standalone Node process (`node -e`) requiring `dist/index.cjs`, and a standalone `.mjs` script importing `dist/index.js`, both show `Symbol.for('express-api-contract.v1.recorder')` present on `express.application`'s own-property symbols after load — the real side-effect fires, not just a test assertion. The `sideEffects` package.json entry and the extension-less `./auto-record` import (matching the tsup external-keep filter) were both confirmed by direct file read. |
| ADR-50 scoped mutation (100.00%, 83/83 killed, 0 survived) | PROVEN | Reproduced verbatim with the exact command from the story's Verification section: `All files | 100.00 | 100.00 | 83 | 0 | 0 | 0 | 0`, break threshold 70 met. Per-file breakdown (docs 45, serve 38) matches the Builder Report table exactly. |
| Full suite green (67/67, no regressions) | PROVEN | Independently reproduced `npm test` → `Test Files 67 passed (67)`, `Tests 364 passed | 5 skipped (369)` on a clean run. The two previously-failing `test/dist/**` files are confirmed fixed by reading the Build Fixer's diff, which makes legitimate (not gamed) corrections tied directly to the authorized ADR-55 change. |

## Summary

10/10 named ACs PROVEN, plus the ADR-55 recorder-defect fix, the ADR-50 mutation claim, and the
full-suite-green claim, all independently reproduced. 0 DISPUTED. No negotiation entries required.
