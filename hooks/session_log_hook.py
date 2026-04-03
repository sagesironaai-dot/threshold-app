"""
session_log_hook.py
Aelarian Archives — PostToolUse hook for SESSION_LOG.md
Called by .claude/settings.json after every Write or Edit operation.

Two functions:
1. Appends a HOOK_WRITE entry to SESSION_LOG.md for every file write.
2. Reads PROTOCOL/DEPENDENCY_MAP.json — if the written file has downstream
   dependencies, appends a CASCADE_ALERT entry to SESSION_LOG.md.

Hook failure must never interrupt Claude's operation — all errors are silent.
"""

import sys
import json
import datetime
import os


def load_dependency_map(project_root):
    map_path = os.path.join(project_root, "PROTOCOL", "DEPENDENCY_MAP.json")
    if not os.path.exists(map_path):
        return {}
    with open(map_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("files", {})


def normalize_path(file_path, project_root):
    """Convert absolute path to forward-slash relative path for map lookup."""
    try:
        rel = os.path.relpath(file_path, project_root)
        return rel.replace("\\", "/")
    except ValueError:
        return file_path.replace("\\", "/")


def write_entry(log_path, entry):
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(entry)


def main():
    project_root = os.getcwd()
    log_path = os.path.join(project_root, "PROTOCOL", "SESSION_LOG.md")

    try:
        raw = sys.stdin.read() or "{}"
        data = json.loads(raw)

        tool_input = data.get("tool_input", {})
        file_path = tool_input.get("file_path", "unknown")

        # Do not log writes to SESSION_LOG.md itself — infinite loop prevention
        if os.path.abspath(file_path) == os.path.abspath(log_path):
            return

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        # --- FUNCTION 1: HOOK_WRITE entry ---
        try:
            hook_entry = (
                "\n---\n"
                f"TIMESTAMP: {timestamp}\n"
                "TYPE: HOOK_WRITE\n"
                f"FILE: {file_path}\n"
                "---\n"
            )
            write_entry(log_path, hook_entry)
        except Exception:
            pass

        # --- FUNCTION 2: CASCADE_ALERT ---
        try:
            dep_map = load_dependency_map(project_root)
            if not dep_map:
                return

            rel_path = normalize_path(file_path, project_root)

            # Check exact match first, then partial match for flexibility
            match = dep_map.get(rel_path)
            if match is None:
                # Try matching by filename only (catches absolute path variants)
                filename = os.path.basename(rel_path)
                for key in dep_map:
                    if os.path.basename(key) == filename:
                        match = dep_map[key]
                        rel_path = key
                        break

            if match is None:
                return

            affected = match.get("affects", [])
            if not affected:
                return

            reason = match.get("reason", "")
            affected_lines = "\n".join(f"  - {f}" for f in affected)

            cascade_entry = (
                "\n---\n"
                f"TIMESTAMP: {timestamp}\n"
                "TYPE: CASCADE_ALERT\n"
                f"TRIGGER_FILE: {rel_path}\n"
                f"REQUIRES_REVIEW:\n{affected_lines}\n"
                f"REASON: {reason}\n"
                "STATUS: UNREVIEWED\n"
                "---\n"
            )
            write_entry(log_path, cascade_entry)

        except Exception:
            pass

    except Exception:
        # Top-level catch — hook failure is always silent
        pass


if __name__ == "__main__":
    main()
