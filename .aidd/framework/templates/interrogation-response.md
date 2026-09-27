# Interrogation Response — <subject-id> round <N>

<!-- Challenged sub-agent writes this: one section per AC named in this round's
     challenge, each closed with an evidence block. -->

## AC-<id>

<!-- Evidence-block format (../protocol/evidence.md): command, trimmed output,
     exit code, timestamp. -->

```text
$ <command>
<trimmed output — first/last relevant lines>
[exit <code>] <ISO-8601 timestamp>
```

<!-- Repeat the AC section + evidence block for every AC in this round's challenge.
     A missing evidence block for a demanded AC is rejected once; a second miss on
     the same AC marks it DISPUTED for the round. -->
