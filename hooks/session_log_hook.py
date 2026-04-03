"""
session_log_hook.py
Aelarian Archives — PostToolUse hook for SESSION_LOG.md
Called by .claude/settings.json after every Write or Edit operation.
Appends a minimal HOOK_WRITE entry to SESSION_LOG.md.
Hook failure must not interrupt Claude's operation — all errors are silent.
"""

import sys
import json
import datetime
import os


def main():
    try:
        raw = sys.stdin.read() or "{}"
        data = json.loads(raw)

        # Extract file path from tool input — Write uses file_path, Edit uses file_path
        tool_input = data.get("tool_input", {})
        file_path = tool_input.get("file_path", "unknown")

        # Resolve SESSION_LOG.md path relative to project root (cwd)
        log_path = os.path.join(os.getcwd(), "PROTOCOL", "SESSION_LOG.md")

        # Do not log writes to SESSION_LOG.md itself — infinite loop prevention
        if os.path.abspath(file_path) == os.path.abspath(log_path):
            return

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        entry = (
            "\n---\n"
            f"TIMESTAMP: {timestamp}\n"
            "TYPE: HOOK_WRITE\n"
            f"FILE: {file_path}\n"
            "---\n"
        )

        with open(log_path, "a", encoding="utf-8") as f:
            f.write(entry)

    except Exception:
        # Hook failure is silent — never blocks Claude's operation
        pass


if __name__ == "__main__":
    main()
