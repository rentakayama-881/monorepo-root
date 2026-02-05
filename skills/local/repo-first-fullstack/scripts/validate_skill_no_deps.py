#!/usr/bin/env python3
"""
Minimal skill validator with no external dependencies.

Validates:
- SKILL.md exists and has YAML-ish frontmatter
- frontmatter contains only name/description (simple key: value form)
- name/description follow basic constraints (length, characters)
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


MAX_SKILL_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024


def parse_frontmatter(text: str) -> dict[str, str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    block = text[4:end]
    data: dict[str, str] = {}
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        m = re.match(r"^([a-zA-Z0-9_-]+):\s*(.*)$", line)
        if not m:
            return None
        key, value = m.group(1), m.group(2)
        data[key] = value.strip()
    return data


def validate_name(name: str) -> str | None:
    n = name.strip()
    if not n:
        return "Missing name"
    if len(n) > MAX_SKILL_NAME_LENGTH:
        return f"Name too long ({len(n)} > {MAX_SKILL_NAME_LENGTH})"
    if not re.match(r"^[a-z0-9-]+$", n):
        return "Name must be hyphen-case (lowercase letters, digits, hyphens)"
    if n.startswith("-") or n.endswith("-") or "--" in n:
        return "Name cannot start/end with '-' or contain '--'"
    return None


def validate_description(description: str) -> str | None:
    d = description.strip()
    if not d:
        return "Missing description"
    if len(d) > MAX_DESCRIPTION_LENGTH:
        return f"Description too long ({len(d)} > {MAX_DESCRIPTION_LENGTH})"
    if "<" in d or ">" in d:
        return "Description cannot contain angle brackets (< or >)"
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a skill folder (no deps).")
    parser.add_argument("skill_dir", nargs="?", default=".", help="Path to skill directory (default: .).")
    args = parser.parse_args()

    skill_dir = Path(args.skill_dir).resolve()
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        print("ERROR: SKILL.md not found")
        return 1

    content = skill_md.read_text(encoding="utf-8")
    frontmatter = parse_frontmatter(content)
    if frontmatter is None:
        print("ERROR: invalid frontmatter (expected --- ... ---)")
        return 1

    allowed = {"name", "description"}
    unexpected = set(frontmatter.keys()) - allowed
    if unexpected:
        print(f"ERROR: unexpected frontmatter keys: {', '.join(sorted(unexpected))}")
        return 1

    if "name" not in frontmatter or "description" not in frontmatter:
        print("ERROR: frontmatter must include name and description")
        return 1

    err = validate_name(frontmatter["name"]) or validate_description(frontmatter["description"])
    if err:
        print(f"ERROR: {err}")
        return 1

    print("OK: skill looks valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
