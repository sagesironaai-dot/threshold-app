# PROTOCOL_TODO.md
# Aelarian Archives — Protocol System Running Checklist
# Last updated: April 2026

Status: [ ] open  [x] complete  [!] blocked  [~] in progress

---

## HOW TO USE

This list tracks everything required for the protocol system to function
as a whole unit. Work through sections in order. Each completed item is
marked [x]. Blocked items are marked [!] with the blocker named.
Do not mark complete until the item is verified, not just executed.

---

## SECTION 1 — IMMEDIATE: BEFORE NEXT BUILD SESSION

These items must be resolved before any code work begins.

- [ ] Commit all protocol files to git:
      CLAUDE.md, ENFORCEMENT.md, SESSION_PROTOCOL.md, SESSION_LOG.md,
      GITHUB_PROTOCOL.md, PROTOCOL_TODO.md, .claude/settings.json,
      hooks/session_log_hook.py, hooks/pre-commit, .gitignore

- [ ] Verify SESSION_LOG.md hook fires: make a test Write, check
      SESSION_LOG.md for a HOOK_WRITE entry

- [ ] Install pre-commit hook:
      cp hooks/pre-commit .git/hooks/pre-commit
      chmod +x .git/hooks/pre-commit
      Test: git commit --dry-run and confirm checks run

- [ ] Migrate B2 credentials out of backup.py — PRIORITY (F32)
      Procedure: GITHUB_PROTOCOL.md section 5
      Steps: create .env, update backup.py to use os.environ.get(),
      verify .env is gitignored, commit backup.py change only,
      then execute git history clean, then rotate credentials

- [ ] Create and commit .gitignore — required entries in
      GITHUB_PROTOCOL.md section 1
      Must exist before any commit that touches sensitive paths

---

## SECTION 2 — FOLDER TREE: VERIFY AND RESOLVE

Current observed state (April 2026). Each item requires a decision.

**Confirmed clean:**
- [ ] DOCS/Systems/ — 20 verified schema files, confirm count matches
- [ ] DOCS/Domains/ — 10 group folders, confirm all present

**Requires decision — quarantined empty folders:**
- [ ] JS/ — empty. Decision: delete or keep as placeholder for build phase
- [ ] Tools/ — empty. Decision: delete or keep

**Requires decision — non-empty contaminated folders:**
- [ ] api/ — NOT empty. Contains domains/ and prompts/ subdirectories
      with contaminated api files. Decision: delete contents and folder,
      or move to _REFERENCE_ONLY scope
- [ ] core/ — contains two untracked files: Sa'Qel'Inthra.txt and
      Untitled.txt. These do not belong in a PLANNED code folder.
      Decision: relocate or delete before build begins

**Requires decision — files at root that need resolution:**
- [ ] index.html — old contaminated build sitting at project root.
      It is PLANNED to be rebuilt. Decision: delete, move to
      _REFERENCE_ONLY scope, or leave until rebuild replaces it
- [ ] desktop.ini — OS artifact at root. Add to .gitignore and
      confirm it does not get committed

**Requires decision — path discrepancy:**
- [ ] _REFERENCE_ONLY/ — sits at Aelarian\ parent level, NOT inside
      Archives\. CLAUDE.md references it without a full path.
      Decision: move inside Archives\, or update all path references
      in CLAUDE.md to reflect the parent-level location

**Requires review — backups/ contents:**
- [ ] backups/SESSION_HANDOFF.md — session handoff doc in backups folder.
      Review: is this current, historical, or redundant now that
      SESSION_LOG.md exists? Decision: promote, archive, or delete
- [ ] backups/aelarian-backup-2026-04-02T15-23-57_concepts0.json —
      data export in backups. Confirm this is intentional and not
      an accidental inclusion

**Expected — not present yet (correct):**
- [ ] exports/ — does not exist. Expected pre-build. Layer 3 of
      backup.py will skip silently until this is created. Not an error.
- [ ] .github/workflows/ci.yml — PLANNED. Written when build starts.
- [ ] performance-budget.json — PLANNED. Defined at first build.

---

## SECTION 3 — PROTOCOL GAP REVIEW

Verify the protocol system functions as a whole unit. Every item checked
against the actual document contents, not memory.

**CLAUDE.md:**
- [ ] References ENFORCEMENT.md — present
- [ ] References SESSION_PROTOCOL.md — present
- [ ] References GITHUB_PROTOCOL.md — present
- [ ] No narrative language remains that could generate assumption
      or domain-colored code (re-read to verify)
- [ ] _REFERENCE_ONLY path updated if relocation decision is made

**ENFORCEMENT.md:**
- [ ] Every T2 failure has a corresponding hook in settings.json
      or hooks/pre-commit — cross-check the full list
- [ ] Every T3 failure has a corresponding procedure in
      SESSION_PROTOCOL.md — cross-check
- [ ] Every T4 failure has a corresponding entry in
      GITHUB_PROTOCOL.md — cross-check
- [ ] No failure entry reads "see [doc]" without that doc existing

**SESSION_PROTOCOL.md:**
- [ ] SESSION_LOG.md format matches what the hook actually writes
- [ ] Interrupt resume procedure tested (simulate: write mid-session,
      close without clean close, open new session, run procedure)
- [ ] Ghost fix procedure tested (simulate: apply a fix, run the
      verification steps, confirm they catch a missing fix)

**GITHUB_PROTOCOL.md:**
- [ ] .gitignore created and matches the required entries in section 1
- [ ] Pre-commit hook installed and all 4 checks confirmed running
- [ ] B2 credential migration complete before this is marked done
- [ ] Backup.py verified running correctly after credential migration

**settings.json:**
- [ ] PostToolUse hook confirmed active — test Write triggers
      HOOK_WRITE entry in SESSION_LOG.md
- [ ] Hook does not fire on SESSION_LOG.md itself (would create
      infinite loop) — verify or add exclusion if needed

**hooks/pre-commit:**
- [ ] Check 1 (credential scan) — test with a staged file containing
      a mock credential pattern, confirm block fires
- [ ] Check 2 (domain vocab scan) — test with a staged .js file
      containing a domain term, confirm warning fires
- [ ] Check 3 (lockfile) — test only when package.json exists
- [ ] Check 4 (sensitive files) — test with a staged .env file,
      confirm block fires
- [ ] Domain term list in hook finalized — current list is initial.
      Review against actual domain vocabulary before build starts.
      arcPhase values (aetherrot, solenne, vireth) are valid schema
      values — confirm exception handling is correct

---

## SECTION 4 — STRESS TEST: PROTOCOL AS A WHOLE

Run these checks once all Section 1, 2, and 3 items are complete.

**Scenario: clean session open**
- [ ] Start a new session
- [ ] Run session open procedure from SESSION_PROTOCOL.md step by step
- [ ] Verify all 8 steps complete without ambiguity
- [ ] Verify SESSION_LOG.md OPEN entry is written

**Scenario: interrupted session**
- [ ] Write to a file mid-session
- [ ] Close without a clean close (simulate interrupt)
- [ ] Open new session, run interrupt resume procedure
- [ ] Verify state is correctly recovered from SESSION_LOG.md + disk
- [ ] Verify no assumptions carried forward

**Scenario: ghost fix**
- [ ] Apply a correction to a file
- [ ] Intentionally skip step 3 of ghost fix procedure (do not read back)
- [ ] Note: this should be caught by the protocol — verify the
      discipline holds without the mechanical check
- [ ] Then run full ghost fix procedure with read-back — confirm it works

**Scenario: credential staged for commit**
- [ ] Add a mock credential to a test file
- [ ] Attempt git commit
- [ ] Verify pre-commit hook blocks it

**Scenario: domain vocab in code**
- [ ] Add a domain term to a .js file
- [ ] Attempt git commit
- [ ] Verify pre-commit hook warning fires

**Cross-document consistency:**
- [ ] Pick any 5 failures from ENFORCEMENT.md at random
- [ ] Verify each one's enforcement mechanism is actually in place
      (hook exists, rule is in CLAUDE.md, procedure is in
      SESSION_PROTOCOL.md, or GitHub config is set)
- [ ] Identify any failure where the documented enforcement is
      aspirational (listed but not yet implemented) — log each one

---

## SECTION 5 — BUILD PREREQUISITES

Nothing in this section begins until Sections 1–4 are complete.

- [!] SOT written and verified — BLOCKED: pending completion of
      domains and schemas. Both are COMPLETE. SOT is next.
- [ ] .gitignore created and committed
- [ ] Pre-commit hook installed and tested
- [ ] settings.json hook verified active
- [ ] _REFERENCE_ONLY path discrepancy resolved
- [ ] All empty/contaminated folders resolved (Section 2)
- [ ] First recovery tag created:
      git tag -a v2026-04-02-protocol-complete -m "Protocol system complete"
      git push origin v2026-04-02-protocol-complete
- [ ] performance-budget.json placeholder committed
- [ ] .github/workflows/ci.yml written (can be minimal at first build,
      expanded as build matures)

---

## SECTION 6 — ONGOING: EACH SESSION

These are not one-time items. They recur every session.

- [ ] SESSION_LOG.md: OPEN entry written at session start
- [ ] SESSION_LOG.md: WORK_UNIT entry written after each completed unit
- [ ] SESSION_LOG.md: CLOSE entry written at clean session end
- [ ] Ghost fix procedure run after every patch or correction
- [ ] backup.py run at session close
- [ ] Push to GitHub confirmed at session close
- [ ] Long session restatement triggered after 3 work units or
      category shift (per SESSION_PROTOCOL.md section 5)
