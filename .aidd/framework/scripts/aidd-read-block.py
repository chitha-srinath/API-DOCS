#!/usr/bin/env python3
"""Just-in-time context: return one symbol, not the file that contains it.

The read a role actually needs is almost never "the whole file". It is one
function plus enough type context to judge it. This resolves a symbol through the
dual-state index (`aidd-index.py`) and prints exactly that span, so a 1,000-line
service file costs ~40 lines of context instead of all of it.

Freshness is not assumed. The index records the git blob hash of the bytes each
span was parsed from; this compares that hash against the file on disk before
serving, and reparses *only that file* when they differ. Serving a stale span
would be worse than serving nothing: the reader would cite lines that had moved.

Usage:
  aidd-read-block.py <file> <symbol>        # the symbol's span + its direct type deps
  aidd-read-block.py <file> --line 240      # the symbol enclosing line 240
  aidd-read-block.py <file> --list          # symbols in the file, with spans
  aidd-read-block.py <file> <symbol> --json # machine-readable

Exit codes: 0 served · 1 no repo · 4 file not indexed · 5 symbol not found
"""

import argparse
import importlib.util
import json
import os
import re
import sys


def _load_indexer():
    """Import the sibling indexer, whose filename is not a valid module name."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aidd-index.py")
    spec = importlib.util.spec_from_file_location("aidd_index", path)
    if spec is None or spec.loader is None:
        raise ImportError("aidd-read-block: cannot load %s" % path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


IX = _load_indexer()

IDENT = re.compile(r"[A-Za-z_]\w*")
MAX_DEPS = 5
DEP_STOPWORDS = {
    "def", "class", "function", "func", "fn", "return", "self", "cls", "const",
    "let", "var", "public", "private", "protected", "static", "async", "await",
    "export", "default", "new", "this", "int", "str", "bool", "float", "void",
    "string", "number", "boolean", "any", "None", "true", "false", "null",
}


def write_index(index, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(index, fh, separators=(",", ":"), sort_keys=True)
    os.replace(tmp, path)


def load_or_build(root, index_path):
    """Return the index, building it once if it is missing or unreadable."""
    index = IX.load_index(index_path)
    if index is None:
        index, _ = IX.build(root, index_path)
        write_index(index, index_path)
    return index


def refresh_if_stale(root, index, index_path, rel):
    """Reparse `rel` only when its on-disk bytes no longer match the index.

    Returns (entry, refreshed). A stale entry is never served.
    """
    entry = index.get("files", {}).get(rel)
    try:
        with open(os.path.join(root, rel), "rb") as fh:
            current = IX.blob_hash(fh.read())
    except OSError:
        return entry, False
    if entry is not None and entry.get("hash") == current:
        return entry, False
    fresh, _ = IX.build(root, index_path, only=[rel])
    write_index(fresh, index_path)
    index["files"] = fresh["files"]
    return fresh["files"].get(rel), True


def direct_deps(index, symbol):
    """Identifiers in the symbol's signature that are themselves indexed symbols.

    Deliberately signature-scoped, not body-scoped: the point is the type context
    needed to judge the span. Pulling every identifier in the body would
    reintroduce exactly the bloat this command exists to avoid.
    """
    wanted = {n for n in IDENT.findall(symbol.get("signature", ""))
              if n not in DEP_STOPWORDS and n != symbol["name"]}
    deps = []
    for rel, fentry in sorted(index.get("files", {}).items()):
        for cand in fentry.get("symbols", []):
            if cand["name"] in wanted:
                deps.append({"name": cand["name"], "file": rel,
                             "start": cand["start"], "signature": cand["signature"]})
                wanted.discard(cand["name"])
                if len(deps) >= MAX_DEPS:
                    return deps
    return deps


def main(argv=None):
    ap = argparse.ArgumentParser(description="Read one symbol's span via the AIDD index.")
    ap.add_argument("file")
    ap.add_argument("symbol", nargs="?")
    ap.add_argument("--line", type=int, help="return the symbol enclosing this line")
    ap.add_argument("--list", action="store_true", help="list the file's symbols and exit")
    ap.add_argument("--no-deps", action="store_true", help="omit direct type dependencies")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--root", default=None)
    args = ap.parse_args(argv)

    root = args.root or (IX.git(os.getcwd(), "rev-parse", "--show-toplevel") or "").strip()
    if not root:
        print("aidd-read-block: not a git repository", file=sys.stderr)
        return 1
    root = os.path.abspath(root)
    index_path = os.path.join(root, ".aidd", "context", "index.json")
    index = load_or_build(root, index_path)

    rel = os.path.relpath(os.path.abspath(args.file), root)
    entry, refreshed = refresh_if_stale(root, index, index_path, rel)
    if entry is None:
        print("aidd-read-block: %s is not indexed (untracked?)" % rel, file=sys.stderr)
        return 4

    if args.list:
        for s in entry.get("symbols", []):
            print("%s\t%s\t%d-%d" % (s["kind"], s["name"], s["start"], s["end"]))
        return 0

    symbols = entry.get("symbols", [])
    target = None
    if args.symbol:
        # Innermost match wins: a method named like its class is the smaller span.
        matches = [s for s in symbols if s["name"] == args.symbol]
        if matches:
            target = min(matches, key=lambda s: s["end"] - s["start"])
    elif args.line:
        enclosing = [s for s in symbols if s["start"] <= args.line <= s["end"]]
        if enclosing:
            target = min(enclosing, key=lambda s: s["end"] - s["start"])
    else:
        print("aidd-read-block: give a symbol name or --line", file=sys.stderr)
        return 5

    if target is None:
        what = args.symbol or ("line %d" % args.line)
        print("aidd-read-block: no symbol %s in %s (try --list)" % (what, rel), file=sys.stderr)
        return 5

    with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as fh:
        lines = fh.read().split("\n")
    span = lines[target["start"] - 1:target["end"]]
    deps = [] if args.no_deps else direct_deps(index, target)

    if args.json:
        print(json.dumps({"file": rel, "symbol": target, "refreshed": refreshed,
                          "source": "\n".join(span), "deps": deps}, sort_keys=True))
        return 0

    print("# %s:%d-%d  %s %s%s" % (rel, target["start"], target["end"],
                                   target["kind"], target["name"],
                                   "  (index refreshed)" if refreshed else ""))
    for offset, text in enumerate(span):
        print("%5d  %s" % (target["start"] + offset, text))
    if deps:
        print("")
        print("# direct type dependencies (signatures only)")
        for d in deps:
            print("#   %s:%d  %s" % (d["file"], d["start"], d["signature"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
