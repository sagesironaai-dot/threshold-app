# DAILY NEXUS ROUTINE SCHEMA

## /DESIGN/Systems/Daily_Nexus_Routine/DAILY NEXUS ROUTINE SCHEMA.md

Mechanical spec — pipeline sequence, MTM result handling, LNV routing via
universal receive contract, Void session-close pulse check, payloads, store,
retry, session window, failure modes.
Architectural description in SYSTEM_ Daily Nexus Routine.md.

---

## OWNERSHIP BOUNDARIES

### OWNS

- Session-close pipeline mechanics — step execution, write ordering
- In-progress guard — check, timeout, recovery
- routine_sessions store — field definitions, status transitions
- LNV routing for MTM Findings — calling POST /api/lnv/receive per Finding, triggering lnv_routing_status writes
- LNV failure notification — operational failure display, separate from archival receive contract
- Void session-close pulse check trigger — calling POST /void/analyze with trigger: session_close
- LNV routing for Void output — calling POST /api/lnv/receive for void_output
- Retry mechanics — session window assembly, dedup array, window ceiling
- Named constants — timeout, window max
- Known failure modes — all guards and recovery paths

### DOES NOT OWN

- Pipeline architectural identity — owned by SYSTEM_ Daily Nexus Routine.md
- MTM synthesis logic — owned by METAMORPHOSIS SCHEMA.md
- Findings content or structure — owned by METAMORPHOSIS SCHEMA.md
- Void analysis logic — owned by VOID ENGINE SCHEMA.md
- LNV deposit writing — owned by LNV
- WSC — sovereign, not part of this pipeline
- PostgreSQL reads or writes — owned by FastAPI service layer
- Routing authority — owned by SOT

---

## NAMED CONSTANTS

| Constant | Value | Purpose |
| --- | --- | --- |
| DNR_INPROGRESS_TIMEOUT_MS | calibration item | Maximum time an in_progress routine_session record can exist before DNR treats it as interrupted without requiring app restart. |
| DNR_DEDUP_WINDOW_MAX | calibration item | Maximum number of prior failed sessions included in the prior_mtm_session_ids dedup array. Truncation logged when exceeded. |

---

## THE CLOSE SESSION BUTTON — MECHANICS

Lives in the global dropdown. Available from every page.

**ON PRESS:**

1. Check in-progress guard: if most recent routine_session status is
   in_progress AND record age < DNR_INPROGRESS_TIMEOUT_MS, does not fire.
   Surfaces status indicator. If in_progress AND record age >=
   DNR_INPROGRESS_TIMEOUT_MS, treats as interrupted (see INTERRUPTED RUN
   RECOVERY below).
2. Create routine_session record. Write status → in_progress. Write
   triggered_at = timestamp.
3. Execute the session-close pipeline (see below).
4. Write routine_session to final status.

**GUARD — NO CONCURRENT RUNS:** in_progress check runs before any new session
record is created. No duplicate runs.

---

## SESSION-CLOSE PIPELINE

Strict order. Each step resolves before the next fires. Never runs in
parallel. Named by function, not count.

### STEP: MTM SYNTHESIS

Trigger: POST /mtm/synthesize

On retry: pass prior_mtm_session_ids array (see RETRY).
On clean run: pass no options.

Await completion. MTM returns result object:

```json
{
  "status":                     "complete | failed",
  "failure_type":               "null | pre_synthesis | pass_1_failed | mid_synthesis | pass_2_failed",
  "findings":                   [],
  "findings_confirmed":         0,
  "findings_complicated":       0,
  "findings_overturned":        0,
  "findings_open_question":     0,
  "findings_dropped":           0,
  "mtm_session_id":             "string",
  "patterns_filtered_count":    0,
  "deposits_pulled_count":      0,
  "convergence_deposits_pulled": 0,
  "gap_deposits_pulled":        0,
  "synthesis_duration_ms":      0
}
```

On resolution: write mtm_session_ref on routine_session record. Write
synthesis_duration_ms on routine_session record (same moment, before LNV
routing fires). Proceed to next step.

### STEP: LNV ROUTING FOR MTM FINDINGS

Fires after MTM resolves, regardless of MTM status. LNV always receives
notification — success or failure.

**On MTM status 'complete':**

For each Finding in the result object's findings array:
1. Assemble LNV receive request:
   ```json
   {
     "entry_type":     "mtm_finding",
     "source_system":  "mtm",
     "source_page":    null,
     "session_ref":    "[current session]",
     "prompt_version": "[from Finding provenance.prompt_versions]",
     "content": {
       "finding_id":             "[Finding.id]",
       "finding_type":           "[Finding.finding_type]",
       "title":                  "[Finding.title]",
       "content":                "[Finding.content]",
       "provenance":             "[Finding.provenance]",
       "prompt_versions":        "[Finding.provenance.prompt_versions]",
       "attached_open_question": "[Finding.attached_open_question]",
       "resolves_open_question": "[Finding.resolves_open_question]"
     },
     "sage_note":      null
   }
   ```
2. POST /api/lnv/receive
3. On LNV success: trigger FastAPI service layer to write lnv_routing_status →
   deposited and lnv_deposit_id on the findings record.

After all Findings routed:
- Write lnv_notified → true on routine_session.
- Write retry_available → false.

**On MTM status 'failed':**

Send LNV failure notification (operational, not through receive contract):

```json
{
  "type":                  "mtm_failure",
  "failure_type":          "pre_synthesis | pass_1_failed | mid_synthesis | pass_2_failed | interrupted",
  "mtm_session_id":        "string",
  "findings":              [],
  "findings_confirmed":    0,
  "findings_complicated":  0,
  "findings_overturned":   0,
  "findings_open_question": 0,
  "findings_dropped":      0,
  "synthesis_duration_ms": 0,
  "retry_available":       true,
  "message":               "string — human-readable failure description"
}
```

After LNV confirms receipt:
- Write lnv_notified → true on routine_session.
- Write retry_available → true.

**Failure type display:**

| failure_type | Display message |
| --- | --- |
| pre_synthesis | "MTM synthesis did not start — [reason]. Retry available." |
| pass_1_failed | "MTM Pass 1 failed — no Synthesis Brief produced. Retry available." |
| mid_synthesis | "MTM Selection Function failed — Pass 2 did not execute. Retry available." |
| pass_2_failed | "MTM Pass 2 failed — partial verdicts may exist. Retry available." |
| interrupted | "Session interrupted before completion. Retry available." |

### STEP: VOID SESSION-CLOSE PULSE CHECK

Fires after LNV routing for MTM Findings completes (whether MTM succeeded or
failed). The Void pulse check runs regardless of MTM status — absence data is
independent of synthesis.

1. Trigger: POST /void/compute — runs Void data layer computation (absence
   pattern detection from engine null signals).
2. Trigger: POST /void/analyze with trigger: session_close — runs Void
   analytical layer (Claude pulse check with session delta payload).
3. Void returns prose output (session-close trigger shape — see VOID ENGINE SCHEMA).
4. Route Void output to LNV:
   ```json
   {
     "entry_type":     "void_output",
     "source_system":  "void",
     "source_page":    "VOI",
     "session_ref":    "[current session]",
     "prompt_version": "[from void_outputs record]",
     "content": {
       "trigger":        "session_close",
       "void_output_id": "[void_outputs.id from Void analyze response]",
       "prose_output":   "[prose_output from Void analyze response]",
       "engines_read":   []
     },
     "sage_note":      null
   }
   ```
5. POST /api/lnv/receive
6. Write void_pulse_completed → true on routine_session.
7. Write void_output_ref on routine_session (references void_outputs.id).

**On Void failure:** Void pulse check failure does NOT fail the entire DNR
session. Write void_pulse_completed → false. Log failure. The session can
still complete successfully if MTM succeeded. Void failure is noted, not
blocking.

### FINAL STATUS WRITE

After all steps complete:
- If MTM complete AND all Findings routed: write status → complete.
- If MTM failed: write status → failed (regardless of Void pulse result).
- Void pulse failure does not change DNR status.

---

## STORE: routine_sessions

| Field | Type | Description |
| --- | --- | --- |
| id | auto | Primary key |
| triggered_at | timestamp | Written when Close Session fires. Never updated. |
| status | enum | `in_progress`, `complete`, `failed`. |
| mtm_session_ref | foreign key / null | References synthesis_sessions.id. Written after MTM resolves. Null until MTM resolves. |
| synthesis_duration_ms | integer / null | Wall-clock synthesis time in ms. From MTM result object. Null if MTM never resolved. |
| lnv_notified | boolean | True after LNV notification step completes, regardless of MTM status. False until LNV routing executes. |
| failure_type | enum / null | null, `pre_synthesis`, `pass_1_failed`, `mid_synthesis`, `pass_2_failed`, `interrupted`. Null on complete runs. |
| retry_available | boolean | True when status is failed. False on complete runs. |
| dedup_window_truncated | boolean / null | True when retry session window exceeded DNR_DEDUP_WINDOW_MAX. False on all other runs. Null on clean first runs. |
| void_pulse_completed | boolean | True after Void session-close pulse check completes successfully. False if Void failed or was not yet run. |
| void_output_ref | foreign key / null | References void_outputs.id. Null until Void pulse check completes. |
| created_at | timestamp | Written once at record creation. Never updated. |

---

## INTERRUPTED RUN RECOVERY

Two recovery paths. Both produce the same failure state.

### At app load (NexusRoutine.init())

Checks for any routine_session record with status in_progress. If found:
- Write status → failed on routine_session.
- Write failure_type → interrupted.
- Write retry_available → true.

If mtm_session_ref is not null (MTM had resolved before crash):
- Write status → failed on the linked synthesis_session.
- Send LNV failure notification with failure_type: interrupted and finding
  counts from the MTM synthesis_session record.

If mtm_session_ref is null (MTM had not yet resolved):
- No MTM session record to update.
- Send LNV failure notification with failure_type: interrupted, all finding
  counts 0.
- On retry: fires as clean run — passes no prior_mtm_session_ids.

### In-session timeout (DNR_INPROGRESS_TIMEOUT_MS)

If an in_progress record is older than the timeout threshold and no MTM
resolution has arrived: same recovery path as init(). Write status → failed,
failure_type → interrupted. Surface retry. No app restart required.

---

## RETRY MECHANICS

Surfaced in two places: LNV inline Retry button, Global dropdown Retry
Session Close. Both call NexusRoutine.retry(). Behavior is identical
regardless of caller.

### Session window determination

The current session window is all routine_session records since the most
recent record with status: complete. If no complete record exists, the window
is all records. The window closes the moment a run completes successfully.

DNR reads all routine_session records in the current window. Reads
mtm_session_ref from each. Assembles prior_mtm_session_ids array from those
refs. Excludes any record where mtm_session_ref is null — those runs were
interrupted before MTM resolved and have no Findings to deduplicate against.

### Window ceiling (DNR_DEDUP_WINDOW_MAX)

When the session window exceeds DNR_DEDUP_WINDOW_MAX, DNR includes only the N
most recent failed sessions in the dedup array. The truncation is logged.
dedup_window_truncated → true written on the new routine_session record. LNV
surfaces this so Sage knows the dedup pass was partial.

### Retry execution

Creates a new routine_session record (never modifies previous). Passes
prior_mtm_session_ids to MTM synthesis endpoint. Runs the full session-close
pipeline from the MTM step. Respects the in_progress guard — does not bypass
it. Retry Session Close disappears from dropdown when a successful run
completes.

---

## PUBLIC API

### POST /dnr/close-session

Called by Close Session button. Runs in_progress guard (with timeout check).
Creates routine_session record. Executes the session-close pipeline. Returns
when all steps have resolved.

### POST /dnr/retry

Called from LNV inline Retry button or Global dropdown Retry Session Close.
Assembles prior_mtm_session_ids from current session window (respecting
DNR_DEDUP_WINDOW_MAX). Creates new routine_session record. Runs full
session-close pipeline.

### GET /dnr/sessions

Query routine_session records. Most recent first. Used for session status
display and retry determination.

### POST /dnr/init

Called once at app startup. Checks for stale in_progress records and resolves
them. Called before the app shell is interactive.

---

## KNOWN FAILURE MODES

### 1. Button fires while previous run is in_progress

Two concurrent runs. Duplicate session records. MTM fires twice.

**Guard:** in_progress check runs before any new session record is created. If
most recent status is in_progress and within timeout window, button does not
fire. Status indicator surfaced.

### 2. MTM completes but LNV routing fails

Findings exist in PostgreSQL. LNV never receives them. lnv_notified stays
false.

**Guard:** lnv_notified written only after LNV routing confirms. Session
status written only after lnv_notified is true. A session where lnv_notified
is false and mtm_session_ref is written is an incomplete run —
NexusRoutine.init() checks for this on app load.

### 3. Retry fired before failure_type is written

Retry fires on incomplete failure record.

**Guard:** retry_available set to true only after failure_type is written and
lnv_notified is true. Retry prompt does not surface until failure notification
is fully written.

### 4. Session record never exits in_progress

In_progress guard blocks all future runs indefinitely.

**Guard:** two recovery paths — NexusRoutine.init() at app load, and
DNR_INPROGRESS_TIMEOUT_MS for in-session recovery. Both write status → failed,
failure_type → interrupted. No permanent block.

### 5. Failed session record overwritten on retry

Ledger no longer reflects what happened. Provenance gap.

**Guard:** retry always creates a new routine_session record. Failed records
are read-only after status is written. No update path.

### 6. Dedup window grows unbounded

40+ failed sessions in window. MTM loads all prior findings to build dedup
Set. Performance degrades.

**Guard:** DNR_DEDUP_WINDOW_MAX caps the window. Truncation logged.
dedup_window_truncated noted on routine_session.

### 7. Void pulse check blocks session completion

Void Claude API call hangs or fails. DNR session cannot complete.

**Guard:** Void pulse check failure is non-blocking. DNR writes
void_pulse_completed → false and proceeds to final status write. Void failure
is logged but does not change DNR session status.

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| backend/services/dnr.py | DNR service — session-close pipeline execution, in_progress guard with timeout, session record management, MTM endpoint trigger, LNV routing via receive contract, Void pulse check trigger, retry logic with window ceiling, interrupted recovery on init | PLANNED |
| backend/routes/dnr.py | FastAPI DNR endpoints — POST close-session, POST retry, GET sessions, POST init | PLANNED |
| frontend/ (DNR components) | Svelte — Close Session button in global dropdown, Retry Session Close dropdown item, status indicators | PLANNED |
