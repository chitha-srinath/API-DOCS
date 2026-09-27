#!/usr/bin/env python3
"""AIDD dual-state repository index: structure + content hashes, no source text.

Why this exists: a role that must understand a repository has two bad options —
read everything (expensive, and most of it is irrelevant) or guess (wrong). This
builds the third option: a compact map of *where every symbol lives*, so a role
reads structure first and then pulls only the spans it actually needs
(`aidd-read-block.py`).

Dual-state means every entry carries both halves:
  * structure  — the symbols a parser found, with their line spans
  * content    — the git blob hash of the file those spans came from

The hash is what makes the index trustworthy. A span is only valid for the exact
bytes it was parsed from, so a consumer compares hashes before believing a span,
and a rebuild reparses only files whose hash moved. Structure without the hash is
a cache with no invalidation story.

Zero hard dependencies (ADR 002): bash + git + python3 stdlib. Tree-sitter is used
when it is importable and never required — see `_symbols()`. A file no parser
understands still gets a path-and-hash entry, because knowing a file exists and
knowing whether it changed is useful even when its structure is opaque.

Usage:
  aidd-index.py                           # full build (reuses unchanged entries)
  aidd-index.py --force                   # reparse everything
  aidd-index.py --file a.py --file b.go   # reparse just these, merge into the index
  aidd-index.py --check                   # exit 3 if any indexed file is stale; write nothing
  aidd-index.py --stats                   # machine-readable summary on stdout
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

INDEX_VERSION = 1
MAX_PARSE_BYTES = 2 * 1024 * 1024  # beyond this, path+hash only: parsing costs more than it returns
MAX_SIG_CHARS = 160

# ── language detection ──────────────────────────────────────────────────────
EXT_LANG = {
    ".py": "python", ".pyi": "python",
    ".js": "jsts", ".mjs": "jsts", ".cjs": "jsts", ".jsx": "jsts",
    ".ts": "jsts", ".mts": "jsts", ".cts": "jsts", ".tsx": "jsts",
    ".go": "go", ".rs": "rust", ".java": "java",
    ".kt": "kotlin", ".kts": "kotlin", ".swift": "swift", ".scala": "scala",
    ".c": "cfamily", ".h": "cfamily", ".cc": "cfamily", ".cpp": "cfamily",
    ".cxx": "cfamily", ".hpp": "cfamily", ".hh": "cfamily",
    ".cs": "cfamily", ".php": "php", ".rb": "ruby", ".dart": "cfamily",
    ".sh": "shell", ".bash": "shell",
}

# Comment markers per language family, used only to avoid counting braces inside
# comments. Not a lexer — see _BraceScanner.
LINE_COMMENT = {
    "jsts": ("//",), "go": ("//",), "rust": ("//",), "java": ("//",),
    "kotlin": ("//",), "swift": ("//",), "scala": ("//",), "cfamily": ("//",),
    "php": ("//", "#"), "shell": ("#",), "ruby": ("#",), "python": ("#",),
}

# ── symbol declaration patterns ─────────────────────────────────────────────
# Deliberately conservative: a missed symbol degrades to "read the file", while a
# bogus symbol sends a reader to the wrong lines. Prefer under-matching.
PATTERNS = {
    "python": [
        (re.compile(r"^(?P<indent>\s*)class\s+(?P<name>\w+)"), "class"),
        (re.compile(r"^(?P<indent>\s*)(?:async\s+)?def\s+(?P<name>\w+)"), "function"),
    ],
    "jsts": [
        (re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(?P<name>\w+)"), "class"),
        (re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(?P<name>\w+)"), "function"),
        (re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+(?P<name>\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>"), "function"),
        (re.compile(r"^\s*(?:export\s+)?(?:type|interface)\s+(?P<name>\w+)"), "type"),
    ],
    "go": [
        (re.compile(r"^func\s+(?:\([^)]*\)\s*)?(?P<name>\w+)"), "function"),
        (re.compile(r"^type\s+(?P<name>\w+)"), "type"),
    ],
    "rust": [
        (re.compile(r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(?P<name>\w+)"), "function"),
        (re.compile(r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|union)\s+(?P<name>\w+)"), "type"),
        (re.compile(r"^\s*impl(?:<[^>]*>)?\s+(?P<name>[\w:<>, ]+?)\s*\{"), "impl"),
    ],
    "java": [
        (re.compile(r"^\s*(?:public|protected|private|abstract|final|static|\s)*\s*(?:class|interface|enum|record)\s+(?P<name>\w+)"), "class"),
        (re.compile(r"^\s{2,}(?:public|protected|private|static|final|synchronized|abstract|\s)+[\w<>\[\],.?]+\s+(?P<name>\w+)\s*\([^;]*$"), "method"),
    ],
    "kotlin": [
        (re.compile(r"^\s*(?:public|internal|private|open|abstract|sealed|data|\s)*(?:class|interface|object)\s+(?P<name>\w+)"), "class"),
        (re.compile(r"^\s*(?:public|internal|private|override|suspend|inline|\s)*fun\s+(?:<[^>]*>\s*)?(?P<name>\w+)"), "function"),
    ],
    "swift": [
        (re.compile(r"^\s*(?:public|private|internal|open|final|\s)*(?:class|struct|enum|protocol|extension|actor)\s+(?P<name>\w+)"), "type"),
        (re.compile(r"^\s*(?:public|private|internal|static|override|\s)*func\s+(?P<name>\w+)"), "function"),
    ],
    "scala": [
        (re.compile(r"^\s*(?:private|protected|final|sealed|abstract|case|\s)*(?:class|trait|object)\s+(?P<name>\w+)"), "class"),
        (re.compile(r"^\s*(?:private|protected|override|final|\s)*def\s+(?P<name>\w+)"), "function"),
    ],
    "cfamily": [
        (re.compile(r"^\s*(?:public|private|protected|internal|abstract|sealed|static|partial|\s)*(?:class|struct|enum|interface|namespace)\s+(?P<name>\w+)"), "type"),
        (re.compile(r"^[\w:<>*&\[\]~ ]+?\b(?P<name>[A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const\s*)?(?:noexcept\s*)?\{?\s*$"), "function"),
    ],
    "php": [
        (re.compile(r"^\s*(?:abstract\s+|final\s+)?(?:class|interface|trait|enum)\s+(?P<name>\w+)"), "class"),
        (re.compile(r"^\s*(?:public|private|protected|static|abstract|final|\s)*function\s+(?P<name>\w+)"), "function"),
    ],
    "ruby": [
        (re.compile(r"^(?P<indent>\s*)(?:class|module)\s+(?P<name>[\w:]+)"), "class"),
        (re.compile(r"^(?P<indent>\s*)def\s+(?P<name>[\w.?!=]+)"), "function"),
    ],
    "shell": [
        (re.compile(r"^\s*(?:function\s+)?(?P<name>[A-Za-z_][\w:.-]*)\s*\(\s*\)\s*\{"), "function"),
    ],
}

INDENT_LANGS = {"python", "ruby"}
NOT_A_NAME = {"if", "for", "while", "switch", "catch", "return", "else", "do"}


def git(root, *args):
    """Run a git command in `root`; return stdout, or None when git fails."""
    try:
        out = subprocess.run(("git", "-C", root) + args, capture_output=True, text=True, check=False)
    except OSError:
        return None
    return out.stdout if out.returncode == 0 else None


def blob_hash(data):
    """The git blob object id for `data` — identical to `git hash-object`.

    Computed in-process rather than shelling out per file: a subprocess per file
    dominates the runtime of a full index on any real repository.
    """
    h = hashlib.sha1()
    h.update(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest()


class _BraceScanner:
    """Brace-depth tracker that ignores braces inside strings and comments.

    Not a lexer, and it does not need to be: it is only ever asked "where does
    this declaration's block end", and it fails toward a *shorter* span, which a
    reader notices immediately. A full parse is what tree-sitter is for.
    """

    def __init__(self, lang):
        self.line_markers = LINE_COMMENT.get(lang, ())
        self.depth = 0
        self.in_block_comment = False
        self.opened = False

    def feed(self, line):
        i, n = 0, len(line)
        while i < n:
            ch = line[i]
            if self.in_block_comment:
                if ch == "*" and i + 1 < n and line[i + 1] == "/":
                    self.in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if ch == "/" and i + 1 < n and line[i + 1] == "*":
                self.in_block_comment = True
                i += 2
                continue
            if any(line.startswith(m, i) for m in self.line_markers):
                return
            if ch in "\"'`":
                quote, i = ch, i + 1
                while i < n:
                    if line[i] == "\\":
                        i += 2
                        continue
                    if line[i] == quote:
                        i += 1
                        break
                    i += 1
                continue
            if ch == "{":
                self.depth += 1
                self.opened = True
            elif ch == "}":
                self.depth -= 1
            i += 1

    @property
    def closed(self):
        return self.opened and self.depth <= 0


def _end_by_braces(lines, start, lang, limit=4000):
    """End line (1-based, inclusive) of a brace-delimited block starting at `start`."""
    scanner = _BraceScanner(lang)
    for offset in range(min(limit, len(lines) - start)):
        scanner.feed(lines[start + offset])
        if scanner.closed:
            return start + offset + 1
        # A declaration whose brace has not opened within a few lines is a
        # signature-only declaration (interface method, forward declaration).
        if offset >= 8 and not scanner.opened:
            return start + 1
    return start + 1


def _end_by_indent(lines, start, indent, lang):
    """End line (1-based, inclusive) of an indentation-delimited block."""
    if lang == "ruby":
        # Ruby closes with `end` at the declaration's own indent.
        for i in range(start + 1, len(lines)):
            if lines[i].strip() == "end" and (len(lines[i]) - len(lines[i].lstrip())) == indent:
                return i + 1
        return start + 1
    last = start
    for i in range(start + 1, len(lines)):
        line = lines[i]
        if not line.strip():
            continue
        if (len(line) - len(line.lstrip())) <= indent:
            break
        last = i
    return last + 1


def _symbols_regex(text, lang):
    """Extract declarations with spans using the per-language patterns."""
    patterns = PATTERNS.get(lang)
    if not patterns:
        return []
    lines = text.split("\n")
    found = []
    for idx, line in enumerate(lines):
        for rx, kind in patterns:
            m = rx.match(line)
            if not m:
                continue
            name = m.group("name").strip()
            if not name or name in NOT_A_NAME:
                continue
            if lang in INDENT_LANGS:
                indent = len(m.group("indent")) if "indent" in m.groupdict() else 0
                end = _end_by_indent(lines, idx, indent, lang)
            else:
                end = _end_by_braces(lines, idx, lang)
            found.append({
                "name": name,
                "kind": kind,
                "start": idx + 1,
                "end": end,
                "signature": line.strip()[:MAX_SIG_CHARS],
            })
            break  # one declaration per line
    return found


def _symbols_treesitter(text, lang):
    """Tree-sitter extraction when the library and grammar are both importable.

    Returns None when unavailable, which is the normal case — the caller then
    uses the regex extractor. Tree-sitter is an accelerator here, never a
    requirement, because ADR 002 forbids hard third-party dependencies.
    """
    try:
        import tree_sitter_languages  # noqa: PLC0415 - optional accelerator, probed at call time
    except Exception:
        return None
    ts_name = {"jsts": "typescript", "cfamily": "cpp"}.get(lang, lang)
    try:
        parser = tree_sitter_languages.get_parser(ts_name)
        tree = parser.parse(text.encode("utf-8", "replace"))
    except Exception:
        return None
    wanted = {
        "function_definition": "function", "function_declaration": "function",
        "method_definition": "method", "method_declaration": "method",
        "class_definition": "class", "class_declaration": "class",
        "struct_item": "type", "enum_item": "type", "trait_item": "type",
        "function_item": "function", "type_declaration": "type",
        "interface_declaration": "type",
    }
    src_lines = text.split("\n")
    found, stack = [], [tree.root_node]
    while stack:
        node = stack.pop()
        kind = wanted.get(node.type)
        if kind:
            name_node = node.child_by_field_name("name")
            if name_node is not None:
                found.append({
                    "name": name_node.text.decode("utf-8", "replace"),
                    "kind": kind,
                    "start": node.start_point[0] + 1,
                    "end": node.end_point[0] + 1,
                    "signature": src_lines[node.start_point[0]].strip()[:MAX_SIG_CHARS],
                })
        stack.extend(node.children)
    found.sort(key=lambda s: (s["start"], s["name"]))
    return found


def _symbols(text, lang):
    """Symbols plus the name of the parser that produced them."""
    if lang == "unknown":
        return [], "none"
    ts = _symbols_treesitter(text, lang)
    if ts is not None:
        return ts, "tree-sitter"
    return _symbols_regex(text, lang), "regex"


def index_file(root, rel):
    """Index one file. Never raises: an unreadable file yields None, not a crash."""
    path = os.path.join(root, rel)
    try:
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError:
        return None
    entry = {"hash": blob_hash(data), "lang": "unknown", "lines": 0, "symbols": []}
    if b"\0" in data[:8000]:
        entry["lang"] = "binary"
        return entry
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        entry["lang"] = "binary"
        return entry
    lang = EXT_LANG.get(os.path.splitext(rel)[1].lower(), "unknown")
    entry["lines"] = text.count("\n") + (1 if text and not text.endswith("\n") else 0)
    entry["lang"] = lang
    if len(data) > MAX_PARSE_BYTES or lang == "unknown":
        # Path-and-hash-only degradation: explicit, and still useful for staleness.
        return entry
    entry["symbols"], entry["parser"] = _symbols(text, lang)
    return entry


def tracked_files(root):
    out = git(root, "ls-files", "-z")
    if out is None:
        return []
    return [p for p in out.split("\0") if p]


def load_index(path):
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and data.get("version") == INDEX_VERSION else None


def build(root, out_path, only=None, force=False):
    """Build or refresh the index. Returns (index, stats)."""
    previous = load_index(out_path) or {}
    prev_files = {} if force else previous.get("files", {})
    targets = only if only else tracked_files(root)
    # A targeted rebuild merges into what is already there; a full rebuild replaces it,
    # so a deleted file cannot survive as a phantom entry.
    files = dict(previous.get("files", {})) if only else {}
    parsed = reused = removed = 0

    if not only:
        tracked = set(targets)
        removed = len([p for p in prev_files if p not in tracked])

    for rel in targets:
        full = os.path.join(root, rel)
        if not os.path.exists(full):
            if files.pop(rel, None) is not None:
                removed += 1
            continue
        prior = prev_files.get(rel)
        if prior and not force:
            try:
                with open(full, "rb") as fh:
                    current = blob_hash(fh.read())
            except OSError:
                current = None
            if current is not None and current == prior.get("hash"):
                files[rel] = prior          # hash short-circuit: no reparse
                reused += 1
                continue
        entry = index_file(root, rel)
        if entry is None:
            files.pop(rel, None)
            continue
        files[rel] = entry
        parsed += 1

    parsers = {e.get("parser") for e in files.values() if e.get("parser")}
    index = {
        "version": INDEX_VERSION,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "head": (git(root, "rev-parse", "HEAD") or "none").strip(),
        "hash_algo": "git-blob-sha1",
        "parser": "tree-sitter" if "tree-sitter" in parsers else "regex",
        "files": files,
    }
    stats = {
        "files": len(files),
        "symbols": sum(len(e["symbols"]) for e in files.values()),
        "parsed": parsed,
        "reused": reused,
        "removed": removed,
    }
    return index, stats


def stale_files(root, index):
    """Indexed paths whose on-disk bytes no longer match the recorded hash."""
    stale = []
    for rel, entry in index.get("files", {}).items():
        try:
            with open(os.path.join(root, rel), "rb") as fh:
                current = blob_hash(fh.read())
        except OSError:
            stale.append(rel)
            continue
        if current != entry.get("hash"):
            stale.append(rel)
    return sorted(stale)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build the AIDD dual-state repository index.")
    ap.add_argument("--root", default=None, help="repo root (default: git toplevel)")
    ap.add_argument("--out", default=None, help="index path (default: <root>/.aidd/context/index.json)")
    ap.add_argument("--file", action="append", dest="files", help="reparse only this path (repeatable)")
    ap.add_argument("--force", action="store_true", help="reparse every file")
    ap.add_argument("--check", action="store_true", help="report stale files; write nothing; exit 3 if stale")
    ap.add_argument("--stats", action="store_true", help="emit the summary as JSON")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    root = args.root or (git(os.getcwd(), "rev-parse", "--show-toplevel") or "").strip()
    if not root:
        print("aidd-index: not a git repository", file=sys.stderr)
        return 1
    root = os.path.abspath(root)
    out_path = args.out or os.path.join(root, ".aidd", "context", "index.json")

    if args.check:
        index = load_index(out_path)
        if index is None:
            print("aidd-index: no readable index at %s" % out_path, file=sys.stderr)
            return 2
        stale = stale_files(root, index)
        for rel in stale:
            print(rel)
        return 3 if stale else 0

    index, stats = build(root, out_path, only=args.files, force=args.force)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(index, fh, separators=(",", ":"), sort_keys=True)
    os.replace(tmp, out_path)  # atomic: a reader never sees a half-written index

    stats["bytes"] = os.path.getsize(out_path)
    stats["parser"] = index["parser"]
    if args.stats:
        print(json.dumps(stats, sort_keys=True))
    elif not args.quiet:
        print("index: %(files)d files, %(symbols)d symbols, %(parsed)d parsed, "
              "%(reused)d reused, %(bytes)d bytes (%(parser)s)" % stats)
    return 0


if __name__ == "__main__":
    sys.exit(main())
