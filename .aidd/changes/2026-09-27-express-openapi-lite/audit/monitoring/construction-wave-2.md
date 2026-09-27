# Monitoring Report — Construction Wave 2

**Mode:** monitor
**Scope:** ST-002 (config), ST-003 (schema-adapter) Builder Reports
**Reviewer:** master-agent

## Summary verdict

Both stories' evidence substantively supports their claims. One cross-story
discrepancy found: ST-003's Builder Report asserts ST-002 still carries the
ADR-49 brand-key literal-widening bug, but the actual `src/config/errors.ts`
on disk does not have that bug — the assertion is stale/inaccurate evidence,
not a live defect. No corners found cut in either story's own scope.

## Item 1 — ADR-49 brand-key literal-widening: does ST-002 actually have the bug ST-003 flags?

ST-003's Builder Report (Lint/typecheck evidence section) states:

> "Full `npx tsc --noEmit` does report pre-existing errors in `src/config/**` and
> `test/config/**` ... and the same ADR-49 brand-key literal-widening issue this
> story fixed in `errors.ts`, still present in `src/config/errors.ts`/`test/config/errors.test.ts`."

Checked `src/config/errors.ts` directly (read in full):

```
static readonly [BRAND_KEY]: string = 'express-api-docs.v1.ApiDocsConfigError';
```

This is already the widened `: string` typing ST-002's own Builder Report claims
("typed `: string`, not left as a literal type, so a subclass may declare its own
differently-valued `[BRAND_KEY]` without a `tsc` variance error"). Comparing against
`src/adapter/errors.ts` (ST-003's own file):

```
static readonly [BRAND_KEY]: string = 'express-api-docs.v1.ApiDocsSchemaError';
```

Identical pattern — the fix is present in both files. ST-002's own Builder Report
also shows a clean `npx tsc --noEmit` (exit 0, no output) as its final green
typecheck evidence.

**Finding:** ST-003's flag is not corroborated by current source. Two possible
explanations, neither of which is a live ST-002 defect: (a) ST-003's builder ran
its full-suite check before ST-002's fixup commits landed and reported a stale
snapshot without re-verifying, or (b) copy-paste from an earlier observation not
re-checked at hand-off. Either way, ST-003's report cites unverified/stale evidence
for a claim about another story's files — a reporting-accuracy concern for ST-003,
not a defect for ST-002. No fix-loop action needed against ST-002; note for the
Auditor that ST-003's cross-story claim about ST-002 should not be taken as
authoritative without re-verification (which this note now supplies).

## Item 2 — ADR-04/21 import boundary: does src/config/** avoid zod and src/adapter/**?

Did not trust the ESLint rule's mere existence. Ran:

```
grep -rn "zod|adapter" src/config
```

Result: only comment lines reference "zod" or "adapter" (e.g.
`src/config/types.ts:2-3`, `:6-7`, `:86`; `src/config/spec-table.ts:174`), all of
which are ADR-38/ADR-04/ADR-21 explanatory comments about *not* importing them —
no `import`/`require` statement matches. Confirmed no live import of `zod` or
`src/adapter/**` anywhere in `src/config/**`. Claim holds on direct evidence, not
merely because a lint rule exists.

## Item 3 — Do ApiDocsConfigError and ApiDocsSchemaError implement ADR-49 consistently?

Read both files in full (`src/config/errors.ts`, `src/adapter/errors.ts`). Same
shape in both:

- `static readonly [BRAND_KEY]: string = 'express-api-docs.v1.<ClassName>'` (widened
  literal, both).
- `readonly [BRAND]: string[]` instance property, both.
- `collectBrands(new.target)` walking `Object.getPrototypeOf` over constructors,
  collecting each own `[BRAND_KEY]` via `hasOwnProperty` — logic is line-for-line
  equivalent between the two files (variable names differ trivially: `brands` vs
  `codes`, `brand` vs local push expression).
- `static [Symbol.hasInstance]`: both check `hasOwnProperty(this, BRAND_KEY)` to
  get an own key, fall back to `Function.prototype[Symbol.hasInstance].call(this, x)`
  when absent, otherwise check `Array.isArray(x?.[BRAND]) && brands.includes(key)`.

No divergence found — the two implementations are consistent with each other and
with the ADR-49 verbatim spec (`Symbol.hasInstance` snippet in both stories'
context sections matches what's on disk). `BRAND`/`BRAND_KEY` both sourced from
the single `src/core/types.ts` definition (`Symbol.for('express-api-docs.v1.brand')`
/ `Symbol.for('express-api-docs.v1.brandKey')`), so no drift in the underlying
symbols either.

## Other observations (not blocking)

- ST-002's mutation run (75.94, threshold 70) and coverage figures are internally
  consistent with the file sizes in its `git diff --stat`; no evidence of
  cherry-picked numbers.
- ST-003 explicitly deferred its own scoped Stryker run and the local zod@4.2.0
  floor reproduction ("time-boxed"), disclosed openly in its own report rather than
  hidden — flagged there as a merge-gate follow-up, which is honest self-reporting
  and not a concealment concern, but it is an outstanding gap the Auditor/QA phase
  should confirm gets closed before ST-003 merges.
- Both stories' AC self-check tables correctly scope each shared AC (AC-005,
  AC-047) to "this story's slice only," matching the epic's cross-story AC
  ownership notes rather than over-claiming full AC closure.

## Conclusion

No AC in either story is disputed by this read. One cross-story evidentiary
inconsistency (Item 1) is recorded for the Auditor's awareness — it resolves in
ST-002's favor on direct source inspection, so it does not, by itself, warrant
reopening ST-002. ST-003's deferred mutation/floor run is a disclosed open item
for the merge gate, not a quality concern with the work done so far.
