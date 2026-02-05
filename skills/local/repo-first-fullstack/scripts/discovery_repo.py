#!/usr/bin/env python3
"""
Generate an evidence ledger for repo-first work.

Runs a set of safe, read-only discovery commands and writes a markdown report.

Defaults:
- Root: git toplevel (if available), else current directory
- Output: /tmp/evidence-ledger.md
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import shlex
import shutil
import subprocess
from pathlib import Path
from typing import Iterable, Optional


REDACTION_RULES: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"(?i)\b(authorization)\s*:\s*bearer\s+([^\s]+)"),
        r"\1: Bearer [REDACTED]",
    ),
    (re.compile(r"\bBearer\s+[A-Za-z0-9._-]+\b"), "Bearer [REDACTED]"),
    (
        re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
        "[REDACTED_JWT]",
    ),
    (
        re.compile(
            r"(?i)\b(password|passwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[:=]\s*([^\s\"']+)"
        ),
        r"\1=[REDACTED]",
    ),
]


def redact(text: str) -> str:
    redacted = text
    for pattern, replacement in REDACTION_RULES:
        redacted = pattern.sub(replacement, redacted)
    return redacted


def truncate_lines(text: str, max_lines: int) -> tuple[str, bool]:
    if max_lines <= 0:
        return "", True
    lines = text.splitlines()
    if len(lines) <= max_lines:
        return text, False
    return "\n".join(lines[:max_lines]) + "\n…(truncated)…", True


def run(cmd: str, cwd: Path, timeout_s: int) -> dict:
    result = subprocess.run(
        ["bash", "-lc", cmd],
        cwd=str(cwd),
        text=True,
        capture_output=True,
        timeout=timeout_s,
    )
    stdout = redact(result.stdout or "")
    stderr = redact(result.stderr or "")
    return {
        "cmd": cmd,
        "cwd": str(cwd),
        "code": result.returncode,
        "stdout": stdout,
        "stderr": stderr,
    }


def command_block(entry: dict, max_lines: int) -> str:
    stdout, stdout_truncated = truncate_lines(entry["stdout"], max_lines)
    stderr, stderr_truncated = truncate_lines(entry["stderr"], max_lines)

    parts = [
        f"### `{entry['cmd']}`",
        "",
        f"- cwd: `{entry['cwd']}`",
        f"- exit: `{entry['code']}`",
        "",
    ]

    if stdout.strip():
        parts.extend(["**stdout**", "```text", stdout.rstrip(), "```", ""])
    if stderr.strip():
        parts.extend(["**stderr**", "```text", stderr.rstrip(), "```", ""])
    if stdout_truncated or stderr_truncated:
        parts.append("> Note: output truncated for readability.")
        parts.append("")

    return "\n".join(parts)


def detect_git_root() -> Optional[Path]:
    if shutil.which("git") is None:
        return None
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            text=True,
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError:
        return None
    root = (result.stdout or "").strip()
    return Path(root) if root else None


def rg_cmd(pattern: str, path: str = ".", max_matches: int = 200) -> str:
    if shutil.which("rg") is not None:
        globs = [
            "--glob",
            "!.env*",
            "--glob",
            "!**/*.pem",
            "--glob",
            "!**/*.key",
            "--glob",
            "!**/*.pfx",
        ]
        glob_flags = " ".join(shlex.quote(item) for item in globs)
        return f"rg -n --max-count {max_matches} {glob_flags} {shlex.quote(pattern)} {shlex.quote(path)} || true"

    if shutil.which("git") is not None:
        # Fast fallback inside git repos; avoids crawling large ignored dirs.
        return f"git grep -n -E -- {shlex.quote(pattern)} -- {shlex.quote(path)} || true"

    escaped = pattern.replace('"', '\\"')
    return f'grep -RIn -- "{escaped}" {shlex.quote(path)} || true'


def build_commands(root: Path, include_runtime: bool, rg_max_matches: int) -> list[str]:
    frontend_dir = "frontend" if (root / "frontend").is_dir() else "."
    backend_dir = "backend" if (root / "backend").is_dir() else "."
    feature_dir = "feature-service" if (root / "feature-service").is_dir() else "."

    commands = [
        "pwd",
        "ls -lah",
        "git status",
        "git rev-parse --abbrev-ref HEAD",
        "git log -1 --oneline",
        # Entry points (do not assume locations).
        r'find . -maxdepth 4 -type f \( -name "package.json" -o -name "go.mod" -o -name "*.csproj" -o -name "Program.cs" -o -name "main.go" \) '
        r'-not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/bin/*" -not -path "*/obj/*" -not -path "*/.next/*"',
        # Frontend config file discovery (evidence without relying on docs).
        rf'find {shlex.quote(frontend_dir)} -maxdepth 6 -type f \( -name "next.config.*" -o -name "tailwind.config.*" -o -name "postcss.config.*" -o -name "globals.css" -o -path "*/app/layout.*" -o -path "*/app/page.*" \) '
        r'-not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" || true',
        rg_cmd(
            r"next\.config\.(js|mjs|ts)|next-env\.d\.ts|next/(navigation|link|image)",
            frontend_dir,
            rg_max_matches,
        ),
        rg_cmd(
            r"tailwind\.config\.(js|cjs|mjs|ts)|@tailwind|globals\.css|ThemeProvider|Providers|oklch\(|--(foreground|background|ring)|--color-",
            frontend_dir,
            rg_max_matches,
        ),
        rg_cmd(r"github\.com/gin-gonic/gin|gin\.Default\(|gin\.New\(|router\.Group\(", backend_dir, rg_max_matches),
        rg_cmd(r"MapControllers|AddControllers|WebApplication\.CreateBuilder|UseRouting", feature_dir, rg_max_matches),
        rg_cmd(r"fetch\(|axios|ky\(|baseURL|API_URL|NEXT_PUBLIC|FEATURE", frontend_dir, rg_max_matches),
    ]

    if include_runtime:
        commands.extend(
            [
                "command -v systemctl >/dev/null && systemctl list-units --type=service | rg -i 'nginx|backend|feature|api' || true",
                "command -v journalctl >/dev/null && journalctl -u nginx -n 100 --no-pager -o cat || true",
                "command -v journalctl >/dev/null && journalctl -u backend -n 200 --no-pager -o cat || true",
                "command -v journalctl >/dev/null && journalctl -u feature-service -n 200 --no-pager -o cat || true",
                "command -v docker >/dev/null && docker ps --format \"table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}\" || true",
            ]
        )

    return commands


def write_report(
    output_path: Path,
    root: Path,
    entries: Iterable[dict],
    started_at: dt.datetime,
) -> None:
    timestamp = started_at.isoformat(timespec="seconds")
    header = [
        "# Evidence Ledger",
        "",
        f"- generated_at: `{timestamp}`",
        f"- root: `{root}`",
        "",
        "This report is auto-generated. Outputs are redacted and may be truncated.",
        "",
    ]

    body = []
    for entry in entries:
        body.append(command_block(entry, max_lines=200))

    output_path.write_text("\n".join(header + body), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a repo discovery evidence ledger.")
    parser.add_argument(
        "--root",
        default=".",
        help="Repo root to run discovery from (default: git toplevel if available, else cwd).",
    )
    parser.add_argument(
        "--out",
        default="/tmp/evidence-ledger.md",
        help="Output markdown path (default: /tmp/evidence-ledger.md).",
    )
    parser.add_argument(
        "--runtime",
        action="store_true",
        help="Attempt read-only runtime discovery (systemd/journalctl/docker) when available.",
    )
    parser.add_argument(
        "--timeout-s",
        type=int,
        default=30,
        help="Per-command timeout in seconds (default: 30).",
    )
    parser.add_argument(
        "--rg-max-matches",
        type=int,
        default=200,
        help="Max ripgrep matches per command (default: 200).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    git_root = detect_git_root()
    root = git_root or Path(args.root).resolve()

    started_at = dt.datetime.now(dt.timezone.utc)
    commands = build_commands(
        root=root,
        include_runtime=bool(args.runtime),
        rg_max_matches=int(args.rg_max_matches),
    )

    entries = []
    for cmd in commands:
        try:
            entries.append(run(cmd, cwd=root, timeout_s=int(args.timeout_s)))
        except subprocess.TimeoutExpired:
            entries.append(
                {
                    "cmd": cmd,
                    "cwd": str(root),
                    "code": 124,
                    "stdout": "",
                    "stderr": f"Timed out after {args.timeout_s}s",
                }
            )

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_report(output_path=out_path, root=root, entries=entries, started_at=started_at)

    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
