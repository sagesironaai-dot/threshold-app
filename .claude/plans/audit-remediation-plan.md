# Audit Remediation Plan — Full System Fix Sequence

## Context

A deep audit across all tiers found 25 findings: 9 blocking, 10 high, 6 calibration.
No old architecture contamination (IDB, vanilla JS, browser patterns) — that cleanup
was thorough. The findings cluster around: count drift (50→51), missing registration/
ownership docs, binary files at risk, stale cross-references, and backend validation gaps.

This plan addresses **every finding** in 8 sequenced fixes. Each fix is one system-level
correction, committed before moving to the next. Order is driven by: what protects the
repo first, what corrects the root contract second, what cascades furthest third.

**Principle:** Each fix is complete across the entire system — every file that carries
the error is corrected in the same commit. No partial fixes.

---

## FIX 1: Repository Safety

**What:** Add gitignore entries for 3 untracked directories containing ~1.7 GB of binary files.

**Why first:** A single `git add .` or `backup.py` run commits hundreds of MB of audio
and image files. This is the highest-risk, lowest-effort fix.

**File to change:**
- `.gitignore` — add 3 entries:
  ```
  # Audio and media assets (large binaries)
  Audio/
  BackGround/
  backups/
  ```

**Cascade check:** None. These directories are not referenced by any build process.

**Commit:** `fix: gitignore Audio/, BackGround/, backups/ — prevent accidental commit of ~1.7GB binary assets`

---

## FIX 2: CLAUDE.md Truth Pass

**What:** Correct every stale claim in the root contract so all downstream files are
checked against accurate state.

**Why second:** CLAUDE.md is read at every session open. Every other fix is validated
against it. If the root contract is wrong, corrections propagate the wrong values.

**File to change:** `CLAUDE.md` — 5 corrections:

1. **Line 321:** `All 50 domain files verified. All 50 manifests verified.`
   → `All 51 domain files verified. All 51 manifests verified.`
   (VOI/Void was added as page 51 with Domain_Void.txt and Manifest_51_Void.txt)

2. **Lines 383-390 (SKELETON section):** Add note that audio system exists in frontend:
   ```
   frontend/         — SvelteKit scaffold (Svelte 5, TypeScript, Vite 7, dev server verified)
                       Audio system built post-infrastructure: engine, visualizer,
                       AudioPanel, WaveformStrip, audio store, spatial, colors,
                       events (14 files, all with tests)
   ```
   And update line 389: `Models, routes, services, components, and stores are not yet
   written` → `Models, routes, and services are not yet written. Audio components
   and audio store exist (built post-infrastructure). Remaining components and stores
   are built from SOT in the core files phase (step 4).`

3. **Lines 400-404 (REMOVED section):** Update backups/ entry:
   `backups/` line → `backups/ — original old manual backup folder (installers, index
   snapshots) deleted session 14. Directory recreated by Sage for audio file backups.
   Contains audio assets, not archive data. Gitignored.`
   Add new entries for Audio/Staging/ and BackGround/:
   ```
   Audio/Staging/    — audio source files for Resonance Engine. Gitignored.
   BackGround/       — background image assets. Gitignored.
   ```

4. **Line 437:** `src/routes/             — 50 page routes`
   → `src/routes/             — 51 page routes`

5. **Lines 442-443:** Update skeleton description to reflect audio system:
   `Frontend scaffold exists (SvelteKit + TypeScript).`
   → `Frontend scaffold exists (SvelteKit + TypeScript). Audio system built
   post-infrastructure (14 files).`

**Cascade check:** Read CLAUDE.md after edit. Confirm lines 321, 347 (already says 51),
383-390, 400-404, 437, 442-443 are all internally consistent.

**Commit:** `fix: CLAUDE.md truth pass — correct section counts (51), frontend state (audio exists), file boundary updates`

---

## FIX 3: System-Wide Count Propagation

**What:** Propagate 51 sections / 9 groups / correct group names to every downstream file
that carries the wrong count.

**Why third:** After CLAUDE.md is correct, every other file must match. These files feed
the SOT. Wrong counts in SOT_BUILD_TODO or the build plan mean the SOT is assembled
against the wrong number.

**Files to change (8 files):**

| File | What changes | Lines |
|---|---|---|
| `DESIGN/MISC/SOT_BUILD_TODO.md` | "50 sections" → "51 sections" (3 locations) | ~243, 319, 358 |
| `DESIGN/MISC/DOCS_STAGE_TODO.md` | "50 domain files" → "51 domain files" (2 locations) | ~192, 258 |
| `.claude/plans/infrastructure-build-plan.md` | "50 pages" → "51 pages" (3 locations) | ~126, 415, 667 |
| `.claude/plans/design-session-plan.md` | "50 pages" → "51 pages" (3 locations) | ~5488, 5694, 5719 |
| `api/prompts/_Global_Identity.txt` | "46 domains" → "51 sections", "8 groups" → "9 groups", fix group names | ~18, 20, 73 |
| `api/prompts/GLOBAL_KNOWLEDGE_BASE.txt` | "46 domains" → "51 sections", "8 groups" → "9 groups", fix group names + list | ~120, 141 |
| `api/prompts/GENESIS_Origin_Node.txt` | "46 domains" → "51 sections" | ~24 |
| `DESIGN/Systems/SECTION MAP.md` | Add VOI to SEED AFFINITIES table (currently covers 01-50 only) | End of affinities table |

**NOTE on api/prompts:** CLAUDE.md line 380 says "Do not modify without explicit
direction from Sage." **Sage confirmed: correct these files in Fix 3.** The group
names are deeply stale — they use old names (Spiral, Architecture, Creation, Omega)
instead of current (Spiral Phase, Cosmology, Archive, Nexus) and are missing the
Axis group entirely. All 3 files get count fixes (46→51, 8→9) AND group name
corrections in the same commit.

**DO NOT touch:**
- `PROTOCOL/SESSION_LOG.md` — historical record, never edited retroactively

**Cascade check:** After all edits, grep the entire project for "46 domain", "50 section",
"50 page", "8 group" to confirm no remaining stale counts in active files.

**Commit:** `fix: propagate 51 sections / 9 groups across all downstream docs and api prompts`

---

## FIX 4: INTEGRATION DB Table Registration

**What:** Register 3 PostgreSQL tables that are defined in their owning schemas but
missing from INTEGRATION DB SCHEMA — the central table registry.

**Why fourth:** Without registration, these tables have no Alembic migration path, no
SQLAlchemy model entry, and no write authority declaration. The build will hit undefined
tables.

**Tables to add:**
1. `signal_grades` — 15 columns (from SIGNAL GRADING SCHEMA.md)
2. `saved_threads` — 10 columns (from THREAD TRACE SCHEMA.md)
3. `thread_annotations` — 6 columns (from THREAD TRACE SCHEMA.md)

**Files to change (2 files):**

| File | What changes |
|---|---|
| `DESIGN/Systems/Integration/INTEGRATION DB SCHEMA.md` | Add 3 TABLE sections matching the existing format (field name, type, constraints, description). Add 3 entries to FILES model list at end of file. |
| `DESIGN/Systems/Integration/SYSTEM_ Integration DB.md` | Add 3 entries to WRITE AUTHORITY table: signal_grades (Signal Grading decides), saved_threads (Thread Trace decides), thread_annotations (Thread Trace decides). |

**Source for column definitions:**
- `DESIGN/Systems/Signal_Grading/SIGNAL GRADING SCHEMA.md` lines ~93-111
- `DESIGN/Systems/Thread_Trace/THREAD TRACE SCHEMA.md` lines ~404-498

**Cascade check:** After adding, verify:
1. Total registered tables matches updated count
2. FILES model list matches table count
3. WRITE AUTHORITY table has an entry for every registered table
4. No other schemas define PostgreSQL tables that are missing from INTEGRATION DB SCHEMA
   (all others verified clean in audit)

**Commit:** `fix: register signal_grades, saved_threads, thread_annotations in INTEGRATION DB SCHEMA + write authority`

---

## FIX 5: Cross-Reference Integrity Sweep

**What:** Fix all stale notes, wrong file paths, wrong status values, and formatting
corruption across DESIGN docs in a single pass.

**Why fifth:** These are the small errors that individually don't block but collectively
corrupt the SOT if they're assembled without correction.

**Files to change (8 files):**

| File | What changes |
|---|---|
| `DESIGN/Systems/Embedding_Pipeline/EMBEDDING PIPELINE SCHEMA.md` | Remove stale GAP NOTE (lines ~188-196) — owner_origin_id IS present in INTEGRATION DB SCHEMA on both root_entries and archives. Gap is closed. |
| `DESIGN/Systems/FastAPI/SYSTEM_ FastAPI.md` | Correct origin_type from `lattice` to `parallax_event` in RESERVED SWARM API PATTERNS section |
| `DESIGN/Systems/Swarm/SWARM ARCHITECTURE SCHEMA.md` | Remove the cleanup note (lines ~449-455) that logged the SYSTEM_ FastAPI.md discrepancy — will be resolved by the fix above |
| `DESIGN/Systems/Thread_Trace/SYSTEM_ Thread Trace.md` | Fix 3 file paths: `src/lib/` → `frontend/src/lib/` (lines ~121-123) |
| `DESIGN/Systems/Composite_ID/SYSTEM_ Composite ID.md` | Fix 2 file paths: `src/lib/` → `frontend/src/lib/` (lines ~165-166) |
| `DESIGN/Systems/Tagger/SYSTEM_ Tagger.md` | Change `backend/services/claude.py` status from PLANNED → LIVE (line ~74) |
| `DESIGN/Systems/Composite_ID/COMPOSITE ID SCHEMA.md` | Replace box-drawing header (lines 1-6) with plain text header matching other schemas |
| `DESIGN/MISC/ENTROPY_EXCAVATION.md` | Clean up stale UNVERIFIED section: remove items that are now in the VERIFIED list. Add resolution notes for items addressed by this fix pass. |

**Also verify during execution:**
- Manifest_46 (Witness Scroll) lines 210-211: "Larimar (14)" / "RCT (31)" — one audit
  said false positive (narrative context), ROT_CONTAMINATION_REPORT says CRITICAL.
  Read the actual lines, determine if page codes or narrative, and fix or mark accordingly.

**Cascade check:** After all edits, grep for:
- "GAP NOTE" in EMBEDDING PIPELINE SCHEMA (should be gone)
- `origin_type.*lattice` in SYSTEM_ FastAPI.md (should only appear in non-parallax contexts)
- `src/lib/` without `frontend/` prefix in all SYSTEM_ files
- "PLANNED" next to claude.py in SYSTEM_ Tagger.md (should be gone)
- Box-drawing characters in COMPOSITE ID SCHEMA header (should be gone)

**Commit:** `fix: cross-reference integrity sweep — stale notes, wrong paths, wrong statuses, formatting across 8 DESIGN files`

---

## FIX 6: DEPENDENCY_MAP.json Resolution

**What:** Clear the old-build content from DEPENDENCY_MAP.json and update protocol
references to defer the cross-check until core files exist.

**Why sixth:** SESSION_PROTOCOL.md §6 step 2 tells every session to cross-check function
contracts against this file. SCHEMA_PROTOCOL.md references it at 3 locations. The hook
`session_log_hook.py` reads it for cascade alerts. All of them currently point at
phantom dependencies (core/data.js, core/emergence.js, window.ThreadTraceUI, etc.).

**Files to change (3 files):**

| File | What changes |
|---|---|
| `PROTOCOL/DEPENDENCY_MAP.json` | Clear all entries in `files` object (both code and schema entries are stale — schema paths use old flat structure, reference deleted files). Retain JSON structure with a `_status` key noting "REBUILD DURING STEP 4 — all entries cleared [date], old-build references removed" |
| `PROTOCOL/SESSION_PROTOCOL.md` | Line ~206 (§6 step 2): Add note that DEPENDENCY_MAP cross-check is deferred until core files exist (Step 4). Map currently contains no valid entries. |
| `PROTOCOL/SCHEMA_PROTOCOL.md` | Lines ~26, ~62-63, ~258: Add status notes that the JSON map is rebuild-pending. Manual cascade analysis using schema cross-references should be used until then. |

**Cascade check:**
- `hooks/session_log_hook.py` reads the map at line 21 — verify it handles an empty
  `files` object gracefully (no crash on missing keys)
- Grep for "DEPENDENCY_MAP" across the project to confirm all references are updated

**Commit:** `fix: clear stale DEPENDENCY_MAP.json (old-build refs), defer protocol cross-checks until core files phase`

---

## FIX 7: Backend Code Hardening

**What:** Add ANTHROPIC_API_KEY validation and replace bare exception blocks with
diagnostic error capture.

**Why seventh:** These are code fixes, not doc fixes. Lower priority than the doc
corrections (which block SOT), but still a GITHUB_PROTOCOL §5 violation and Code
Contract Rules violation.

**Files to change (3 files):**

| File | What changes |
|---|---|
| `backend/config.py` | Line ~29: Add validation for ANTHROPIC_API_KEY. Approach: warn at import if empty (allows app to start for non-AI work), but set a flag that `call_claude()` can check before attempting API calls. |
| `backend/main.py` | Lines ~36-59: Replace 3 bare `except Exception: pass` blocks with `except Exception as e:` that captures exception type/message into the health response for diagnostics. Still returns degraded status, but now includes what failed and why. |
| `backend/services/claude.py` | Line ~89: Change from eager client initialization to lazy initialization — create `_client` on first `call_claude()` invocation, validate API key at that point with a clear error message. |

**Sage confirmed:** Fail-on-call approach. App starts without the key (useful during
dev). `call_claude()` raises a clear named error if the key is missing. Startup logs
a warning.

**Cascade check:** After changes:
1. Start the app with all env vars set — health returns `{"status": "ok"}`
2. Start the app without ANTHROPIC_API_KEY — health still returns ok for DB connections, but logs a warning about missing API key
3. Confirm `call_claude()` raises a clear error if key is missing

**Commit:** `fix: ANTHROPIC_API_KEY validation + health endpoint diagnostic capture (GITHUB_PROTOCOL §5 compliance)`

---

## FIX 8: Missing SYSTEM_ Files

**What:** Create 9 SYSTEM_ overview files for modules that have schemas but no ownership
boundary document. Verify/complete SYSTEM_ Research Assistant.md.

**Why last:** This is the largest fix (~9 new files). It depends on all prior corrections
being in place (counts, cross-references, table registration). These files complete the
ownership boundary coverage required before SOT assembly.

**CLAUDE.md rule (lines 353-358):** "Every planned module gets both a SYSTEM_ overview
doc and a full SCHEMA. The SYSTEM_ file declares ownership boundaries."

**Exceptions confirmed:** SGR·49, DTX·48, PCV·50 are exempt (domain-level analytical
systems without dedicated modules).

**Files to CREATE (9 new files):**

**Group A — Shared framework + infrastructure (4 files, each architecturally distinct):**
1. `DESIGN/Systems/Engine_Computation/SYSTEM_ Engine Computation.md`
   — Shared base framework for all 5 Axis engines. Owns: baseline math, weight
   application, null handling, signal classification, snapshot writes, stale flag checks.
   Source: ENGINE COMPUTATION SCHEMA.md + SYSTEM_ FastAPI.md (engine_base.py)

2. `DESIGN/Systems/Embedding_Pipeline/SYSTEM_ Embedding Pipeline.md`
   — Vector generation and storage. Owns: INT retirement trigger, nomic-embed-text
   integration, async embedding, re-embedding policy, metadata preservation.
   Source: EMBEDDING PIPELINE SCHEMA.md + SYSTEM_ FastAPI.md (embedding.py)

3. `DESIGN/Systems/Operational_DB/SYSTEM_ Operational DB.md`
   — SQLite state layer. Owns: session tracking, presence logging, ephemeral state.
   Does NOT own: archive data (PostgreSQL only).
   Source: OPERATIONAL DB SCHEMA.md + backend/db/sqlite.py (LIVE)

4. `DESIGN/Systems/Venai_Service/SYSTEM_ Venai Service.md`
   — Name registration, canonical form management, drift detection.
   Source: VENAI SERVICE SCHEMA.md + SYSTEM_ FastAPI.md (venai.py)

**Group B — 5 Axis engines (templated, share Engine_Computation base):**
5. `DESIGN/Systems/Threshold_Engine/SYSTEM_ Threshold Engine.md`
6. `DESIGN/Systems/StarRoot_Engine/SYSTEM_ StarRoot Engine.md`
7. `DESIGN/Systems/Infinite_Intricacy_Engine/SYSTEM_ Infinite Intricacy Engine.md`
8. `DESIGN/Systems/Echo_Recall_Engine/SYSTEM_ Echo Recall Engine.md`
9. `DESIGN/Systems/Sat_Nam_Engine/SYSTEM_ Sat Nam Engine.md`

Each Axis engine SYSTEM_ file needs: WHAT THIS SYSTEM OWNS, WHAT THIS SYSTEM DOES NOT
OWN (including "Engine_Computation owns the shared base"), engine-specific pipeline,
NEXUS FEED section, FILES table with backend service + frontend components + schema.

**Template pattern from:** SYSTEM_ Tagger.md (clean V1, 78 lines) and SYSTEM_ Emergence.md
(engine pattern, 104 lines).

**File to VERIFY/COMPLETE:**
10. `DESIGN/Systems/Research_Assistant/SYSTEM_ Research Assistant.md`
    — Audit disagreement: one pass said truncated at line 859 (no FILES table), another
    said complete. Verify during execution. If FILES table is missing, add it.

**This fix should be split into sub-commits for review:**
- 8a: Engine_Computation + 5 Axis engine SYSTEM_ files (shared pattern)
- 8b: Embedding_Pipeline + Operational_DB + Venai_Service SYSTEM_ files
- 8c: Research Assistant verification/completion

Each sub-commit reviewed by Sage before moving to the next.

**Cascade check:** After all files are written:
1. Every directory in DESIGN/Systems/ that has a SCHEMA also has a SYSTEM_ file
   (except SGR, DTX, PCV)
2. Every SYSTEM_ file has: ownership section, non-ownership section, FILES table
3. No SYSTEM_ file references old architecture
4. Cross-check FILES tables against SYSTEM_ FastAPI.md planned services and
   SYSTEM_ Frontend.md planned components

**Commit(s):**
- `fix: SYSTEM_ files for Engine_Computation + 5 Axis engines (THR, STR, INF, ECR, SNM)`
- `fix: SYSTEM_ files for Embedding_Pipeline, Operational_DB, Venai_Service`
- `fix: verify/complete SYSTEM_ Research Assistant.md FILES table`

---

## Verification After All 8 Fixes

After all fixes are committed, run a final verification sweep:

1. **Count grep:** Search entire project for "46 domain", "50 section", "50 page", "8 group"
   in active files — should return zero matches (historical SESSION_LOG entries are expected)
2. **SYSTEM_ coverage:** Every DESIGN/Systems/ directory with a SCHEMA has a SYSTEM_ file
   (except 3 exemptions)
3. **Table registration:** Every PostgreSQL table defined in any schema is registered in
   INTEGRATION DB SCHEMA
4. **Old-arch grep:** Search for "IndexedDB", "IDB", "data.js", "schema.js" in DESIGN/Systems/
   — should return zero (already clean, confirm it stayed clean)
5. **Git status:** All changes committed, nothing untracked except gitignored directories

---

## Summary

| Fix | Scope | Files changed | Depends on |
|-----|-------|---------------|------------|
| 1. Repository Safety | .gitignore | 1 | — |
| 2. CLAUDE.md Truth Pass | Root contract | 1 | — |
| 3. Count Propagation | All downstream docs + api/prompts | 8 | Fix 2 |
| 4. Table Registration | INTEGRATION DB + write authority | 2 | — |
| 5. Cross-Reference Sweep | 8 DESIGN files | 8 | — |
| 6. DEPENDENCY_MAP | Protocol files | 3 | — |
| 7. Backend Hardening | Backend code | 3 | — |
| 8. Missing SYSTEM_ Files | 9 new + 1 verify | 10 | Fixes 3-5 |
