# Context Index Protocol — query locally, read narrowly

A role that must understand a repository has two bad options: read everything,
or guess. Reading everything is expensive and mostly irrelevant; guessing is
wrong. This protocol is the third option — a role reads **structure** first,
then pulls only the **spans** it actually needs.

The rule this whole protocol enforces: **never read a file to find a symbol.**

## 1. The two artifacts

`context-snapshots.md` already builds a prose pack that says what the repo *is*.
The index says where every symbol *lives*. They are complementary and both live
under the gitignored `.aidd/context/`.

| Artifact | Answers | Built by |
|---|---|---|
| `snapshot.md`, `quality-baseline.md`, `delta.md` | what this repo is, how healthy, what changed | `build-snapshot.sh` |
| `index.json` | where every symbol is, and whether it moved | `aidd-index.py` |

## 2. Dual state — why the hash is not optional

Every index entry carries both halves:

- **structure** — the symbols a parser found, with `start`/`end` line spans
- **content** — the git blob hash of the file those spans were parsed from

The hash is what makes a span trustworthy. A span is valid only for the exact
bytes it was parsed from, so a consumer compares hashes **before** believing a
span, and a rebuild reparses only files whose hash moved. Structure without the
hash is a cache with no invalidation story — and a stale span is worse than no
span, because the reader cites lines that have moved and never notices.

```json
{"version":1,"hash_algo":"git-blob-sha1","parser":"regex",
 "files":{"src/store.py":{"hash":"<git blob sha1>","lang":"python","lines":42,
   "symbols":[{"name":"Cart","kind":"class","start":4,"end":9,
               "signature":"class Cart:"}]}}}
```

## 3. Parsing, and what happens when it cannot

Tree-sitter is used when it is importable, and is **never required** (ADR 002
forbids hard third-party dependencies). Absent it, a per-language extractor
finds declarations and resolves their spans by indentation or brace matching.

Degradation is explicit at every level, and never silent:

| Situation | Entry | Consequence |
|---|---|---|
| Tree-sitter present | full parse | most precise spans |
| Tree-sitter absent | regex extractor | spans conservative — a missed symbol degrades to "read the file" |
| Language unknown, binary, or over 2 MB | path + hash only | staleness still detectable; no spans offered |
| Not a git repo | no index | roles read files, and record the degradation |

Extractors are deliberately conservative. A **missed** symbol costs one file
read; a **bogus** symbol sends a reader to the wrong lines. Prefer under-matching.

## 4. Reading a span — the query-first rule

**Every role reads structure before it reads source.** When a role needs a
symbol, it queries; it does not open the file.

```bash
.aidd/framework/scripts/aidd-read-block.py <file> <symbol>     # the span + direct type deps
.aidd/framework/scripts/aidd-read-block.py <file> --line 240   # the symbol enclosing a line
.aidd/framework/scripts/aidd-read-block.py <file> --list       # what is in this file
```

`read_block` hashes the file before serving. On a mismatch it reparses **that
file only**, then serves — so a span is never stale, and a stale index costs one
file's reparse rather than a full rebuild.

"Direct type dependencies" are signature-scoped, not body-scoped: the
identifiers in the symbol's own signature that are themselves indexed symbols,
capped, and rendered as signatures rather than bodies. Body-scoped resolution
would drag in the whole call graph and reintroduce exactly the bloat this
protocol exists to remove.

A role still reads a whole file when it legitimately needs one — a config, a
short module, a file with no symbols. The rule is not "never open a file"; it is
**never open a file merely to locate something the index already knows**.

## 5. Rebuild cadence

- Every phase boundary and after every Construction wave, with the snapshot pack
- Before a review dispatch, so the diff and the index agree
- On the pre-commit hook, for staged files only (advisory — never blocks a commit)
- Never trusted across a resume: rebuilt before continuing

The index is a **reading aid, not a verification artifact**. Gates never pin an
index hash, and no finding may rest on the index alone — a finding cites the
tree, which is why `read_block` reads live bytes rather than serving cached text.

## 6. Verification dispatch carries a patch, not file bodies

A verifier judging a change needs the change, not the repository. The
verification dispatch of `pr-review.md` therefore carries an isolated patch
reference — the builder registers each change as a commit or patch — and the
verifier resolves surrounding context on demand through `read_block`.

This preserves the two rules that make verification worth running: the verifier
is a **different agent** than the finder, and its findings still cite
`file:line` against the post-change tree.

## 7. Test output is redacted before it reaches a role

A failing suite emits thousands of lines carrying three facts: what broke, what
was asserted, and where. `aidd-redact-log.py` reduces the log to those, and
reports the reduction ratio so the compression is visible rather than assumed.

The constraint runs opposite to "compress as much as possible":

> A redactor that eats the real error is strictly worse than no redactor,
> because the reader cannot tell that it happened.

So every rule is gated on signal detection — a line carrying an error type, an
assertion, or a `file:line` is **never dropped**, whatever else it matches.
Repeated lines collapse **with a count** (`(x400)`), because "this failed 400
times" is itself a finding. An unrecognized format is truncated **and labelled**,
never silently emptied.

## 8. What this protocol does not claim

It does not claim a token saving it has not measured. The benchmark harness
(`../../bench/harness.md`) is what turns the claim into a number, and the rule
from `cost-governance.md` holds unchanged: a cheaper run that finds fewer real
defects is a **regression, not a win**. Record defect-detection parity alongside
any token figure, or the number means nothing.
