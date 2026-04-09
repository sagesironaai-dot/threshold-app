#!/usr/bin/env python3
"""
BASH SAFETY GATE — PreToolUse hook for Bash operations.

Soft warnings (exit 0) for risky but not forbidden commands.
Hard blocks (exit 2) are handled by permission deny rules in settings.json.

This hook handles the gray area:
  - git add . / git add -A  → warn (review staged files)
  - git commit --no-verify  → block (hooks must not be skipped)
  - git push (to main)      → warn (confirm intent)
  - npm install (fallthrough if deny rule didn't catch variant) → block

Enforces GITHUB_PROTOCOL.md §1 (commit scope, branch protection)
and CLAUDE.md (no --no-verify, no silent fixes).
"""

import json
import os
import re
import sys


def get_command():
    """Extract the Bash command from tool input."""
    tool_input = os.environ.get("CLAUDE_TOOL_INPUT", "")
    if not tool_input:
        return ""
    try:
        params = json.loads(tool_input)
        return params.get("command", "")
    except (json.JSONDecodeError, TypeError):
        return ""


def main():
    tool_name = os.environ.get("CLAUDE_TOOL_NAME", "")
    if tool_name != "Bash":
        sys.exit(0)

    command = get_command()
    if not command:
        sys.exit(0)

    # ── Hard blocks (exit 2) ─────────────────────────────────────────────

    # git commit --no-verify: hooks must not be skipped
    if re.search(r'git\s+commit\b.*--no-verify', command):
        sys.stderr.write(
            "\n  BASH SAFETY GATE — BLOCKED\n"
            "  Command contains --no-verify.\n"
            "  Hooks must not be skipped. Fix the hook failure instead.\n"
        )
        sys.exit(2)

    # git commit --no-gpg-sign (unless user explicitly requested)
    if re.search(r'git\s+commit\b.*--no-gpg-sign', command):
        sys.stderr.write(
            "\n  BASH SAFETY GATE — BLOCKED\n"
            "  Command contains --no-gpg-sign.\n"
            "  Do not bypass signing unless Sage explicitly requested it.\n"
        )
        sys.exit(2)

    # npm install fallthrough (catch variants deny rules might miss)
    if re.search(r'\bnpm\s+install\b', command) and 'npm ci' not in command:
        sys.stderr.write(
            "\n  BASH SAFETY GATE — BLOCKED\n"
            "  Use 'npm ci' instead of 'npm install'.\n"
            "  GITHUB_PROTOCOL.md §2: npm ci only.\n"
        )
        sys.exit(2)

    # ── Soft warnings (exit 0, stdout for context) ───────────────────────

    # git add . or git add -A: warn about blanket staging
    if re.search(r'git\s+add\s+(-A|\.)\s*($|[;&|])', command):
        print(
            "\n  BASH SAFETY WARNING: Blanket staging detected (git add . or -A).\n"
            "  GITHUB_PROTOCOL.md §1: Review git status before staging.\n"
            "  Prefer specific file staging where possible.\n"
        )
        # exit 0 — warning only, does not block
        sys.exit(0)

    # git push to main: warn
    if re.search(r'git\s+push\b', command) and ('main' in command or 'master' in command):
        print(
            "\n  BASH SAFETY WARNING: Pushing to main/master.\n"
            "  Confirm this is intended and all checks have passed.\n"
        )
        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
