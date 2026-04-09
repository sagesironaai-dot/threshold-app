#!/usr/bin/env python3
"""
SESSION END — SessionEnd hook.

Fires when a Claude Code session terminates. Logs a warning to
.claude/session_end_warning.log if the session ends with uncommitted
changes or without a TYPE: CLOSE entry.

Cannot block session end (SessionEnd hooks cannot block). This is a
safety net — the real enforcement is in close_audit_gate.py.

Exit 0 always.
"""

import os
import re
import subprocess
import sys
from datetime import datetime


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSION_LOG = os.path.join(PROJECT_ROOT, "PROTOCOL", "SESSION_LOG.md")
WARNING_LOG = os.path.join(PROJECT_ROOT, ".claude", "session_end_warning.log")


def get_last_log_entry_type():
    if not os.path.exists(SESSION_LOG):
        return "MISSING"
    try:
        with open(SESSION_LOG, "r", encoding="utf-8") as f:
            content = f.read()
        types = re.findall(r"^TYPE:\s*(\S+)", content, re.MULTILINE)
        return types[-1] if types else "EMPTY"
    except IOError:
        return "ERROR"


def has_uncommitted():
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=PROJECT_ROOT, timeout=10,
        )
        if result.returncode != 0:
            return False
        return bool(result.stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False


def main():
    warnings = []
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    last_type = get_last_log_entry_type()
    if last_type != "CLOSE":
        warnings.append(f"Session ended without TYPE: CLOSE (last entry: {last_type})")

    if has_uncommitted():
        warnings.append("Uncommitted changes exist at session end")

    if warnings:
        try:
            os.makedirs(os.path.dirname(WARNING_LOG), exist_ok=True)
            with open(WARNING_LOG, "a", encoding="utf-8") as f:
                f.write(f"\n--- {timestamp} ---\n")
                for w in warnings:
                    f.write(f"  WARNING: {w}\n")
        except IOError:
            pass

    sys.exit(0)


if __name__ == "__main__":
    main()
