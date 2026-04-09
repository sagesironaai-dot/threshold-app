#!/usr/bin/env python3
"""
USER PROMPT CONTEXT — UserPromptSubmit hook.

Fires before Claude processes each user message. Injects a compact
status line with current session state so Claude stays oriented
during long sessions.

Output goes to stdout and is injected as context.
Exit 0 always — informational only.
"""

import json
import os
import re
import sys


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSION_LOG = os.path.join(PROJECT_ROOT, "PROTOCOL", "SESSION_LOG.md")
ROT_OPEN = os.path.join(PROJECT_ROOT, "ROT_OPEN.md")
PHASE_STATE = os.path.join(PROJECT_ROOT, ".claude", "phase_state.json")


def count_work_units_today():
    """Count TYPE: WORK_UNIT entries for today in SESSION_LOG.md."""
    if not os.path.exists(SESSION_LOG):
        return 0
    try:
        from datetime import date
        today = date.today().strftime("%Y-%m-%d")
        with open(SESSION_LOG, "r", encoding="utf-8") as f:
            content = f.read()
        # Find WORK_UNIT entries with today's date
        entries = re.findall(
            r"TIMESTAMP:\s*" + re.escape(today) + r"[^\n]*\nTYPE:\s*WORK_UNIT",
            content,
        )
        return len(entries)
    except Exception:
        return 0


def count_open_rot():
    if not os.path.exists(ROT_OPEN):
        return 0
    try:
        with open(ROT_OPEN, "r", encoding="utf-8") as f:
            content = f.read()
        marker = "## OPEN ITEMS"
        idx = content.find(marker)
        if idx == -1:
            return 0
        after = content[idx + len(marker):]
        count = 0
        for line in after.split("\n"):
            if not line or line[0] in (" ", "\t", "-", "#"):
                continue
            stripped = line.strip()
            if stripped and not stripped.startswith("---"):
                count += 1
        return count
    except IOError:
        return 0


def get_active_phases():
    if not os.path.exists(PHASE_STATE):
        return []
    try:
        with open(PHASE_STATE, "r", encoding="utf-8") as f:
            state = json.load(f)
        return [(k, v.get("phase", "?")) for k, v in state.items()]
    except (json.JSONDecodeError, IOError):
        return []


def main():
    work_units = count_work_units_today()
    rot_count = count_open_rot()
    phases = get_active_phases()

    parts = []
    parts.append(f"work_units={work_units}")

    if rot_count > 0:
        parts.append(f"open_rot={rot_count}")

    if phases:
        phase_summary = ", ".join(f"{p[1]}" for p in phases[:3])
        if len(phases) > 3:
            phase_summary += f" +{len(phases)-3}"
        parts.append(f"phases=[{phase_summary}]")

    # Long session reminder
    if work_units >= 3:
        parts.append("LONG_SESSION: restate rules per SESSION_PROTOCOL.md section 5")

    status = " | ".join(parts)
    print(f"[session: {status}]")
    sys.exit(0)


if __name__ == "__main__":
    main()
