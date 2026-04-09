#!/usr/bin/env python3
"""
SESSION START — SessionStart hook.

Fires when a Claude Code session begins. Reads project state and outputs
a status summary that gets injected into Claude's context.

Checks:
  - Last SESSION_LOG.md entry type (CLOSE = clean, anything else = interrupted)
  - ROT_OPEN.md for active rot items
  - .claude/phase_state.json for active phase tracking
  - .claude/pending_ghost_fix.marker for unresolved fixes

Output goes to stdout and is injected as context into Claude's prompt.
Exit 0 always — this hook informs, it does not block.
"""

import json
import os
import re
import sys


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSION_LOG = os.path.join(PROJECT_ROOT, "PROTOCOL", "SESSION_LOG.md")
ROT_OPEN = os.path.join(PROJECT_ROOT, "ROT_OPEN.md")
PHASE_STATE = os.path.join(PROJECT_ROOT, ".claude", "phase_state.json")
GHOST_MARKER = os.path.join(PROJECT_ROOT, ".claude", "pending_ghost_fix.marker")


def get_last_log_entry_type():
    """Read SESSION_LOG.md and find the last TYPE: line."""
    if not os.path.exists(SESSION_LOG):
        return "MISSING"
    try:
        with open(SESSION_LOG, "r", encoding="utf-8") as f:
            content = f.read()
        # Find all TYPE: entries
        types = re.findall(r"^TYPE:\s*(\S+)", content, re.MULTILINE)
        if types:
            return types[-1]
        return "EMPTY"
    except IOError:
        return "ERROR"


def get_open_rot_items():
    """Read ROT_OPEN.md and return list of item names (top-level only)."""
    if not os.path.exists(ROT_OPEN):
        return []
    try:
        with open(ROT_OPEN, "r", encoding="utf-8") as f:
            content = f.read()
        marker = "## OPEN ITEMS"
        idx = content.find(marker)
        if idx == -1:
            return []
        after = content[idx + len(marker):]
        items = []
        for line in after.split("\n"):
            # Item headers are non-blank, non-indented, non-section lines
            if not line or line[0] in (" ", "\t", "-", "#"):
                continue
            stripped = line.strip()
            if stripped and not stripped.startswith("---"):
                items.append(stripped)
        return items
    except IOError:
        return []


def get_phase_state():
    """Read phase_state.json and return summary."""
    if not os.path.exists(PHASE_STATE):
        return {}
    try:
        with open(PHASE_STATE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def has_ghost_fix():
    """Check for pending ghost fix marker."""
    if not os.path.exists(GHOST_MARKER):
        return None
    try:
        with open(GHOST_MARKER, "r", encoding="utf-8") as f:
            return f.read().strip()
    except IOError:
        return None


def main():
    lines = []
    lines.append("SESSION STATE SUMMARY (auto-injected by session_start hook)")
    lines.append("=" * 60)

    # Last log entry
    last_type = get_last_log_entry_type()
    if last_type == "CLOSE":
        lines.append(f"  Last session: CLOSED cleanly")
    elif last_type in ("OPEN", "WORK_UNIT", "HOOK_WRITE", "RESUME"):
        lines.append(f"  Last session: INTERRUPTED (last entry: {last_type})")
        lines.append(f"  -> Follow SESSION_PROTOCOL.md section 3 (interrupted resume)")
    elif last_type == "MISSING":
        lines.append(f"  SESSION_LOG.md: not found")
    else:
        lines.append(f"  Last session entry type: {last_type}")

    # Open rot
    rot_items = get_open_rot_items()
    if rot_items:
        lines.append(f"  Open rot items: {len(rot_items)}")
        for item in rot_items:
            lines.append(f"    - {item}")
        lines.append(f"  -> Address before any new work (CLAUDE.md rule)")
    else:
        lines.append(f"  Open rot: none")

    # Phase state
    state = get_phase_state()
    if state:
        lines.append(f"  Active phase tracking: {len(state)} file(s)")
        for path, entry in sorted(state.items()):
            lines.append(f"    {entry.get('phase', '?'):20s}  {path}")
    else:
        lines.append(f"  Phase tracking: no active files")

    # Ghost fix
    ghost = has_ghost_fix()
    if ghost:
        lines.append(f"  PENDING GHOST FIX: {ghost}")
        lines.append(f"  -> Verify fix before continuing")

    lines.append("=" * 60)

    # Output to stdout — Claude Code injects this as context
    print("\n".join(lines))
    sys.exit(0)


if __name__ == "__main__":
    main()
