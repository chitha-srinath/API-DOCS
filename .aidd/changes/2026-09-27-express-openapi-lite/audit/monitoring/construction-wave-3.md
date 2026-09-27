# Construction Wave 3 — Monitoring Note (ST-004)

## Scope
ST-004 Builder Report (typed route, request/response validation, async wrap,
problem+json, RouteRegistry). Focus per dispatch: the builder's self-flagged
interpretation gap around `route()`'s signature and its load-bearing effect on
S-05/S-06/S-07.

## Evidence checked
- `stories/ST-004-typed-route.md` (Builder Report, AC self-check, mutation output).
- `architecture.md` lines 1-60 (Approach, consumer snippet, C3/C9 component table,
  dependency order) and lines ~110-145 (ADR-27c pinned seam, C0/C5 excerpts).
- `src/route/typed.ts`, `src/registry/registry.ts`, `src/core/types.ts` (actual
  committed source, not just the report's prose).
- `stories/ST-005-introspection.md`, `ST-006-spec-builder.md`, `ST-007-serve-docs.md`
  for what downstream stories already assume about `RegistryEntry`/`route()`.

## Finding 1 — Test/build evidence is credible
Red→green vitest transcripts, `npm test` (201/201, coverage above the 90/90/90/90
gate), `tsc --noEmit` clean, lint clean, and a scoped Stryker run (82.51 ≥ 70
break threshold, one documented survivor with a plausible justification) are all
present with commands and output, not just assertions. `src/registry/registry.ts`
matches `core/types.ts`'s `RegistryEntry`/`RouteRegistry` (ADR-27c) verbatim —
`register`, `entries()`, `findByHandle` all implement the pinned interface with no
redeclaration, confirmed by direct read of both files. **Question (2) from the
dispatch is answered: yes, registry.ts and core/types.ts's RegistryEntry are
consistent.** This part of the report is not overstated.

## Finding 2 — The route() signature genuinely diverges from architecture.md, not just fills a gap
architecture.md's own text (read directly, not paraphrased):

> Consumer usage:
> ```ts
> router.get('/users/:id', ...api.route({ params, query, responses }, handler));
> ```
> (line 25)

> C3: "`route(meta, handler)` returns `[validator, wrapAsync(handler)]`." (line 39,
> and quoted again verbatim in ST-004 itself, line 59)

Both citations are unambiguous: `route()` takes exactly **two** arguments (`meta`,
`handler`); `method` and `localPath` are supplied to `router.get(path, ...)`
separately, outside `route()`'s own argument list. The builder instead shipped
`route(method, localPath, meta, handler)` — a **4-arg public API** — in
`src/route/typed.ts` (`export type RouteFn = (method, localPath, meta, handler) => ...`).
This is not an unspecified gap the builder filled; it is a specified API shape
the builder overrode. The Builder Report's framing ("does not give route() the
method/local path it needs... I resolved the gap") understates this: it wasn't
absent, it was answered differently by architecture.md's own snippet, in a way
the builder's chosen signature contradicts.

The underlying tension is real and worth surfacing to the architect rather than
resolved unilaterally: under the documented 2-arg call spread into
`router.get(path, ...api.route(meta, handler))`, `route()` cannot know the path
at the time it must register "at declaration" (ADR-17/C12: "populated at
declaration"). Two designs resolve this, and they are materially different:
- **(a) builder's choice** — widen `route()`'s public signature to take
  method/path explicitly, duplicating the path already given to `router.get()`
  (redundant, and a possible source of mismatch bugs if a caller passes two
  different paths).
- **(b) architecture-consistent alternative** — the S-07 composition root (C9)
  wraps `Router.get/post/...` to capture method+path at the actual declaration
  call, correlating to the registered entry via the `[META]` tag / identity —
  exactly the mechanism C5 already documents for the *introspection* side
  ("Registry entries are located by `RouteRegistry.findByHandle`", line 100 of
  ST-005; C5 row in architecture.md line 41). This keeps `route(meta, handler)`
  as documented and leaves method/path plumbing to the composition root, never
  to route() itself.

Nothing in architecture.md chooses between (a) and (b); the builder picked (a)
unilaterally, changing a documented public API rather than filling a true blank.

## Finding 3 — a second, smaller documentation conflict: `meta.response` vs `responses`
The consumer snippet (line 25) writes `{ params, query, responses }` (plural);
AC-006's prose says "schemas for params, query, body **and response**" (singular).
The builder chose singular `meta.response`, matching AC-006's prose but
contradicting the snippet verbatim. Lower-stakes than Finding 2 (an internal
naming inconsistency in the source docs, not an architecture decision), but it
compounds the same theme: two source-of-truth documents disagree, and the
builder's report treats its pick as settled rather than flagging the conflict
explicitly enough for an architect to weigh in.

## Answering the dispatch's three questions
1. **Is the interpretation consistent with architecture.md?** No — it diverges
   from both the verbatim consumer snippet and the verbatim C3 sentence quoted
   inside ST-004 itself. It is a plausible engineering choice, not a
   architecture-sanctioned one.
2. **Does registry.ts match core/types.ts's RegistryEntry?** Yes, exactly.
3. **Escalate before Wave 4?** Yes — recommend escalation, not silent drift.
   Rationale: ST-005 (S-05) already depends on `RouteRegistry.findByHandle` as
   its correlation mechanism (ST-005 line 100, C5 architecture text) — S-05's
   design does *not* strictly need `RegistryEntry.method/localPath` to be
   correct, since the stack walk supplies method/path independently and
   correlates via handle identity. So S-05 is likely safe to proceed even if
   Finding 2 is later revised. The real exposure is **S-07**: its story does
   not exist yet, and if it is drafted assuming the builder's 4-arg
   `createRoute`/`route(method, localPath, meta, handler)` shape as the given
   public contract (as this dispatch's own framing already does — "must
   actually call createRoute() and wire the real registry/options/logger"),
   the public API divergence from architecture.md's documented consumer
   snippet becomes permanent without an architect ever having chosen it. An
   ADR amendment (recording either "route() signature widened to
   (method, localPath, meta, handler), superseding the C3/consumer-snippet
   2-arg form" or reverting to design (b) above) should be recorded before
   S-07's story is authored, and ideally before Wave 4 dispatch, so ST-005 is
   not built against an architecture text that will need retroactive
   amendment anyway.

## Recommendation
**Escalate to architect for an ADR amendment before Wave 4**, scoped narrowly:
(i) ratify or reject the builder's 4-arg `route()` signature against the
documented 2-arg consumer snippet/C3 text; (ii) resolve `meta.response` vs
`responses` naming; (iii) state explicitly whether S-07's composition root is
expected to wrap `Router` methods (design b) or simply pass method/path through
to `createRoute()` at each call site (design a, as built). Wave 4 (ST-005) can
likely proceed in parallel since its dependency on the registry is via
`findByHandle` identity, not method/localPath values — but S-07's story should
not be drafted until this is pinned.
