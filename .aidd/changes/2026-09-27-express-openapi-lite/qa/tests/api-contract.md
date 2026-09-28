# QA Test Report — api-contract

Test Engineer, category: api-contract. Design+execute combined (one-shot; no separate design-debate round available at dispatch time).

Test suite: `test/aidd-exhaustive/api-contract/run.mjs` (run via `node`, against the built `dist/` for ESM+CJS export/shape checks plus live Express 5 servers for runtime contract checks).

**Tally: 28 designed / 26 passed / 2 failed / 0 blocked.**

Coverage (all PASS except the two expected F-01 confirmations): exact ADR-41 export sets for `.`, `./manual`, `./zod` in both ESM and CJS with zero undocumented extras and zero missing exports (AC-003); no static `zod` import in the main/manual bundles (AC-004); `route()`/`describe()` type shapes match ADR-54/56 exactly, including `.d.ts` re-exports; `/openapi.json` and `/docs` status/content-type/body shape; custom path toggles (AC-037); RFC 9457 envelope shape and field correctness (AC-007/008); the package's own default-generated spec validates cleanly (control case); no undocumented extra/missing exports; `package.json` `exports` map completeness including `./package.json`; **ADR-55 regression guard reused from api-contract's own lens: a fresh child-process probe confirms the recorder genuinely installs on `express.application` from the built dist** (a live, reusable regression guard for regression-compat to build on); unmatched-path 404 with no accidental catch-all; response validation error-mode doesn't leak invalid bodies; `ui: 'redoc'` (unsupported) throws synchronously naming the option.

## Failures (both expected — re-confirm F-01, do not raise new findings)

**TC-CONTRACT-019:** `.meta({id})`-tagged, reused Zod schema via the **opt-in `zodAdapter`** (`express-api-docs/zod`) produces a spec that fails `SwaggerParser.validate()`. Matches F-01 exactly.

**TC-CONTRACT-020:** the identical failure reproduces through the **default `standardSchemaAdapter`** with no explicit adapter override — independently reconfirms the adversarial verifier's scope-widening (F-01 is reachable through the most common consumer path, not only the opt-in subpath). This is the third independent confirmation of the default-path reachability (after the adversarial verifier and before this report), from the api-contract lens specifically — exactly where AC-015/016 falsification belongs.

No severity change recommended: CRITICAL stands.

Not re-litigated as new: F-02, F-04.
