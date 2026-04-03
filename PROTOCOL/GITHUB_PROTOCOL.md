# GITHUB_PROTOCOL.md
# Aelarian Archives — GitHub and Infrastructure Protocol
# Last updated: April 2026

---

## PURPOSE

Defines all infrastructure-level enforcement: repository hygiene, dependency
management, supply chain integrity, CI pipeline requirements, credential
management, backup protocol, recovery points, and performance thresholds.
These rules operate at the GitHub and infrastructure layer — they do not
depend on session state or Claude's memory to function.

All files referenced in this protocol live in the project root unless
otherwise specified.

---

## 1. REPOSITORY HYGIENE

### .gitignore — Required Entries

The following must be present in .gitignore at all times.
If .gitignore does not exist, it is created before any other work proceeds.

```
# Credentials and environment
.env
*.env
.env.*

# Logs
*.log
backup.log

# OS artifacts
.DS_Store
Thumbs.db
desktop.ini

# Node
node_modules/
npm-debug.log*

# Build artifacts
dist/
build/

# Large binaries — committed by accident previously
*.exe
*.dmg
*.pkg
*.msi
```

### Commit Scope Rule

backup.py uses `git add .` — a blanket stage that catches everything
in the project folder. .gitignore is the only protection against
sensitive files being committed in this path.

Required before any backup.py run or manual `git add .`:
1. Confirm .gitignore is current and covers all sensitive paths
2. Run `git status` and review every file listed before staging
3. If any file in the staged list is unexpected, stop and investigate
   before committing

Specific file staging (`git add [file]`) is preferred over blanket staging
wherever possible.

### Branch Protection

- No direct pushes to `main` without a confirmed clean state
- All work committed and tested before push
- Force push to `main` requires explicit instruction from Sage.
  It is never a default action.

---

## 2. DEPENDENCY MANAGEMENT

These rules apply when npm dependencies are introduced into the build.
They are requirements for the build phase — not retroactive.

### Lockfile

- `package-lock.json` is committed to the repository at all times
- The lockfile is never in .gitignore
- If lockfile and `package.json` are out of sync, that is a blocking gap

### Install Rule

- `npm ci` only — installs exactly from the committed lockfile
- `npm install` is never run in a session or in CI
- `npm install` resolves versions at runtime and can silently change
  what is installed. `npm ci` does not.

### Vulnerability Scanning

- `npm audit` runs in CI on every push
- High or critical severity findings block merge
- Dependabot alerts are enabled on the repository
- A Dependabot alert is not optional — it is reviewed and resolved before
  new build work continues

---

## 3. SUPPLY CHAIN INTEGRITY

### Subresource Integrity (SRI) — CDN-Loaded Resources

Every resource loaded from a CDN in `index.html` requires an SRI hash.
No external resource is loaded without one.

**Format:**
```html
<script src="https://cdn.example.com/library.min.js"
        integrity="sha384-[hash]"
        crossorigin="anonymous"></script>

<link rel="stylesheet" href="https://cdn.example.com/style.min.css"
      integrity="sha384-[hash]"
      crossorigin="anonymous">
```

**How to generate a hash:**
```bash
curl -s https://cdn.example.com/library.min.js | \
  openssl dgst -sha384 -binary | openssl base64 -A
```

Prefix the output with `sha384-` to form the integrity value.

**Rule:** If a CDN resource is updated to a new version, the SRI hash
is regenerated and updated in index.html before the change is committed.
A stale hash causes the resource to be blocked by the browser — which is
the correct behavior. Do not remove the hash to fix a load failure.
Update it.

### Install Integrity

- `npm ci` installs from the committed lockfile with no version resolution
- This does not protect against a tampered package at the registry level
- Dependabot and `npm audit` provide the detection layer for known
  compromises — no automated protection exists for zero-day tampering

---

## 4. GITHUB ACTIONS CI PIPELINE

The CI pipeline file lives at `.github/workflows/ci.yml`.
This file is PLANNED — written when the build phase begins.

### Required Pipeline Steps (every push to main)

Run in this order:

1. **Clean install** — `npm ci` from committed lockfile
2. **Build** — full build, not incremental
3. **Test suite** — full test run, not subset
4. **Vulnerability scan** — `npm audit --audit-level=high`
5. **Credential scan** — pattern scan across all committed files
   (see section 5 for patterns)
6. **Bundle size check** — compare against committed baseline
   (see section 8 for thresholds)
7. **Performance check** — Lighthouse CI against defined thresholds
   (see section 8)

### Merge Blockers

Any of the following blocks merge to main:

- Failing tests
- High or critical CVE from `npm audit`
- Credential pattern detected in committed files
- Build failure
- Bundle size regression beyond defined threshold
- Lighthouse score below defined threshold

---

## 5. CREDENTIAL MANAGEMENT

### Rule

Credentials live in environment variables only. Never in source files.
This includes: API keys, tokens, passwords, bucket names paired with keys,
any string that provides authenticated access to an external service.

### .env File

Store credentials locally in a `.env` file in the project root.
`.env` is in .gitignore and is never committed.

Format:
```
B2_KEY_ID=your_key_id_here
B2_APP_KEY=your_app_key_here
```

### Reading Credentials in Code

```python
import os
B2_KEY_ID = os.environ.get('B2_KEY_ID')
B2_APP_KEY = os.environ.get('B2_APP_KEY')
```

If a variable is missing, the script must fail with a named error —
not silently proceed with a None value.

### Current Live Action — backup.py B2 Credentials (Priority — F32)

backup.py currently contains hardcoded B2_KEY_ID and B2_APP_KEY.
These are committed to git history.

**Migration procedure** (execute when directed by Sage):

1. Create `.env` in project root with current B2 values
2. Confirm `.env` is in .gitignore — verify with `git status` before
   any staging
3. Update backup.py: replace hardcoded values with `os.environ.get()`
   calls with failure on None
4. Commit backup.py change only — verify .env does not appear in
   `git status` before committing
5. Execute git history clean (procedure below)
6. Rotate B2 credentials immediately after history clean —
   treat the committed values as compromised regardless of
   whether the repository is currently public

### Git History Clean Procedure

Required because credentials committed to history remain accessible
even after the file is updated. Removing from the current file is not
sufficient.

**Tool:** BFG Repo Cleaner (faster and safer than `git filter-branch`)

Steps:
1. Download BFG Repo Cleaner: `bfg-[version].jar`
2. Create a text file `credentials-to-remove.txt` containing the exact
   credential strings — one per line
3. Clone a mirror of the repository:
   `git clone --mirror [remote-url] repo-mirror.git`
4. Run BFG against the mirror:
   `java -jar bfg.jar --replace-text credentials-to-remove.txt repo-mirror.git`
5. Enter the mirror directory:
   `cd repo-mirror.git`
6. Expire old refs and garbage collect:
   `git reflog expire --expire=now --all && git gc --prune=now --aggressive`
7. Force push the cleaned history:
   `git push --force`
8. Delete `credentials-to-remove.txt` immediately after
9. Rotate B2 credentials — generate new key and app key in Backblaze
   console, update `.env` with new values

**Warning:** Force pushing rewrites history. Anyone with a local clone
of the repository will need to re-clone. Coordinate before executing
if others have local copies.

### Credential Scan — CI

The CI pipeline scans for common credential patterns on every push.

Patterns that trigger a block:
- Strings matching `[A-Z0-9]{25}` adjacent to key/secret/token labels
- `password`, `passwd`, `secret`, `api_key`, `app_key` assigned to
  string literals in code files
- Known service key prefixes (Backblaze, AWS, etc.)

If the scan produces false positives on legitimate code, the allowlist
is updated — the scan is not disabled.

---

## 6. BACKUP PROTOCOL

backup.py provides three-layer protection:

| Layer | Target | Coverage |
|---|---|---|
| 1 — USB | D:\threshold-backups\[date] | Full project folder, daily |
| 2 — GitHub | Remote repository | Committed files, pushed on run |
| 3 — Backblaze B2 | threshold-backups bucket | exports/*.json only |

### When to Run

- At every clean session close (part of SESSION_PROTOCOL.md close steps)
- Before any destructive operation (file deletion, history rewrite,
  schema replacement)
- Before any new build phase begins

### Before Every Run

1. Confirm .gitignore is current — sensitive files must be excluded
2. Run `git status` and review the staged file list before Layer 2 commits
3. Confirm D:\ (USB) is connected before Layer 1 runs — Layer 1 fails
   silently if the drive is absent. Check the log after each run.
4. Confirm `exports/` folder exists before Layer 3 runs — Layer 3 skips
   silently if absent. This is expected behavior pre-build, not an error.

### After Every Run

Check `backup.log` for failure entries. A completed run with no failure
entries is a clean backup. A run that produced no output to backup.log
at all indicates a logging failure — investigate before assuming success.

---

## 7. RECOVERY POINTS — TAGGED RELEASES

### When to Tag

A GitHub release tag is created at every verified milestone boundary.
A milestone boundary is:

- Rebuild phase complete (e.g., all schemas verified, SOT complete)
- Each new core file written and verified
- Any state that represents a known-good recovery target

Tags are never created mid-phase or on work-in-progress commits.

### Tag Naming Convention

```
v[YYYY-MM-DD]-[milestone-name]
```

Examples:
```
v2026-04-02-schemas-verified
v2026-04-15-sot-complete
v2026-05-01-data-layer-complete
```

### Tagging Procedure

1. Confirm the working directory is clean — `git status`
2. Confirm the build is in the intended state
3. Create the tag:
   `git tag -a v[YYYY-MM-DD]-[milestone-name] -m "[milestone description]"`
4. Push the tag:
   `git push origin v[YYYY-MM-DD]-[milestone-name]`
5. Confirm the tag appears on the GitHub releases page

### Recovery Procedure

To restore to a tagged state:

1. Identify the target tag — review the tag list:
   `git tag -l`
2. Check what the tag contains:
   `git show v[tag-name]`
3. Create a recovery branch from the tag — do not check out directly
   to main without review:
   `git checkout -b recovery/[tag-name] v[tag-name]`
4. Review the recovered state with Sage before any decision to restore,
   discard, or merge forward

Recovery decisions are made by Sage. The procedure surfaces the state —
it does not make the decision.

---

## 8. PERFORMANCE THRESHOLDS

These thresholds are PLANNED — defined here as requirements, configured
in CI when the first build is ready for performance baseline.

### Lighthouse CI — App Shell

Minimum acceptable scores on every push:

| Category | Minimum Score |
|---|---|
| Performance | 85 |
| Accessibility | 90 |
| Best Practices | 90 |

Scores below threshold block merge.

### Bundle Size Baseline

On first build: commit a `performance-budget.json` file with the baseline
bundle size. On subsequent pushes, CI compares against baseline.

Regression threshold: merge blocked if total bundle size increases more
than 10% from baseline without explicit approval.

### Data Pipeline Timing Assertions

Critical operations require timing assertions in the test suite:

- Entry write (createEntry to confirmed save): target under 200ms
- Tag resolution (resolveTagIds full chain): target under 100ms
- MTM synthesis read across all five Axis pages: target under 2000ms

Timing assertions are not soft warnings — they are test failures.
A timing regression is treated as a functional regression.

### Updating Thresholds

Thresholds are updated only when:
- The baseline measurement has changed due to intentional architectural
  work (not regression)
- Sage explicitly approves the new baseline

Thresholds are never relaxed to make a failing build pass. If a build
fails a threshold, the regression is investigated and fixed.
