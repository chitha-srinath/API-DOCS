# Negotiation Log — <change-id>

<!-- One section per disputed AC that reaches this protocol (../protocol/negotiation.md).
     Auditor opens the section with the position; the re-dispatched Master Agent appends
     the response; whoever ends it — Auditor (accept) or Supervisor (adjudication)
     — appends the ruling. Append only; never a separate file, never an overwrite. -->

## AC-<id>

<!-- Short-circuit ACs skip Position/Response entirely and go straight to Ruling — two
     distinct triggers: the Master Agent's monitoring already concurs the work is
     deficient, OR no monitoring note covers the subject at all (nothing to negotiate
     against). Record which one in the Ruling's who-ruled value. -->

### Position — exchange <N> (starting at 1)

<!-- Auditor writes this: the AC id, the evidence its verdict already cites, and the
     exact reason the Master Agent's acceptance doesn't close the gap. Evidence-block
     format (../protocol/evidence.md): command, trimmed output, exit code, timestamp. -->

### Response — exchange <N>

<!-- Master Agent writes this: accept or contest. contest carries counter-evidence in
     the same evidence-block format. accept ends negotiation here — no adjudication. -->

**Disposition:** accept | contest

<!-- Repeat the Position/Response pair for exchange 2 only if exchange 1 is contest and
     budget remains (max 2 exchanges per AC). -->

### Rounds

| Exchange | Disposition accept\|contest | Counter-evidence cited |
|---|---|---|

### Ruling

<!-- PROVEN\|DEFECT\|UNRESOLVABLE, and who ruled — exactly one of `negotiation` (Master
     Agent accepted), `Supervisor adjudication`, `short-circuit` (orchestrator appended
     when the Master Agent's monitoring concurred deficiency), or
     `short-circuit (no monitoring note)` (orchestrator appended when no monitoring note
     covered the subject — distinct from the monitoring-concurs trigger). UNRESOLVABLE
     forces a human gate in both autonomy modes, take-care included. -->

<!-- Repeat the ## AC-<id> section for every disputed AC that reaches this protocol. -->
