# Monitoring Note — Construction Wave 5 (ST-006 spec-builder)

## Scope
Builder Report for ST-006 (`src/spec/**`, `test/spec/**`), appended to
`.aidd/changes/2026-09-27-express-openapi-lite/stories/ST-006-spec-builder.md`.
Claims checked against source on disk, not against the report's prose alone.

## 1. Determinism (AC-023, AC-034)

**`src/spec/canonical.ts`** (20 lines, read in full): `canonicalize()` recurses over
plain objects, rebuilding each with `Object.keys(input).sort()` and skipping
`undefined` values; arrays are mapped in place (order preserved, never sorted).
No `Date.now()`, `Math.random()`, `Symbol`, `WeakMap`, or reliance on native
object key insertion order — the sort call is the only ordering mechanism and it
is lexicographic on strings, so it is stable across V8/runtime versions. This
directly backs AC-034's "byte-identical" claim rather than the test merely
happening to pass under one run's iteration order.

**`src/spec/build.ts`**: no `Date.now()`/`Math.random()`/env/timing reads anywhere
in the 281-line file (checked by full read, not grep-only). The one place order
could leak non-determinism — collision-suffix assignment for duplicate
operationIds — is handled in **`src/spec/naming.ts`**: `assignOperationIds()`
explicitly re-sorts its input `[...entries].sort((a, b) => a.id - b.id)` before
assigning suffixes, keyed by `RegistryEntry.id` (registration order), not by
array/iteration position. This matches the story's explicit gotcha ("A-3
collision suffixes use `RegistryEntry.id` ... never by array position after
sorting") and is a real, checkable implementation choice, not an incidental
pass. `dedupe()` in build.ts also breaks ties by `op.id ?? index`, consistent
with the same rule. Verdict: AC-023/AC-034's determinism claim is genuinely
backed by the code, not coincidental to the current test run.

One caveat noted for the record, not a defect in this story's scope: overall
byte-identity across a real app also depends on `introspect()`/`RouteRegistry`
emitting entries in a stable order — that is S-04/S-05's contract, correctly
out of this story's file-ownership scope, and the story's own tests already
exercise "shuffled input order" explicitly (`canonical.test.ts`) as insurance.

## 2. Mutation score contamination check

`reports/stryker-incremental.json` contains 383 mutant records total (`grep -c
'"status":'` = 383, matching every one of Killed/Timeout/etc. status strings),
consistent with the Builder Report's final line "383/383 tested". A search for
`"status": "Survived"` returns **zero matches** in the file — corroborating the
reported 0 survived, not just the human-readable summary in the report. Because
the builder's own account states `.stryker-tmp/` and `reports/` were cleared
before the clean rerun, and the on-disk file's total (383) exactly matches the
final reported total (376 killed + 7 timeout = 383) with no leftover higher
count or duplicate mutant IDs from a larger interrupted run, the artifact is
consistent with being the single clean rerun the report describes, not a
merge of interrupted + rerun state. This is corroborating evidence, not
conclusive (no independent access to a pre-clear snapshot to diff against),
but nothing in the artifact contradicts the builder's account, and the account
itself was disclosed rather than hidden — treated as a positive honesty signal
per the self-verification mandate, not an amplified concern.

## 3. Contract fidelity (ADR-27c RegistryEntry, ADR-38 adapter resolution)

`specOperationsFromRegistry(registry: RouteRegistry)` in build.ts consumes the
registry **only** via `registry.entries()` (no import of
`src/registry/registry.ts` anywhere in the file — checked by full read), and
maps each `RegistryEntry` field (`id`, `method`, `localPath` -> `path`,
`source`, `meta`) exactly per the pinned ADR-27c shape quoted in the story.
No `validatorFn`/`handlerFn` fields are touched, correctly, since the spec
builder never executes routes.

Adapter resolution: `resolveAdapter(op, fallback) = metaOf(op).adapter ??
fallback`, and the docstring on `buildSpec` states the `adapter` parameter is
"the already-resolved fallback (ADR-38)" — i.e. the `options.schemaAdapter ??
standardSchemaAdapter` half of the chain is expected to happen at the S-07
composition root, and this story only implements the `meta.adapter ?? fallback`
half. That division of responsibility matches the story's own upstream-contract
quote (C2: "`buildSpec` receives the adapter as a parameter") and ADR-38's
full chain `meta.adapter ?? options.schemaAdapter ?? standardSchemaAdapter` —
this story is not required to and does not reimplement the middle term, since
that belongs to the composition root (S-07, not yet built). `stub-adapter.test.ts`
tests both halves this story owns: global adapter used when no `meta.adapter`,
and `meta.adapter` overriding the parameter. No evidence of consuming an
older, superseded (ADR-54/56) shape — the field names and precedence in the
code match the ADR-27c/ADR-38 text quoted verbatim in the story file, current
per the story's own "non-superseded text" framing.

## Overall

Evidence supports the report's claims: TDD red/green transcripts show the
predicted failure mode and resolution; the 308-passed / 97.63%+ coverage run is
a single verbatim transcript, not reconstructed; the mutation artifact on disk
corroborates the 100.00%/376/7/0 numbers claim-by-claim rather than only in the
narrative; AC self-check table maps each of the 16 owned ACs to a named test
file/assertion, and spot-checking AC-023/AC-034 against source confirms the
mechanism, not just the test name. The disclosed process confusion (tail
buffering mistaken for stale-sandbox) reads as an honest incident note with a
file-level artifact (383/383, 0 survived) that is consistent with a clean
single rerun, not contaminated state. No corners found; no DISPUTE raised.

Status: **accepted** at monitor level.
