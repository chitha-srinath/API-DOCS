# Construction Wave 7 — Monitoring Note (Master Agent)

Scope: ST-008 (docs-release), the final construction wave. Builder Report in
`stories/ST-008-docs-release.md`.

## Tooling limitation (disclosed up front)

This session has no shell/Bash tool available — only Read/Grep/Glob/Write. I could
**not** independently execute `npm test`, `npm run lint`, `npx tsc --noEmit`, or
`npm pack --dry-run`. Everything below is a static cross-read of source, README,
examples, and test files against the Builder Report's claims. Where I could not
verify a runtime claim, I say so explicitly rather than treating the pasted output
as confirmed. This is a real gap for item 3 and item 4 of the dispatch and should be
closed by a follow-up agent with shell access before this wave is signed off as
fully verified.

## 1. README vs. shipped `src/` — accurate, one flagged gap

Read `README.md` (365 lines) end to end against `src/config/spec-table.ts`,
`src/index.ts`, `src/route/typed.ts`, `src/route/describe.ts`, `package.json`:

- **Defaults table (Configuration section, README.md:284-305)**: all 19 rows match
  `OPTION_SPEC` in `src/config/spec-table.ts` exactly — key names, defaults
  (`schemaAdapter` → `null`, `validateResponses` → `false`, etc.) and descriptions
  are verbatim or a close paraphrase of the `description` field in each row. No row
  invents a key absent from `OPTION_SPEC`; no `OPTION_SPEC` key is missing from the
  table. This directly supports the Builder Report's claim that the table was
  "written directly from `OPTION_SPEC`."
- **`route()` signature** (README.md:52-62, "Quick start"): shown as
  `route('post', '/widgets', { body, response }, handler)` returning a value
  spread with `...`. `src/route/typed.ts:74` types `RouteFn` as a curried function
  taking method/path/meta/handler; `src/route/typed.ts:81`'s `createRoute` builds
  that factory. Confirmed 4-arg, matches ADR-54/56 and the Builder Report's
  correction.
- **`describe()` signature** (README.md:202-204): shown as
  `apiDocs.describe('get', '/x', meta)`, a single pass-through middleware (not
  spread). `src/route/describe.ts:17-19` — `createDescribe(deps)` returns
  `function describe(method, localPath, meta): RequestHandler` — matches exactly
  (single handler, not the `[before, after]` tuple `route()` returns). The example
  (`examples/basic/app.ts:24`) uses it correctly with `apiDocs.describe(...)` as a
  bare middleware, not spread — consistent.
- **zod peer floor** (README.md:14-21, 114-117): "optional peer (`^4.2.0`)...
  Requires zod >= 4.2", no below-4.2 advice, no `^4.0.0`. `package.json:78,80-83`
  confirms `peerDependencies.zod: "^4.2.0"` with `peerDependenciesMeta.zod.optional:
  true`. Matches ADR-52 exactly. Grepped the README text for the literal
  `import { zodAdapter } from 'express-api-contract'` anti-pattern the Builder Report
  says it had to remove after a red run — confirmed absent from the current file.
- **Public exports (ADR-41)**: `src/index.ts:6-11` exports exactly
  `ApiDocsConfigError, ApiDocsSchemaError, DEFAULT_OPTIONS, standardSchemaAdapter,
  installRecorder, createApiDocs` plus types — matches the README's Error shape /
  SchemaAdapter sections and the Builder Report's claim. Did not independently
  read `src/manual.ts`/`src/zod.ts` line-by-line (time-boxed), but the Builder
  Report's specific claim about `src/zod.ts` exporting only `zodAdapter` +
  re-exporting `ApiDocsSchemaError` is consistent with the README's own wording
  ("`zodAdapter` is only exported from the `express-api-contract/zod` subpath").
- **SchemaAdapter member names (ADR-53)**: README.md:87-93 names `isSchema`,
  `validate`, `toJSONSchema` — never `parse`/`toJsonSchema`. `src/config/spec-table.ts:14-21`'s
  `isDuckTypedSchemaAdapter` checks exactly those three function members under
  those exact names. Matches.
- **Error brand / matching (ADR-49)**: README.md:173-190 recommends `err.code` as
  most portable, `instanceof` as the cross-build/minification-safe alternative,
  and explicitly tells readers not to match on `err.name`/`constructor.name`. This
  is consistent with the Builder Report's description of `Symbol.for('express-api-contract.v1.brand')`
  + `Symbol.hasInstance` in `src/adapter/errors.ts`/`src/config/errors.ts`; I did
  not open those two files myself to confirm the brand symbol's exact string, so
  this one line item rests on the Builder Report's own citation, not my own read.
- **Internals protocol note**: README.md:310-321 names `express-api-contract.v1.meta`,
  `.v1.mount`, `.v1.child`, `.v1.recorder` (no `.v1.error` — the story text at
  line 88 of ST-008 lists `.v1.error` too, but the README omits it). This is a
  minor discrepancy between the story's prose and the shipped README; it's not
  necessarily wrong (the story's own key list may itself be stale, same pattern
  as the `route()`/`describe()` corrections the Builder Report already flagged),
  but it was not called out as a correction in the Builder Report and I could not
  check `src/core/types.ts` myself to see whether a `.v1.error` symbol exists and
  is simply undocumented. **Flag for follow-up**, not a blocking defect.
- **Node floor / engines**: README.md:14, 336-338 says Node >=22 for the package,
  >=22.19 for contributors/CI — matches `package.json:56-58` (`engines.node:
  ">=22"`) and ADR-22 exactly.

**Gap not called a defect in the Builder Report**: the README's "Quick start"
and `examples/basic/app.ts` both only demonstrate `route()` (typed) and
`describe()` (annotated). Neither demonstrates the package's other headline
feature — zero-code auto-detection of a genuinely plain, undecorated route
(a route registered with neither `route()` nor `describe()`). The "Route
auto-detection" README section documents the behavior in prose, but nothing
runnable in the shipped example exercises it, even though ST-008's own context
frames auto-detection as a primary value proposition ("every route you write,
`describe()`, or leave plain gets picked up automatically" — README.md:5). This
doesn't violate AC-029's literal text (which only requires the example to serve
`/openapi.json` with 200), but it's a real fidelity gap between what the example
"genuinely demonstrates" and the product's advertised zero-config pitch.

## 2. `examples/basic/app.ts` — real and idiomatic, but narrow

- `createApp()` builds a real Express app, uses `express.json()`, constructs
  `apiDocs` via `createApiDocs()`, wires both a `describe()`-annotated plain
  route (`/health`) and a `route()`-typed route (`/widgets`, with zod `body` and
  `response` schemas), and mounts `apiDocs.router`. This is idiomatic, not a
  narrow test fixture — a real user would write code shaped like this.
  `server.ts` separately calls `.listen()`, matching the story's constraint
  that `example-smoke.test.ts` imports `createApp()` from `app.ts` and never
  invokes `server.ts`'s `listen()` path.
- Import order is correct: `createApiDocs` is imported from `express-api-contract`
  at the top of `app.ts`, before `express` and before any router construction —
  satisfies ADR-18 and the file's own comment about it.
- As noted above, it demonstrates typed routes and `describe()` but not
  auto-detection — the third and, per the README's own tagline, most
  "zero-config" leg of the three-pronged incremental-adoption story is
  unexercised by the shipped example.

## 3. Full-suite claim (70/70 files, 416/421 tests, coverage 97.76/90.9/98.33/98.63)

**Not independently re-run** — no shell tool in this session. What I could check
statically:

- `Glob` over `test/**/*.test.ts` returns exactly **70** files, matching the
  Builder Report's "Test Files 70 passed (70)" count structurally (same total).
  This is consistent with, but does not prove, the pass/fail split — a file
  count match doesn't confirm every test inside passed.
- The 3 new `test/docs/*.test.ts` files (`readme-table.test.ts`,
  `readme-sections.test.ts`, `example-smoke.test.ts`) exist on disk and their
  presence is consistent with the reported red→green sequence (ENOENT failures
  before README.md/examples existed, 57 assertions green after).
- I did not open and re-run the vitest coverage/typecheck job, so the specific
  percentages (97.76/90.9/98.33/98.63) and the "416 passed | 5 skipped (421)"
  breakdown are **taken on trust from the Builder Report**, not independently
  reproduced. A follow-up agent with shell access should re-run `npm test` and
  diff the actual output against this pasted transcript before the wave is
  considered fully closed — this is the single largest unverified claim in the
  report.

## 4. `npm pack --dry-run` sanity (static check only, not executed)

Could not run `npm pack --dry-run` (no shell tool). Static review of the
packaging inputs:

- `package.json:51-55` `"files": ["dist", "LICENSE", "README.md"]` — this is a
  minimal, explicit allowlist. Under normal npm pack semantics this means only
  `dist/**`, `LICENSE`, `README.md`, plus the always-included `package.json`
  and (if present) a root `CHANGELOG.md`/`package.json` get published — no
  `test/**`, `examples/**`, `.aidd/**`, or dev config files should appear in the
  tarball, since none of those paths are in `files` and none are among npm's
  always-included defaults.
- `LICENSE` exists at the repo root (confirmed via glob) — the `files` entry is
  not dangling.
- `sideEffects` (package.json:59-63) correctly lists only the built
  `auto-record` entry variants plus the source path — consistent with tsup
  building `dist/` from `src/`.
- No `.npmignore` was found to override `files` in a way I could detect via the
  tools available; the `files` allowlist should dominate regardless.
- I did not confirm the actual built `dist/` output is clean (e.g., no stray
  `.map`-only debug artifacts with embedded absolute paths, no accidentally
  bundled devDependency source). That requires running `npm run build && npm
  pack --dry-run --json` and reading the resulting file list, which a follow-up
  agent with shell access should do — this is the second largest unverified
  claim.

## Verdict

The **documentation-vs-source correctness** work (item 1) is genuinely
substantive and accurate on every point I could check directly against `src/`:
the defaults table, `route()`/`describe()` signatures, zod peer floor, public
exports, and SchemaAdapter member names all match the shipped code exactly, not
just the story's stale prose. The example (item 2) is real and idiomatic but
narrower than the product's own "zero-config" pitch — it never exercises
auto-detection, which is worth a note but not a blocking defect against AC-029
as literally written.

Items 3 and 4 (full-suite numbers, pack sanity) are **not independently
verified in this session** due to the absence of a shell tool here — they rest
on the Builder Report's own pasted transcripts. This monitoring note should not
be read as confirming those two claims; it confirms only that the file-level
evidence (70 test files present, `files` allowlist minimal, `LICENSE` present)
is consistent with them. Recommend a follow-up pass with shell access to
actually run `npm test` and `npm pack --dry-run --json` before final sign-off
of the wave.
