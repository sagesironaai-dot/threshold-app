# SYSTEM: Integration IDB

## integration_idb_system.md

### /DOCS/systems/

---

## WHAT THIS SYSTEM OWNS

* IDB layer — all read and write operations across every store in the archive
* DB_VERSION management — the single version number that governs all store definitions
* Store ownership for: root_entries · file_assets · manifest_sessions · archives · system_counters · routine_sessions · synthesis_sessions · findings · drift_events · patterns
* arc_seq counter operations — increment, checkpoint write, checkpoint clear
* Chunk queue derivation — computing next_chunk, page_start, page_end, queue_done
* Write path execution for every system — data.js executes the write; the owning system owns the decision to write
* lnv_routing_status and lnv_deposit_id writes on findings records — triggered by DNR after LNV receipt confirmation

## WHAT THIS SYSTEM DOES NOT OWN

* Routing authority — owned by SOT
* Entry schema definition and enum values — owned by schema.js
* Composite ID construction logic — owned by composite_id.js
* Synthesis logic — owned by mtm.js
* Session sequence orchestration — owned by nexus_routine.js
* Deposit routing decisions — owned by INT (integration system)
* Tag routing decisions — owned by tagger_bus.js
* Any business logic about what should be written — data.js executes; it does not decide

---

## DB_VERSION / REQUIRED_VERSION COUPLING

data.js carries DB_VERSION. thread_trace_db.js carries REQUIRED_VERSION. These two version numbers are incremented together. Never one without the other.

This constraint is not optional. It is not a coordination preference. It is a structural requirement: thread_trace_db.js requires a specific DB_VERSION to function correctly. If DB_VERSION increments without REQUIRED_VERSION incrementing, the thread trace layer will either fail to open or open against a schema it does not expect. If REQUIRED_VERSION increments without DB_VERSION incrementing, the thread trace layer will believe it requires a newer schema than what exists.

**The rule:** any store addition, modification, or removal that requires a DB_VERSION increment triggers a corresponding REQUIRED_VERSION increment in thread_trace_db.js in the same session. The two files are a unit at versioning time. Neither file is touched alone when versioning is the work.

---

## WRITE AUTHORITY TABLE

Each store lists who decides what is written and what data.js executes on their behalf:

| Store | Decision authority | data.js executes |
| --- | --- | --- |
| root_entries | INT (integration system) | intake sequence, retirement sequence writes |
| file_assets | INT | blob upload, record creation, re-upload path |
| manifest_sessions | INT | record creation, status writes, chunk_text lifecycle |
| archives | INT | retirement step 6 write, post-retirement page_deposit_id |
| system_counters | INT | arc_seq increment, checkpoint write and clear |
| routine_sessions | DNR | record creation, status writes, lnv_notified, retry_available |
| synthesis_sessions | MTM | record creation, status writes, findings_count, dedup_skipped |
| findings | MTM | record creation, fingerprint write; DNR triggers lnv_routing_status and lnv_deposit_id writes |
| drift_events | DTX | record creation, trajectory_state, outcome_vector, outcome_label, grade_latency |
| patterns | PCV | record creation, status transitions |

data.js never initiates a write based on its own judgment. Every write is triggered by the owning system.

---

## STORE INVENTORY

**root_entries** — source document records. One per intake. Carries provenance from first intake through retirement. Authoritative source for document_text on single-chunk documents.

**file_assets** — blob storage for large files. One record per uploaded file. blob may be replaced by re-upload on an existing record without creating a new root.

**manifest_sessions** — chunk parsing sessions. One per chunk per document. Tracks deposit array, stats, and session state. chunk_text is the working copy for the session — cleared on completion.

**archives** — retirement records. One per retired document. Carries confirmed_targets, provenance_summary, aggregate stats, and the ARC id. Links back to root_entries and forward to the Archives page deposit.

**system_counters** — single-record store. Holds arc_seq (global counter, never decrements) and arc_seq_checkpoint (crash-safe retirement guard, cleared at retirement step 12).

**routine_sessions** — DNR session records. One per Routine run. Tracks the two-step sequence status, MTM session reference, LNV notification state, and retry availability.

**synthesis_sessions** — MTM synthesis cycle records. One per runSynthesis() call. Tracks lens pages read, findings count, failure type, and deduplication skip flag.

**findings** — MTM Finding records. Written at synthesis time. Carries content_fingerprint for deduplication, source_pattern_refs for traceability, and lnv_routing_status for handoff tracking.

**drift_events** — DTX drift classification records. One per classified drift event. Carries four required classification dimensions, live trajectory_state, outcome_vector, and grade_latency.

**patterns** — PCV pattern records. One per observed cross-domain pattern. Carries hypothesis_id (the structural thread to DTX and SGR), source_signals, and hypothesis_statement.

---

## ARC_SEQ COUNTER OPERATIONS

arc_seq is the global counter for ARC id assignment. It never decrements.

**Increment sequence (at retirement step 1):**
1. Write arc_seq_checkpoint = current arc_seq value to system_counters
2. Increment arc_seq
3. Receive incremented value as ARC SEQ — use this value for all ARC id construction in this retirement sequence

**Checkpoint recovery (on retry):** four conditions evaluated in order — see INTEGRATION IDB SCHEMA for the full recovery block. The checkpoint is the crash-safe guard that prevents double-increment on retry.

**Checkpoint clear (at retirement step 12):** write arc_seq_checkpoint = null. Idempotent — skip if already null.

---

## CHUNK QUEUE DERIVATION

Computed from stored values on root_entries and file_assets. Never stored. Derived on demand.

```
next_chunk   = chunks_completed + 1
page_start   = (chunks_completed × chunk_size) + 1
page_end     = min((chunks_completed + 1) × chunk_size, file_assets.total_pages)
queue_done   = chunks_completed == total_chunks
```

---

## PUBLIC API

Representative methods — full signatures defined at build time against SOT.

**data.createRootEntry(fields) → string**
Writes root_entries record. Returns assigned id.

**data.writeManifestSession(fields) → string**
Creates manifest_sessions record for the given root. Returns session id.

**data.updateDepositStatus(sessionId, depositNum, status) → void**
Updates status on a single deposit within a manifest_session. Increments/decrements relevant stats.

**data.incrementArcSeq() → integer**
Writes checkpoint, increments arc_seq, returns new value.

**data.writeArchivesRecord(fields) → string**
Creates archives record at retirement step 6. Returns ARC id.

**data.writeFinding(fields) → string**
Creates findings record from MTM synthesis output. Returns finding id.

**data.writeLnvRoutingStatus(findingId, depositId) → void**
Writes lnv_routing_status → deposited and lnv_deposit_id on the named findings record. Triggered by DNR after LNV confirms receipt.

**data.createRoutineSession() → string**
Creates routine_sessions record. Returns session id.

**data.updateRoutineSession(sessionId, fields) → void**
Writes status, lnv_notified, retry_available, failure_type updates on a routine_session record.

---

## KNOWN FAILURE MODES

**1. DB_VERSION incremented without REQUIRED_VERSION**
thread_trace_db.js opens against a schema it does not expect. Thread trace layer fails or operates incorrectly.
Guard: DB_VERSION and REQUIRED_VERSION are incremented together in the same session. The coupling constraint is documented here and in THREAD TRACE SCHEMA. Neither file is touched alone at versioning time.

**2. IDB write failure mid-sequence (retirement)**
Partial retirement state. Arc_seq may have incremented without an archives record existing.
Guard: arc_seq_checkpoint provides crash-safe recovery. On retry, checkpoint recovery block at step 1 determines entry point. Double-increment is prevented. Sequence resumes from correct step.

**3. Partial write on chunks_completed increment**
manifest status writes to complete but chunks_completed write fails. Root integrity derives corrupt on next load.
Guard: the two writes are sequential — manifest status first, chunks_completed second. If chunks_completed write fails, manifest status rolls back to active. A corrupt root_integrity value is visible on load and surfaces recovery.

**4. open_deferrals write fails on decrement**
stats.deferred on manifest_sessions decrements correctly but root_entries.open_deferrals does not. Root-level deferral count is wrong. Retirement gate may clear incorrectly.
Guard: write order is enforced — stats.deferred decrements first, open_deferrals second. If open_deferrals write fails, root_integrity derives deferred on next load from the live manifest state — visible recovery signal.

**5. lnv_routing_status not written after LNV receipt**
Finding exists in IDB with lnv_routing_status: pending indefinitely. No visible error — the Finding is stranded.
Guard: DNR triggers the write immediately after LNV confirms receipt of each Finding. Findings with lnv_routing_status: pending after a completed routine_session are detectable on load as incomplete handoffs.

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| data.js | IDB layer — all stores, all intake and retirement sequence execution, arc_seq management, chunk queue derivation, write path for all owning systems | PLANNED |
| thread_trace_db.js | Thread trace IDB layer — REQUIRED_VERSION coupled to data.js DB_VERSION. Both incremented together at all versioning points. | PLANNED |
