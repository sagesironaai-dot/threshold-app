#!/usr/bin/env python3
"""
CLOSE AUDIT GATE — PreToolUse hook for Write and Edit operations.

Only fires when writing a TYPE: CLOSE entry to SESSION_LOG.md.
Two checks must pass:
  1. Session close audit marker exists (from entropy_scan.py --close-audit)
  2. No uncommitted project files in git (prevents plan-file-not-committed glitch)

The marker (.claude/close_audit_done.marker) is created by
entropy_scan.py --close-audit and consumed (deleted) by this hook
after a successful pass.

Enforces CLAUDE.md: "A session that closes without [audit] has not
closed cleanly."
Enforces SESSION_PROTOCOL.md §2: "Confirm all changes from this session
are committed."
"""

import json
import os
import subprocess
import sys


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIT_MARKER = os.path.join(PROJECT_ROOT, ".claude", "close_audit_done.marker")
SESSION_LOG_REL = "PROTOCOL/SESSION_LOG.md"


def get_relative_path(abs_path):
    try:
        return os.path.relpath(abs_path, PROJECT_ROOT).replace("\\", "/")
    except ValueError:
        return abs_path


def get_file_path_from_env():
    file_path = os.environ.get("CLAUDE_FILE_PATH", "")
    if file_path:
        return file_path
    tool_input = os.environ.get("CLAUDE_TOOL_INPUT", "")
    if tool_input:
        try:
            params = json.loads(tool_input)
            return params.get("file_path", "")
        except (json.JSONDecodeError, TypeError):
            pass
    return ""


IGNORE_PATTERNS = [
    ".claude/close_audit_done.marker",
    ".claude/pending_ghost_fix.marker",
]


def get_uncommitted_files():
    """Run git status and return list of uncommitted/untracked project files."""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=PROJECT_ROOT, timeout=10,
        )
        if result.returncode != 0:
            return []  # git not available or not a repo — don't block

        uncommitted = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            # git status --porcelain: first 2 chars are status, then space, then path
            file_path = line[3:].strip().strip('"')
            # Skip ignored patterns
            skip = False
            for pattern in IGNORE_PATTERNS:
                if file_path == pattern or file_path.replace("\\", "/") == pattern:
                    skip = True
                    break
            if not skip:
                uncommitted.append(file_path)
        return uncommitted
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return []  # git not available — don't block on infrastructure issues


def is_close_entry_write():
    """Check if the current Write/Edit contains TYPE: CLOSE."""
    tool_input = os.environ.get("CLAUDE_TOOL_INPUT", "")
    if not tool_input:
        return False
    try:
        params = json.loads(tool_input)
    except (json.JSONDecodeError, TypeError):
        return False

    # Check Write tool (content parameter)
    content = params.get("content", "")
    if "TYPE: CLOSE" in content:
        return True

    # Check Edit tool (new_string parameter)
    new_string = params.get("new_string", "")
    if "TYPE: CLOSE" in new_string:
        return True

    return False


def main():
    tool_name = os.environ.get("CLAUDE_TOOL_NAME", "")
    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    file_path = get_file_path_from_env()
    if not file_path:
        sys.exit(0)

    rel_path = get_relative_path(file_path)

    # Only fire on SESSION_LOG.md writes that contain TYPE: CLOSE
    if rel_path != SESSION_LOG_REL and rel_path != SESSION_LOG_REL.replace("/", "\\"):
        sys.exit(0)

    if not is_close_entry_write():
        sys.exit(0)

    # This IS a TYPE: CLOSE write — run both checks

    # CHECK 1: Audit marker
    if not os.path.exists(AUDIT_MARKER):
        msg = (
            f"\n{'='*60}\n"
            f"  CLOSE AUDIT GATE — BLOCKED\n"
            f"{'='*60}\n"
            f"  Reason: Session close audit not performed.\n"
            f"\n"
            f"  Before writing TYPE: CLOSE, you must:\n"
            f"  1. Run: python hooks/entropy_scan.py --close-audit\n"
            f"  2. Report findings to Sage\n"
            f"  3. Log any new rot in ROT_REGISTRY.md and ROT_OPEN.md\n"
            f"\n"
            f"  The audit creates a marker that this gate consumes.\n"
            f"  No marker = no close.\n"
            f"{'='*60}\n"
        )
        sys.stderr.write(msg)
        sys.exit(2)

    # CHECK 2: Git status — no uncommitted project files
    uncommitted = get_uncommitted_files()
    if uncommitted:
        file_list = "\n".join(f"    {f}" for f in uncommitted[:20])
        if len(uncommitted) > 20:
            file_list += f"\n    ... and {len(uncommitted) - 20} more"
        msg = (
            f"\n{'='*60}\n"
            f"  CLOSE AUDIT GATE — BLOCKED\n"
            f"{'='*60}\n"
            f"  Reason: Uncommitted files exist.\n"
            f"\n"
            f"  SESSION_PROTOCOL.md §2 requires all changes committed\n"
            f"  before session close. Uncommitted files:\n"
            f"\n{file_list}\n"
            f"\n"
            f"  Commit or explicitly exclude these files before closing.\n"
            f"{'='*60}\n"
        )
        sys.stderr.write(msg)
        sys.exit(2)

    # Both checks passed — consume the audit marker and allow
    try:
        os.remove(AUDIT_MARKER)
    except OSError:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
