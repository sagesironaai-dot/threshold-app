#!/usr/bin/env python3
"""
lint_gate.py — PostToolUse hook for Write and Edit operations.

Fires after every file write. Runs the appropriate linter on the written
file and prints findings to stdout (injected into Claude's context).

Never blocks — exit 0 always. Findings are informational only.

Python (.py):   ruff check (full lint)
TypeScript/JS:  eslint via frontend/node_modules/.bin/eslint
Svelte:         same eslint path (eslint-plugin-svelte handles .svelte)

Files skipped:
  - .claude/ directory (working files, settings, plans)
  - hooks/ directory (this script and its siblings)
  - PROTOCOL/ directory (markdown/log files)
  - Any extension not in: .py, .ts, .js, .svelte
  - Files that do not exist on disk at hook time
"""

import json
import os
import subprocess
import sys


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_ROOT = os.path.join(PROJECT_ROOT, "frontend")

SKIP_PREFIXES = [".claude/", ".claude\\", "hooks/", "hooks\\", "PROTOCOL/", "PROTOCOL\\"]
PYTHON_EXTS = {".py"}
JS_EXTS = {".ts", ".js", ".svelte"}


def should_skip(rel_path, abs_path):
    for prefix in SKIP_PREFIXES:
        if rel_path.startswith(prefix):
            return True
    _, ext = os.path.splitext(rel_path)
    if ext not in PYTHON_EXTS | JS_EXTS:
        return True
    if not os.path.exists(abs_path):
        return True
    return False


def lint_python(abs_path):
    """Full lint via ruff. Returns (clean: bool, output: str)."""
    result = subprocess.run(
        ["ruff", "check", abs_path, "--output-format", "concise"],
        capture_output=True,
        text=True,
    )
    output = (result.stdout or result.stderr).strip()
    clean = result.returncode == 0
    if not output:
        output = "no issues found"
    return clean, output


def get_eslint_bin():
    """Return path to eslint binary for the current platform."""
    if sys.platform == "win32":
        candidate = os.path.join(FRONTEND_ROOT, "node_modules", ".bin", "eslint.cmd")
    else:
        candidate = os.path.join(FRONTEND_ROOT, "node_modules", ".bin", "eslint")
    return candidate if os.path.exists(candidate) else None


def lint_js(abs_path):
    """Run eslint on a frontend JS/TS/Svelte file. Returns (clean: bool, output: str)."""
    eslint = get_eslint_bin()
    if not eslint:
        return True, "eslint not found in frontend/node_modules — skipped"

    norm_file = os.path.normcase(os.path.abspath(abs_path))
    norm_frontend = os.path.normcase(os.path.abspath(FRONTEND_ROOT))
    if not norm_file.startswith(norm_frontend):
        return True, "file not in frontend/ — eslint skipped"

    result = subprocess.run(
        [eslint, abs_path, "--format", "stylish"],
        capture_output=True,
        text=True,
        cwd=FRONTEND_ROOT,
    )
    output = (result.stdout or result.stderr).strip()
    clean = result.returncode == 0
    if not output:
        output = "no issues found"
    return clean, output


def main():
    try:
        raw = sys.stdin.read() or "{}"
        data = json.loads(raw)
        tool_input = data.get("tool_input", {})
        file_path = tool_input.get("file_path", "")

        if not file_path:
            sys.exit(0)

        abs_path = os.path.abspath(file_path)
        try:
            rel_path = os.path.relpath(abs_path, PROJECT_ROOT).replace("\\", "/")
        except ValueError:
            rel_path = file_path.replace("\\", "/")

        if should_skip(rel_path, abs_path):
            sys.exit(0)

        _, ext = os.path.splitext(rel_path)

        if ext in PYTHON_EXTS:
            clean, output = lint_python(abs_path)
        elif ext in JS_EXTS:
            clean, output = lint_js(abs_path)
        else:
            sys.exit(0)

        label = "LINT CLEAN" if clean else "LINT FINDINGS"
        print(f"[lint_gate] {label} — {rel_path}")
        print(output)

    except Exception:
        pass  # hook failure is always silent

    sys.exit(0)


if __name__ == "__main__":
    main()
