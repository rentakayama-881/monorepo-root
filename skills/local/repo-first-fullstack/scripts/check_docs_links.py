#!/usr/bin/env python3
"""
Find broken relative markdown links to repo files.

This is a fast, deterministic helper for STALENESS REPORT evidence.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
from pathlib import Path


LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def detect_git_root(start: Path) -> Path:
    if shutil.which("git") is None:
        return start.resolve()
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            text=True,
            capture_output=True,
            check=True,
        )
        root = (result.stdout or "").strip()
        return Path(root) if root else start.resolve()
    except subprocess.CalledProcessError:
        return start.resolve()


def iter_markdown_files(root: Path) -> list[Path]:
    excluded_dirs = {".git", "node_modules", "bin", "obj", ".next"}
    files: list[Path] = []
    for path in root.rglob("*.md"):
        if any(part in excluded_dirs for part in path.parts):
            continue
        files.append(path)
    return sorted(files)


def normalize_target(raw: str) -> str | None:
    target = raw.strip().strip('"').strip("'")
    if not target or target.startswith("#"):
        return None
    if re.match(r"^[a-z]+://", target) or target.startswith("mailto:") or target.startswith("tel:"):
        return None
    # Strip anchors and query strings.
    target = target.split("#", 1)[0].split("?", 1)[0].strip()
    return target or None


def resolve_target(doc: Path, target: str, repo_root: Path) -> Path:
    if target.startswith("/"):
        return (repo_root / target.lstrip("/")).resolve()
    return (doc.parent / target).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan markdown files for broken relative links.")
    parser.add_argument("--root", default=".", help="Root directory to scan (default: git toplevel if available).")
    args = parser.parse_args()

    root = detect_git_root(Path(args.root))
    md_files = iter_markdown_files(root)

    broken: list[tuple[Path, str, Path]] = []
    for doc in md_files:
        try:
            content = doc.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for raw in LINK_RE.findall(content):
            target = normalize_target(raw)
            if target is None:
                continue
            resolved = resolve_target(doc, target, root)
            if not resolved.exists():
                broken.append((doc, target, resolved))

    if not broken:
        print("OK: no broken relative markdown links found.")
        return 0

    print(f"Broken links: {len(broken)}")
    for doc, target, resolved in broken:
        rel_doc = doc.relative_to(root)
        try:
            rel_resolved = resolved.relative_to(root)
            resolved_display = f"./{rel_resolved}"
        except ValueError:
            resolved_display = str(resolved)
        print(f"- {rel_doc}: ({target}) -> {resolved_display} [MISSING]")

    return 1


if __name__ == "__main__":
    raise SystemExit(main())

