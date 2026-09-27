# Counter-Arguments — 2026-09-27-express-openapi-lite

<!-- Independent Thinker. The honest case against the chosen architecture. -->
<!-- Inputs read: architecture.md, arch-candidates/ (listed). context/snapshot.md not re-read: greenfield, as architecture.md records. No impact-report.md. -->

## Strongest counter-arguments

1. **ADR-07 puts all path knowledge in the least verified part of the system, the Express 5 mount-prefix recovery.** Typed, `describe()` and plain routes all get their full path from the stack walk. On Express 5 (`router@2`), a `Layer` keeps compiled `matchers` (path-to-regexp v8 `match()` functions) and `keys`. It does not obviously keep the original mount string, and `layer.path` is only set per request after a match. C5 says the prefix comes "from the layer matcher or path", but none of the probe evidence tests this. If the prefix cannot be recovered, every route on a mounted `Router` is documented with the wrong path on the default Express major. That covers typed routes too, which a registry keyed on declaration would have handled. The architecture chose a single source of truth and then put it on the least verified mechanism. Falsifiable: write a v5 fixture with `app.use('/api', r); r.get('/users/:id')` and check whether the walk can produce `/api/users/{id}` without calling the matcher on a probe string.
2. **The `[META]` tag on the handler function is lost easily, and it fails silently.** `route()` returns `[validator, wrapAsync(handler)]`, and the walk reads the tag from a layer handle. Many things replace the function reference: users wrapping it again (`asyncHandler(...)`, tracing and APM wrappers such as OpenTelemetry's express instrumentation, which patches layers), spreading only one element, or `Router.route().get(...)` chains. In all of these the tagged typed route becomes an untagged plain route. The result is that schemas vanish from the docs with no error, because the walk "never throws" and logs only at debug level. This is AC-031's precedence logic failing quietly, not loudly.
3. **ADR-06 and ADR-07 contradict each other.** ADR-07 rejects a `WeakMap<Router, OpDef[]>` registry. ADR-06 then says `getSpec()` before the first request "returns the typed-only spec from the tag registry of routes created by the instance". That registry does not exist in the component table (no file owns it), and without a walk it has no mount prefixes. So `getSpec()` before any request, which is the obvious call in a build script or test, either returns wrong paths or needs the very registry that was rejected. S-06 and S-07 will find this during construction, and one of them will invent the registry outside the file-ownership plan.

## Hidden assumptions (and what breaks if false)

- **The Express 5 layer keeps enough to rebuild the mount path.** If false, ADR-07 fails for mounted routers on v5 and C5's scope becomes "probe matchers heuristically", which is the same heuristic risk R-2 accepts for v4, now on both majors.
- **Handler identity survives registration.** If false (wrappers, APM), typed routes are downgraded without anyone noticing (argument 2).
- **Layer count is a sufficient fingerprint.** ADR-02 admits it misses in-place replacement. Also, counting recursively on every spec request means walking every nested stack each time. That is cheap at 200 routes, but it is a walk on every request, not the O(1) warm path B-1 implies.
- **`req.app` is the app whose routes you want.** With sub-apps (`app.use('/v1', subApp)`), `req.app` inside the mounted router is the sub-app. Routes from the parent or sibling apps are silently absent.
- **Wrapping `res.json` catches responses.** `res.send(obj)` delegating to `res.json` is an internal behaviour of Express. It holds on v4 and v5 today, but it is exactly the kind of private coupling R-1 lists and does not test for.
- **`OPTION_SPEC` `satisfies Record<OptionPath<…>>` compiles.** A recursive template-literal `OptionPath` type over a deep options type with unions and functions can hit TS depth limits or widen to `string`. If it widens, the "cannot drift" guarantee behind ADR-04 is void, and nothing reports it.

## Most likely late/production failure mode

A user on Express 5 with the standard structure `app.use('/api', apiRouter)`, plus one APM or async wrapper, sees docs that are valid OpenAPI (swagger-parser passes) but have wrong paths or missing schemas. No exception is thrown, no test fails, and the only trace is a debug log line. All fixture tests pass because fixtures build apps the way the author expects, not the way production apps are instrumented. The swagger-parser oracle (ADR-14) cannot catch it, because a wrong spec can still be a valid one.

## Alternative worth reconsidering (+ the cheap experiment to settle it)

**A hybrid discovery path:** typed and `describe()` routes are recorded at declaration in a per-instance registry (method, local path, meta). The stack walk is used only to (a) attach the mount prefix by matching the registered handler identity and (b) find plain routes. If prefix recovery fails, the typed op is still emitted, with its local path and a single `warn`-level log rather than debug. This degrades to "slightly wrong prefix, schema kept" instead of "schema lost". It also gives ADR-06's pre-request `getSpec()` a real owner.

**Cheap experiment (under 1 hour, before or as the first task of S-05):** a throwaway script against `express@5.2.1` and `express@4.22.3` with three fixtures: nested `Router` mount, `app.use('/v1', subApp)`, and a handler wrapped by a trivial `fn => (req,res,next)=>fn(req,res,next)`. For each, print the prefix the walk recovers and whether `[META]` is visible. If v5 prefix recovery works and there is a documented answer for the wrapper case, ADR-07 stands. If not, adopt the hybrid.

## Verdict

**DECISIVE: NO.** The risk-first synthesis stands, conditional on two things. First, the Express 5 prefix spike above must pass before S-05 is committed. Second, the ADR-06/ADR-07 registry contradiction must be resolved in architecture.md, either by assigning a file owner for the typed-route registry or by defining `getSpec()` before the first request as "requires `{ app }`". Tag-loss must also log at `warn`, not `debug`. None of these needs a redesign before G2; each is a bounded amendment.
