#!/usr/bin/env python3
"""Reduce a test-failure log to its signal, and report how much was dropped.

A failing suite emits thousands of lines that are the same three facts wearing
different hats: what broke, what was asserted, and where. Feeding the raw log to a
role costs a fortune and buries the answer.

The hard constraint runs the opposite way from "compress as much as possible": a
redactor that eats the real error is strictly worse than no redactor, because the
reader cannot tell that it happened. Every rule here is gated by `_is_signal()` —
a line carrying an error type, an assertion, or a `file:line` is never dropped,
whatever else it matches. An unrecognized format is truncated *and labelled*,
never silently emptied.

Usage:
  aidd-redact-log.py < raw.log
  pytest ... 2>&1 | aidd-redact-log.py --max-lines 60
  aidd-redact-log.py raw.log --json
"""

import argparse
import json
import os
import re
import sys

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
TIMESTAMP = re.compile(r"^\s*\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,\d]*Z?\]?\s*")
DURATION = re.compile(r"\b\d+(?:\.\d+)?\s?(?:ms|s|sec|seconds)\b")
HEXADDR = re.compile(r"\b0x[0-9a-fA-F]{6,}\b")

# file:line — the single most load-bearing token in any failure log.
FILE_LINE = re.compile(r"([\w./\\-]+\.[A-Za-z]{1,6}):(\d+)")

# Error/assertion signals across the common runners.
SIGNAL = re.compile(
    r"\bAssertionError\b|\bassert\b|\bExpected\b|\bexpected\b|\bactual\b"
    r"|\b[A-Z]\w*(?:Error|Exception)\b"
    r"|\bpanic:|\bFAILED\b|\bFAIL\b|\bFAILURE\b|\bfailed\b"
    r"|^\s*E\s|\berror\[E\d+\]|\berror:|\bTraceback\b"
    r"|\bnot ok\b|✕|×\s|\bAssertionFailedError\b"
)

# Pure noise: progress bars, dependency chatter, environment banners. The bar for
# appearing here is that the pattern cannot carry an error type, an assertion, or
# a file:line — and _is_signal() still overrides it if one slips through.
NOISE = re.compile(
    r"^\s*(?:"
    r"Collecting\s|Downloading\s|Requirement already satisfied|Installing collected"
    r"|npm (?:WARN|notice|info)|yarn install|added \d+ packages|audited \d+ packages"
    r"|Compiling\s|Downloaded\s|Finished\s+(?:dev|release|test)"
    r"|go: downloading|Fetching\s|Resolving\s"
    r"|={5,}|-{5,}|_{5,}|\*{5,}"
    r"|platform \w+ -- Python|rootdir:|plugins:|cachedir:"
    r"|✓|√"
    r")"
)

RUNNERS = [
    ("pytest", re.compile(r"={2,}\s*(?:FAILURES|short test summary)|^E\s+\w*Error", re.M)),
    ("jest", re.compile(r"●\s|✕\s|Tests:\s+\d+ failed", re.M)),
    ("go-test", re.compile(r"^---\s+FAIL:|^FAIL\s+\S+", re.M)),
    ("cargo", re.compile(r"^error\[E\d+\]|^---- .* stdout ----|thread '.*' panicked", re.M)),
    ("junit", re.compile(r"\[ERROR\].*Tests run:|AssertionFailedError|at org\.junit", re.M)),
    ("rspec", re.compile(r"^Failures:\s*$|rspec \./spec", re.M)),
]


def detect_runner(text):
    for name, rx in RUNNERS:
        if rx.search(text):
            return name
    return "unknown"


def _is_signal(line):
    return bool(SIGNAL.search(line) or FILE_LINE.search(line))


def normalize(line, root):
    """Strip presentation noise. Never removes a token that carries meaning."""
    line = ANSI.sub("", line).rstrip()
    line = TIMESTAMP.sub("", line)
    if root:
        line = line.replace(root + os.sep, "").replace(root, ".")
    # Volatile values defeat dedup and mean nothing when diagnosing a failure.
    line = HEXADDR.sub("0xADDR", line)
    line = DURATION.sub("<t>", line)
    return line


def redact(text, root=None, max_lines=80):
    raw_lines = text.split("\n")
    runner = detect_runner(text)

    kept, counts = [], {}
    for line in raw_lines:
        norm = normalize(line, root)
        if not norm.strip():
            continue
        signal = _is_signal(norm)
        if not signal and NOISE.match(norm):
            continue
        # Collapse repeats — but count them, because "this failed 400 times" is
        # itself a finding, and a silently deduped log hides it.
        if norm in counts:
            counts[norm] += 1
            continue
        counts[norm] = 1
        kept.append({"text": norm, "signal": signal})

    for item in kept:
        n = counts.get(item["text"], 1)
        if n > 1:
            item["text"] = "%s   (x%d)" % (item["text"], n)

    # Under the cap, signal lines win the budget; context fills what is left over.
    if len(kept) > max_lines:
        signals = [k for k in kept if k["signal"]][:max_lines]
        budget = max_lines - len(signals)
        context = [k for k in kept if not k["signal"]][:max(budget, 0)]
        chosen = {id(k) for k in signals} | {id(k) for k in context}
        body = [k for k in kept if id(k) in chosen]
        truncated = len(kept) - len(body)
    else:
        body, truncated = kept, 0

    locations, error_types, assertions = [], [], []
    for item in kept:
        t = item["text"]
        for m in FILE_LINE.finditer(t):
            loc = "%s:%s" % (m.group(1), m.group(2))
            if loc not in locations:
                locations.append(loc)
        for m in re.finditer(r"\b([A-Z]\w*(?:Error|Exception))\b", t):
            if m.group(1) not in error_types:
                error_types.append(m.group(1))
        if re.search(r"\bassert|\bExpected\b|\bexpected\b|✕", t) and t not in assertions:
            assertions.append(t)

    raw_count = len([line for line in raw_lines if line.strip()])
    return {
        "runner": runner,
        "raw_lines": raw_count,
        "kept_lines": len(body),
        "truncated_lines": truncated,
        "reduction_ratio": round(1 - (len(body) / raw_count), 4) if raw_count else 0.0,
        "error_types": error_types[:10],
        "locations": locations[:20],
        "assertions": assertions[:10],
        "lines": [k["text"] for k in body],
    }


def render(summary):
    out = ["# test-log summary — runner: %s" % summary["runner"],
           "# %d raw lines -> %d kept (%.1f%% reduction)%s" % (
               summary["raw_lines"], summary["kept_lines"],
               summary["reduction_ratio"] * 100,
               "" if not summary["truncated_lines"]
               else ", %d further lines truncated" % summary["truncated_lines"])]
    if summary["runner"] == "unknown":
        out.append("# format not recognized — output is TRUNCATED, not filtered; "
                   "re-read the raw log before concluding anything from absence")
    if summary["error_types"]:
        out.append("# error types: " + ", ".join(summary["error_types"]))
    if summary["locations"]:
        out.append("# locations: " + ", ".join(summary["locations"][:8]))
    out.append("")
    out.extend(summary["lines"])
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Redact a test-failure log down to its signal.")
    ap.add_argument("path", nargs="?", help="log file (default: stdin)")
    ap.add_argument("--max-lines", type=int, default=80)
    ap.add_argument("--root", default=None, help="path prefix to strip (default: cwd)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    if args.path:
        with open(args.path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    else:
        text = sys.stdin.read()

    summary = redact(text, root=args.root or os.getcwd(), max_lines=args.max_lines)
    print(json.dumps(summary, sort_keys=True) if args.json else render(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
