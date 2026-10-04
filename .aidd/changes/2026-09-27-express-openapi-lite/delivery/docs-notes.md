# Delivery step 1 — Doc Writer notes

## Scope

Delivery-phase accuracy pass on README.md, CHANGELOG.md, and `examples/basic/*`
against the FINAL diff (`git diff main...HEAD`), including QA fix-loop changes
to `src/spec/build.ts` (F-01, F-22), `src/spec/glob.ts` (F-02), `src/route/typed.ts`
and `src/serve/router.ts` (F-04). Docs were last touched by ST-008 during
Construction; this pass re-verifies against the post-QA-fix source, not just
the Construction-time state.

## What was checked

1. **Diff review** — `git diff main...HEAD --stat` (249 files changed) and the
   QA findings/verification trail (`qa/findings.md`, `qa/verdicts.md`) for the
   fix-loop items called out in the assignment:
   - F-01 (`src/spec/build.ts:107-131`, dangling `$ref` for `.meta({id})`-tagged
     schemas) — CONFIRMED and fixed in step 6.
   - F-02 (`src/spec/glob.ts:5-9`, `escapeChar` shared `lastIndex` state) —
     CONFIRMED and fixed in step 6.
   - F-04 (`src/serve/router.ts:50-52`, `src/route/typed.ts:61-68`,
     `memoizeAdapter` dead code) — CONFIRMED and fixed in step 6.
   - F-22 (`src/spec/build.ts` `hoistSchemaDefs`, silent `.meta({id})` collision
     first-writer-wins) — found in the step 6 closure re-check, left as a
     documented internal limitation (not previously surfaced in README/CHANGELOG,
     and none of these four findings changed any *documented* public behavior —
     they are internal-implementation-only fixes: `$ref` generation, glob-escaping
     correctness, and adapter memoization performance. No README/CHANGELOG prose
     asserted the pre-fix (buggy) behavior, so none of it was stale.
2. **README.md** — read end to end (367 lines) and cross-checked each
   documented behavior against current source:
   - Quick start snippet, SchemaAdapter resolution order, zod subpath, response
     validation modes, error shape/`instanceof` guarantees, auto-detection
     `include`/`exclude` globs, `installRecorder`/manual entry, APM ordering
     note, configuration table, Internals protocol-key list, Contributing
     script list — all still match `src/` and `package.json` as of HEAD. No
     mention anywhere of `.meta({id})` `$ref` hoisting, adapter memoization, or
     glob-escaping internals, so the F-01/F-02/F-04/F-22 fixes had nothing to
     contradict.
3. **CHANGELOG.md** — the single `[0.1.0]` entry only lists shipped
   user-visible features (createApiDocs, typed routes, describe, auto-detect,
   adapters, manual entry, installRecorder, branded errors, DEFAULT_OPTIONS,
   examples/basic, Node >=22). None of it describes the pre-fix buggy behavior
   the QA fix loop corrected, so no entry was inaccurate. QA-phase bug fixes to
   already-listed features (spec generation correctness, glob matching
   correctness, adapter memoization performance) do not warrant new bullets
   under "Initial release" — they are pre-release hardening, not a new surface.
4. **examples/basic/app.ts + server.ts** — read and executed live (see
   evidence below); matches the Quick start section's described routes plus
   the auto-detected `/widgets-plain` plain route.

## What was changed

Nothing. All docs were verified accurate against the final (post-QA-fix) diff.
No stale claims, no missing surface, no broken samples were found.

## Sample verification evidence (commands run)

1. Build the package from current source:
   ```
   npm run build
   ```
   Result: tsup ESM/CJS/DTS build succeeded for all four entries
   (index/manual/zod/auto-record).

2. Run the docs-specific and QA-fix-adjacent test suites:
   ```
   npx vitest run test/docs/readme-sections.test.ts test/docs/readme-table.test.ts \
     test/docs/example-smoke.test.ts test/spec/build.test.ts test/spec/glob.test.ts \
     test/route/typed.test-d.ts test/serve/adapter-memo.test.ts
   ```
   Result: `Test Files 7 passed (7)`, `Tests 80 passed (80)`, `Type Errors no errors`.

3. Manually executed the README "Quick start" code sample verbatim (not just
   read) against the built `dist/index.js`, in-process, asserting the exact
   claims made in the README text ("GET /openapi.json -> the generated OpenAPI
   3.1 document", 201 response):
   ```
   node .readme-quickstart-check.mjs   # temp script, removed after run
   ```
   Output:
   ```
   openapi version: 3.1.0
   paths: [ '/widgets' ]
   POST /widgets status: 201 { id: '1', name: 'thing' }
   ```
   Confirms the quickstart sample runs unmodified against post-QA-fix code and
   produces exactly what the README claims.

4. Ran the actual `examples/basic` app the README points readers to
   (`npx tsx examples/basic/server.ts`), then hit both endpoints it documents:
   ```
   npx tsx examples/basic/server.ts   # backgrounded, port 3000
   curl -s http://localhost:3000/openapi.json
   curl -s -X POST http://localhost:3000/widgets -H 'content-type: application/json' -d '{"name":"x"}'
   ```
   Output:
   ```
   Example listening on http://localhost:3000
   openapi 3.1.0
   paths [ '/health', '/widgets', '/widgets-plain' ]
   {"id":"1","name":"x"}
   ```
   Confirms: OpenAPI 3.1 document served, typed route (`/widgets`) works,
   `describe()`-only route (`/health`) present, and the plain, unannotated
   `/widgets-plain` route is auto-detected into the spec exactly as the
   "Route auto-detection" README section describes.

## Verdict

No doc edits required. README.md, CHANGELOG.md, and examples/basic are
accurate against the final diff including all QA fix-loop changes
(F-01/F-02/F-04/F-22). `git status --porcelain` is clean (dist/ is
gitignored; the temporary verification script was deleted after use).
