# Jira Integration Protocol

Optional; degrades gracefully. Never a hard dependency.

## Pull (Inception)

If the intent references a ticket (e.g. `PROJ-123`), the Product Analyst obtains
summary/description/acceptance criteria in this order:

1. Atlassian MCP tools, when connected.
2. Jira REST API using env-configured credentials (`JIRA_BASE_URL`, `JIRA_EMAIL`,
   `JIRA_API_TOKEN`) — read-only calls.
3. Ask the human to paste the ticket text.

Imported ACs get stable ids `AC-1, AC-2, …` recorded in `prd.md`; the ids thread through
stories (`ac_ids`), tests, and the final `ac-matrix.md`.

## Write-back (Delivery, optional)

Posting the AC matrix as a Jira comment or transitioning the ticket:

- OFF by default. Requires `constitution.md` to enable it for the repo AND explicit human
  approval in the current run (external side effect — both modes).
- The synced comment is exactly the AC matrix summary table plus a PR link.
