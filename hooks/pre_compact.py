#!/usr/bin/env python3
"""
PRE-COMPACT — PreCompact hook.

Fires before context compaction (when conversation approaches context limit).
Writes a checkpoint entry to SESSION_LOG.md so critical state is preserved
even if context compression loses details.

Addresses F08 (long session degradation) — the moment context is about to
be compressed is exactly when rules are most at risk of being lost.

Exit 0 always — informational, does not block compaction.
"""

import json
import os
import re
import sys
from datetime import datetime


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSION_LOG = os.path.join(PROJECT_ROOT, "PROTOCOL", "SESSION_LOG.md")
PHASE_STATE = os.path.join(PROJECT_ROOT, ".claude", "phase_state.json")
ROT_OPEN = os.path.join(PROJECT_ROOT, "ROT_OPEN.md")


def count_work_units_today():
    if not os.path.exists(SESSION_LOG):
        return 0
    try:
        from datetime import date
        today = date.today().strftime("%Y-%m-%d")
        with open(SESSION_LOG, "r", encoding="utf-8") as f:
            content = f.read()
        entries = re.findall(
            r"TIMESTAMP:\s*" + re.escape(today) + r"[^\n]*\nTYPE:\s*WORK_UNIT",
            content,
        )
        return len(entries)
    except Exception:
        return 0


def get_phase_summary():
    if not os.path.exists(PHASE_STATE):
        return "none"
    try:
        with open(PHASE_STATE, "r", encoding="utf-8") as f:
            state = json.load(f)
        if not state:
            return "none"
        return ", ".join(f"{k}={v.get('phase','?')}" for k, v in state.items())
    except (json.JSONDecodeError, IOError):
        return "error"


def has_open_rot():
    if not os.path.exists(ROT_OPEN):
        return False
    try:
        with open(ROT_OPEN, "r", encoding="utf-8") as f:
            content = f.read()
        marker = "## OPEN ITEMS"
        idx = content.find(marker)
        if idx == -1:
            return False
        after = content[idx + len(marker):]
        for line in after.strip().split("\n"):
            stripped = line.strip()
            if stripped and not stripped.startswith("---") and not stripped.startswith("#"):
                return True
        return False
    except IOError:
        return False


def main():
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    work_units = count_work_units_today()
    phases = get_phase_summary()
    rot = "YES" if has_open_rot() else "no"

    checkpoint = (
        f"\n---\n"
        f"TIMESTAMP: {timestamp}\n"
        f"TYPE: COMPACT_CHECKPOINT\n"
        f"WORK_UNITS_TODAY: {work_units}\n"
        f"PHASE_STATE: {phases}\n"
        f"OPEN_ROT: {rot}\n"
        f"NOTE: Context compaction occurred. Re-read CLAUDE.md mandatory rules.\n"
        f"---\n"
    )

    try:
        if os.path.exists(SESSION_LOG):
            with open(SESSION_LOG, "a", encoding="utf-8") as f:
                f.write(checkpoint)
    except IOError:
        pass

    # Also output to stdout so Claude sees it in post-compact context
    print(f"CONTEXT COMPACTED — {work_units} work units today, phases: {phases}, open rot: {rot}")
    print("Re-read CLAUDE.md mandatory rules. SESSION_LOG.md has a COMPACT_CHECKPOINT entry.")
    sys.exit(0)


if __name__ == "__main__":
    main()
