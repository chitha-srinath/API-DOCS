# Execution Environment Protocol — sandboxing, routing, and self-triggering

Three things about *where and how* the framework runs, which together decide
whether it is safe to let an agent act, affordable to let it think, and likely
to actually run at all.

## 1. Sandboxed execution — containment beats trust

The threat is not malice, it is confident wrongness. An agent that writes
`rm -rf "${BUILD_DIR}"` with `BUILD_DIR` unset is one expansion away from the
user's home directory. Containment is cheaper than trust, and cheaper than
reviewing every generated command.

Agent-issued test commands run through `aidd-sandbox.sh`:

```bash
.aidd/framework/scripts/aidd-sandbox.sh -- pytest -q
.aidd/framework/scripts/aidd-sandbox.sh --writable -- npm test   # when the run must write
```

| Property | Value | Why |
|---|---|---|
| Lifetime | `--rm` | disposable by construction, not by cleanup |
| Network | `none` by default | no exfiltration path, and no flaky-network failures |
| Repo mount | read-only by default | a run that must write asks for `--writable` |
| User | the caller's uid/gid | never root, so a `:rw` mount keeps host ownership |
| Limits | memory + pids capped | a fork bomb in generated code stays bounded |

**Degradation is loud, and that is the whole design.** No container runtime
means the command still runs — on the host, with the reason on stderr for the
run's degradation record (`evidence.md`). `AIDD_SANDBOX_REQUIRED=1` turns that
same situation into a hard failure instead. The one unacceptable outcome is a
silent fallback: a caller that believes it was isolated when it was not.

Exit codes are the command's own, so a caller reads them normally. Sandbox-level
failures use **125**, distinct from any plausible test exit code, so "the sandbox
broke" is never mistaken for "the tests failed".

## 2. Model routing — pay for reasoning where reasoning is needed

Running every dispatch on one frontier model is the easy default and the
expensive one. A mechanical rename does not need what an adversarial
verification needs.

Routing lives in `.aidd/config.json` (seeded from `../templates/config.json`):

```bash
.aidd/framework/scripts/aidd-route.sh model adversarial      # the frontier tier
.aidd/framework/scripts/aidd-route.sh model mechanical       # the cheap tier
.aidd/framework/scripts/aidd-route.sh cost <model> <in> <out>
.aidd/framework/scripts/aidd-route.sh table                  # every class, resolved
```

### 2.1 Why a second config file exists

`constitution.md` holds **policy a human must approve** — budgets, gates, rigor
modes, anything that changes what the framework *permits*. `.aidd/config.json`
holds **machine-tunable routing** a script reads on every dispatch. The boundary
is the approval requirement, not the format: if changing a value should require
a human, it belongs in `constitution.md`.

### 2.2 Rules that do not bend

- **An unmapped dispatch class falls back to the declared default.** A routing
  gap must never be able to stop a run.
- **An unpriced model records `na`, never `0`.** A zero in a measurement column
  reads as "free", which is the one thing it never is (`cost-governance.md`).
- **Credentials come from the environment only.** This file is committed; a key
  in it would be committed too. `aidd-route.sh audit` fails the run on any
  credential-shaped entry, and the pre-commit hook runs that audit — because a
  committed key is not recoverable by editing the next commit.
- **The ledger records the model actually used**, with its rate, per dispatch —
  not one blended figure for the run.

## 3. Self-triggering — the framework runs itself

A review that needs someone to remember to ask for it is a review that stops
happening under deadline.

### 3.1 Local: the pre-commit hook

```bash
.aidd/framework/scripts/aidd-install-hooks.sh              # install
.aidd/framework/scripts/aidd-install-hooks.sh --uninstall  # remove
```

Three properties, because a hook missing any one of them gets deleted by the
first developer it annoys:

- **opt-in** — nothing is installed until someone runs the installer
- **idempotent** — running it twice leaves one hook, not two
- **reversible** — `--uninstall` restores whatever was there before

A pre-existing non-AIDD `pre-commit` hook is **preserved and chained**, never
overwritten. Silently eating another tool's hook is how a framework loses a
repo's trust permanently. Escape hatches: `git commit --no-verify` for one
commit, `AIDD_HOOK=off` for a session.

What the hook does is deliberately small — the routing-config credential audit
(blocking) and a staged-file index refresh (advisory). A slow hook gets bypassed,
and a bypassed hook checks nothing.

### 3.2 CI: the review workflow

`../../.github/workflows/aidd-review.yml` runs on every pull request. It performs
the checks that need **no model and no credentials**, so it works on a fork PR
where secrets are unavailable: resolve BASE/HEAD by merge-base, audit the routing
config, build the index and verify it is not stale, enumerate changed files, run
the self-tests, and upload the review inputs as an artifact.

The adversarial review itself is dispatched by the orchestrator per
`pr-review.md`. **CI never posts to a PR thread.** Posting is an external write
and stays behind the explicit human approval that protocol requires — automating
the trigger does not automate the consent.
