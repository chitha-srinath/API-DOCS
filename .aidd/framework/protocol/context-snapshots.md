# Context Snapshot Protocol

A repo-level context pack so every role reads instead of re-crawling.

## Pack location

`.aidd/context/` — gitignored, never committed or pushed. Built by
`.aidd/framework/scripts/build-snapshot.sh <tag>`, which writes `snapshot.md`,
`quality-baseline.md`, and `delta.md` plus a `.last-ref` marker (also gitignored).

## Rebuild cadence

Rebuild at every phase boundary and after every Construction wave. Tag each rebuild:

- `pre-<phase>` — before every phase; the playbooks wire the line explicitly for
  Inception, Construction (`pre-construction`, the delta reviewer's baseline), QA, and
  Delivery.
- `post-wave-<n>` — after each Construction wave completes.

## Measured sigmas

After each rebuild, when the active change's architecture.md declares canonical
coverage or lint commands, the orchestrator runs them and appends their evidence
blocks (per `../protocol/evidence.md`) to quality-baseline.md's Coverage/Lint
sections, replacing the `na` rows. This is the one sanctioned edit to a generated
pack file; without canonical commands the `na` rows stand (degradation is explicit).
The delta reviewer's sigma-regression binding covers coverage/lint only when both
packs carry these measured rows.

## Consumption rule

Every role reads `snapshot.md` (and `quality-baseline.md` where relevant to its
dimension) FIRST, before touching the live repo. If the pack is missing, the role
proceeds anyway and notes the degradation explicitly — it does not block on a
missing pack, and it does not silently skip the note.

## Resume rule

A snapshot is never trusted across a resume. Rebuild before continuing: re-prove,
never trust. Gates never pin snapshot hashes — the pack is a reading aid, not a
verification artifact.

## History trail

Every rebuild copies its three files to `history/<UTC-stamp>-<tag>/` under
`.aidd/context/`, so prior packs stay inspectable. The delta reviewer (`mode=delta`)
compares the **pre-implementation** pack — the latest one tagged `pre-construction`,
falling back to `pre-inception`, never `pre-qa` — against the current pack, to surface
what the implementation actually changed (`../roles/reviewer.md`).
