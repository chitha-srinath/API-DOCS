# QA Steps 1-3 — Monitoring Note (Master Agent)

Scope: post-review batch (6 dimension reports + collated `qa/findings.md` + security
report) for the 2026-09-27-express-openapi-lite change. Substantive quality read of
the review batch itself, per role protocol — not process compliance.

## Method

Read all inputs named in the dispatch: `qa/findings-{correctness,security,performance,
test-coverage,spec-compliance,delta}.md`, `qa/findings.md`, `qa/security-report.md`.
Independently re-derived the CRITICAL and 2 of 3 HIGH findings against the actual
`src/` on disk (read-only), rather than trusting the reviewers' prose.

## Spot-check 1 — F-01 (CRITICAL, dangling `$ref` in params/query)

Read `src/spec/build.ts:107-131` directly. `pathParameters`/`queryParameters` both call
`adapter.toJSONSchema(meta.params|meta.query, 'input')` and then only ever read
`schema.properties[name]` (or `schema.properties`) — there is no code anywhere in either
function, or in the surrounding module, that copies a `$defs` bag out of the top-level
adapter output into the per-parameter schema or into `components.schemas`. `requestBodyOf`/
`responsesOf` (lines 133-171), by contrast, pass the *whole* `adapter.toJSONSchema(...)`
result through untouched (`content: { 'application/json': { schema } }`), which is
consistent with the report's own claim that the bug is scoped to `params`/`query` only.
The finding's evidence (a live `SwaggerParser.validate()` repro against a `.meta({id})`-
tagged zod schema) is claimed, not independently re-run by me here (no shell tool in this
constrained spot-check), but the **code-level mechanism** the finding depends on — the
missing `$defs` propagation at exactly the cited lines — is real and directly observable
in the source. **Verdict: CRITICAL is not inflated.** A `$ref` to a bag that exists
nowhere in the document is a hard OpenAPI-3.1 validity break for a documented, ordinary
Zod usage pattern (named/reused schema via `.meta({id})`), and it directly falsifies
AC-015/AC-016 as the finding states — no counter-evidence found, no guard elsewhere in
`build.ts` that would degrade this to a lower severity.

## Spot-check 2 — F-02 (HIGH, glob `escapeChar` lastIndex bug)

Read `src/spec/glob.ts:1-43` in full. `REGEXP_METACHARS = /[.+?^${}()|[\]\\]/g` is indeed
global-flagged, and `escapeChar` calls `.test(char)` on it directly — a textbook
stateful-`lastIndex`-with-global-flag bug. Hand-traced the failure: `escapeChar('.')` on
a 1-character string succeeds and leaves `lastIndex = 1`; the *next* call to
`escapeChar` on another single metachar starts `.test()` from `lastIndex = 1` against a
length-1 string, which is out of bounds, so the regex engine returns `false` and (per
spec) resets `lastIndex` to `0` — meaning the second consecutive metachar is silently
treated as literal (unescaped) text, exactly as the finding describes, and the pattern
repeats in a two-call alternation (escape, skip, escape, skip...) for any run of adjacent
metachars. This is independently verifiable from the code alone, no repro run needed to
trust it — the state machine is small enough to trace by hand and the report's traced
example (`/a..b/x`) matches this mechanism exactly. **Verdict: HIGH is reasonable, not
inflated.** The failure mode is silent (no error, no test coverage per the report) and
has real security/correctness consequence (over- or under-matching an
`autoDetect.exclude`/`include` glob, which the security report's own OWASP section
relies on `serveSpec`/`serveDocs` defaults being intentional — a silently-broken exclude
glob undermines that same trust boundary). No obvious mitigating guard elsewhere in the
module (`toRegExp` has no post-hoc validation of the compiled pattern).

## Spot-check 3 — F-03 (HIGH, O(n^2) introspection via `findByHandle`)

Read `src/registry/registry.ts:22-25` and `src/introspect/index.ts:55-79`.
`findByHandle` is confirmed `Array.prototype.find` — genuinely `O(n)` per call, no index/
Map keyed by handler function. `handleRouteHandler` (introspect/index.ts:62-74) calls
`ctx.registry.findByHandle(handlerFn)` once per route-handler layer walked, and the walk
itself visits one layer per registered route, so the composition is `O(n)` layers ×
`O(n)` lookup = `O(n²)` exactly as claimed — the code-level mechanism is textbook and
undisputed. The 252ms-at-2000-routes / ADR-26 200ms-budget breach and the quadratic
scaling multiplier (1.16x → 2.57x as N doubles) are the report's own measured numbers,
not independently re-run here, but they are the expected shape for an O(n²) algorithm at
those N values, which is corroborating rather than surprising. **Verdict: HIGH is
reasonable.** No guard exists — `RouteRegistry`'s `entries()` returns a plain array
(`registry.ts:18-20`) with no secondary handle→entry index structure, so there is no
missed mitigation the reviewer overlooked.

## Spot-check 4 — F-04 (HIGH, dead `memoizeAdapter`)

Grepped `memoizeAdapter` across `src/` — the only match is its own definition line in
`src/adapter/memo.ts:14`; it is never imported anywhere else in `src/`. Read both cited
call sites directly: `src/serve/router.ts:50-52` resolves the adapter as
`options.schemaAdapter ?? standardSchemaAdapter` (no wrapping), and `src/route/typed.ts:
61-68`'s `resolveAdapter` returns `meta.adapter`, `globalOptions.schemaAdapter`, or
`standardSchemaAdapter` directly (also no wrapping). Both composition-root sites are
confirmed unwrapped, confirming the finding's core claim that memoization is defined and
unit-tested but never wired into the running package. **Verdict: HIGH is reasonable, not
inflated.** This is a straightforward, unambiguous dead-code/spec-vs-implementation gap
(ADR-03 promises the WeakMap memoization as a default-adapter-resolution behavior); the
measured 25-30% per-rebuild reduction is a secondary corroboration, not load-bearing for
the severity call — the primary defect (violates ADR-03's own stated contract, silently)
would justify HIGH on its own even without the perf numbers.

## Batch-wide read: severity calibration and cross-dimension checks

- **F-06 (security, prototype-scoped pollution, MEDIUM)**: read `src/config/merge.ts`
  in full. `mergeTwo` iterates `Object.keys(override)` and does `result[key] =
  overrideValue` with no `__proto__`/`constructor`/`prototype` denylist. Confirmed the
  mechanism is real (a `JSON.parse`-sourced `__proto__` key is a normal own-enumerable
  data property, so `Object.keys` picks it up, and bracket-notation assignment to a key
  literally named `__proto__` on a plain object *does* invoke the prototype setter).
  The security reviewer's own repro shows global `Object.prototype` is unaffected
  (verified in the same run) — correctly scoping this to MEDIUM rather than CRITICAL is
  the right call; I found no basis to raise or lower it further.
- **F-13/F-14 (LOW, unquoted attribute / no SRI)**: consistent with the reviewer's own
  "areas checked" note elsewhere that `cdnUrl`/`specUrl` are developer-set config, not
  request-derived — correctly keeping both at LOW rather than treating them as directly
  exploitable HIGH-severity XSS, since the attack requires a developer to source docs
  config from untrusted input first. Reasonable.
- **No under-claiming found**: spec-compliance's own "areas checked and found compliant"
  section (dedupe precedence, canonical sort, ProblemDetails wiring, path conversion)
  and correctness's parallel section both name specific line ranges for the "no finding"
  verdicts rather than a blanket "looks fine" — this is the same evidentiary bar the
  numbered findings use, so the absence of findings elsewhere in those files is not a
  gap I can fault from a read-only pass.
- **Collation integrity** (`qa/findings.md`): cross-checked the collated table's file:line
  citations and severities against each source file — all four spot-checked rows (F-01
  through F-04) transcribe severity, file:line, and claim faithfully from their source
  dimension reports; no inflation or softening introduced in collation. The stated "0
  same-file+line+claim duplicates" rationale for keeping both a security and a
  test-coverage finding on `src/config/merge.ts` (F-06 prototype-pollution vs. F-08
  aliasing/mutation) is correct — they are distinct claims about the same function (line
  27-43 vs. line 39 specifically), not a duplicate.
- **Delta report (0 findings)**: the two disclosed degradations (pre-construction
  snapshot predates source tree; `coverage`/`lint` sigma rows are `na` in both packs) are
  each named with a specific reason and traced to the packs read, not silently
  swallowed — matches the evidence bar for a null result.

## No corrections found

I did not find any finding whose cited evidence fails to support its claim, any
severity that reads as inflated or deflated against the actual blast radius, or any
obvious guard/mitigation the reviewers missed that would change a verdict on the
CRITICAL or the two HIGH findings I traced against source. The batch's evidentiary
discipline (concrete file:line citations, explicit "not proven"/"advisory" framing where
a claim is genuinely unproven — see spec-compliance finding #2 and performance finding
#3) is consistent across all six dimension files, not selectively rigorous on the
CRITICAL/HIGH rows only.

## Verdict

**Batch accepted.** F-01 (CRITICAL) and the F-02/F-03/F-04 (HIGH) findings I
spot-checked all hold up against direct source inspection — the cited file:line
evidence genuinely supports each claim, the severities are proportionate to the
described blast radius, and no missed guard changes any of the four verdicts. No
objection to proceeding to step 3's adversarial verification queue (F-01, F-02, F-03,
F-04) as scoped.
