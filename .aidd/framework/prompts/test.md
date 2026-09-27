# AIDD: exhaustive testing

Run the AIDD test-engineer team on the target (a story id, a fix/diff, an API surface, or
the active change if omitted). Read `.aidd/framework/roles/test-engineer.md` and the
Exhaustive Testing step in `.aidd/framework/playbooks/40-qa.md`, then:

1. For each test category, design an exhaustive case matrix and EXECUTE it →
   `qa/tests/<category>.md` (sequential fallback: category order in the role file).
2. Consolidate into `qa/test-report.md`.
3. Feed every FAIL into the QA fix loop.
4. On approval, add a `## Test Report` section to each affected story and record the
   `g_test_report` gate entry (`.aidd/framework/protocol/gates.md`).
