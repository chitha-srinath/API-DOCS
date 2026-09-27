# Interrogation Protocol

The Auditor validates a subject's claimed work against its acceptance criteria by
direct artifact interrogation — bounded challenge/response rounds, never live dialogue.
Artifacts are the only inter-agent channel.

## Subjects

- **Construction, per wave:** subject = a Builder Report.
- **QA, final audit:** subject = a tester/reviewer report, or an AC-matrix row.

## Artifact layout

Written under `.aidd/changes/<id>/audit/interrogation/`:

```text
<subject-id>-round1-challenge.md
<subject-id>-round1-response.md
<subject-id>-round2-challenge.md
<subject-id>-round2-response.md
<subject-id>-verdict.md
```

## Challenge

A challenge names, for every disputed AC: the AC id, the evidence gap, and the exact
proof demanded. Vague challenges are invalid by format — "prove it" is rejected; "run
the deleted-cart flow and paste the 404 response" is not.

Template: `../templates/interrogation-challenge.md`.

## Response

The challenged sub-agent is re-dispatched once per round to write that round's
response. Every claim uses the mandatory evidence-block format from
`../protocol/evidence.md` — command, trimmed output, exit code, timestamp. A response
missing an evidence block for a demanded AC is rejected once with "evidence missing";
a second miss on the same AC marks it DISPUTED for the round.

Template: `../templates/interrogation-response.md`.

## Dispatch

The orchestrator dispatches every party; agents never talk live. The Auditor writes
the challenge. The orchestrator re-dispatches the challenged sub-agent to write the
response. The Auditor reads the response and either closes the AC (PROVEN), writes the
next round's challenge (DISPUTED, if budget remains), or writes the final verdict.

## Budget

Max **2 rounds** per subject. Rounds used are tracked in change-state
`audit.interrogation.rounds_used` against `audit.interrogation.max` (schema shipped).
The round-2 verdict is final regardless of remaining disputes — there is no round 3.
The counter tracks only the subject currently under interrogation: the orchestrator resets `rounds_used` to 0 each time a new subject enters interrogation.

## Verdict

After round 2, or earlier once every AC is settled, every AC the subject claims is
exactly one of `PROVEN | DISPUTED`. PROVEN requires cited executed evidence; DISPUTED
requires a named evidence gap. Written to `<subject-id>-verdict.md`
(`../templates/auditor-verdict.md`).

## Routing

Every DISPUTED AC goes to the negotiation protocol (`../protocol/negotiation.md`) between
the Auditor and the Master Agent. A PROVEN AC needs no further action.
