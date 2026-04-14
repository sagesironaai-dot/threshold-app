# AOS SCHEMA

## /DESIGN/Systems/AOS/AOS SCHEMA.md

Mechanical spec — Automated Observation Signal system. Signal routing,
record structure, delivery types, trigger registry, daily pipeline,
Drive integration, failure handling, operational logging.
Architectural description in SYSTEM_ AOS.md.

---

## OWNERSHIP BOUNDARIES

### OWNS

- aos_records — permanent signal event records (Integration DB, PostgreSQL)
- daily_pipeline_log — cron run state records (Operational DB, SQLite)
- Signal routing logic — trigger event → delivery type assignment → record creation
- Integrity hash computation — reference_ids + engine state + timestamp
- Email composition and delivery — Larimar → Threshold Studies via Gmail OAuth
- Drive pipeline — daily snapshot, session seeds, and export uploads

### DOES NOT OWN

- Signal production — triggering systems (MTM, SGR, DTX, PCV, Void, Emergence) detect patterns. AOS receives triggers; it does not run detectors.
- Observatory Field Signals display — Frontend owns the read display. AOS writes; Frontend reads.
- Backup coordination — Backblaze B2 managed separately. Drive is the queryable external layer.
- Engine computation — AOS receives engine findings and routes them externally. It does not compute or own engine output.

---

## DATABASE LOCATIONS

| Table | Database | Type | Retention |
|-------|----------|------|-----------|
| aos_records | Integration DB | PostgreSQL | Permanent — never deleted |
| daily_pipeline_log | Operational DB | SQLite | Operational state |

OAuth refresh tokens: `backend/.env` only. Never stored in any database.

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE: aos_records
DATABASE: Integration DB (PostgreSQL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Automated Observation Signal records. The mechanism by which the
system reaches Sage externally when significant patterns are
detected. Permanent — never deleted. Every AOS event is a
permanent record in the system regardless of delivery outcome.

Write authority: AOS service (backend/services/aos.py).
Triggering systems (Emergence, MTM, SGR, DTX, PCV, Void, Sage
manual) call the AOS service — they do not write AOS records
directly. One write path, one place for integrity hash enforcement
and delivery rules.

Read authority: Observatory Field Signals (read-only display),
AOS service (delivery tracking), research assistant (historical
queries).

  aos_id               — text, primary key
                         UUID generated at record creation.

  signal_type          — text, NOT NULL
                         Classification of the signal event.
                         Examples: 'absence_detected' | 'paradigm_shift'
                           | 'tier_1_signal' | 'trajectory_shift'
                           | 'threshold_crossing' | 'engine_stale'
                           | 'embedding_failed' | 'correction_rate'
                           | 'recalibration_recommended' | 'sage_manual'

  system               — text, NOT NULL
                         Which system triggered the AOS.
                         enum: 'emergence' | 'mtm' | 'sgr' | 'dtx'
                               | 'pcv' | 'void' | 'engine_computation'
                               | 'embedding_pipeline' | 'sage'

  event                — text, NOT NULL
                         Specific event description. Human-readable.
                         Example: "SGR tier 1 signal graded — s09 PCV
                         convergence at 0.91"

  summary              — text, NOT NULL
                         AI-composed summary of the signal event.
                         Included in email body.

  evidence_list        — jsonb, NOT NULL
                         Structured list of evidence references:
                         deposit_ids, finding_ids, hypothesis_ids
                         that support this signal. Empty array if
                         no specific records are referenced.
                         Example: {"deposit_ids": ["d-abc"], "finding_ids": []}

  sage_note            — text, nullable
                         Free-text note from Sage. Only populated
                         on Sage-triggered AOS (trigger_mode = 'sage').
                         The only place Sage's voice enters an AOS
                         record directly.

  integrity_hash       — text, NOT NULL
                         Derived from evidence_list reference_ids +
                         engine state + created_at timestamp. Written
                         to AOS record and email footer. The email's
                         content can be verified against system state
                         at the time it was sent.

  trigger_mode         — text, NOT NULL
                         enum: 'engine' | 'sage'
                         engine: automatic trigger from system.
                         sage: manual trigger from analytical surface
                           (deposit card, Void output panel, PCV
                           hypothesis card, MTM finding).

  delivery_type        — text, NOT NULL
                         enum: 'immediate' | 'digest'
                         immediate: high-signal events — Void type D,
                           SGR tier 1, MTM paradigm_shift, PCV
                           threshold crossing, baseline recalibration,
                           all Sage-triggered events.
                         digest: lower-signal events — engine stale,
                           embedding failed_permanent, correction rate
                           exceeded. Batched into daily 11:11 PM email.
                         Configurable per trigger type.

  delivery_error       — text, nullable
                         Error message if email delivery failed.
                         Null on successful delivery or pending delivery.
                         Record persists regardless of delivery outcome.

  delivered_at         — timestamp, nullable
                         When the AOS was delivered (email sent).
                         Null if pending delivery, queued for digest,
                         or delivery failed.

  created_at           — timestamp, NOT NULL


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE: daily_pipeline_log
DATABASE: Operational DB (SQLite)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cron run records for the 11:11 PM daily pipeline. One record
per pipeline run. Tracks completion status of each step and
any failure messages. Operational state — not research data.

Write authority: AOS service daily pipeline function.
Read authority: Observatory Pulse node (system alerts),
AOS service (failure detection, retry awareness).

  log_id               — text, primary key
                         UUID generated at pipeline start.

  run_date             — text, NOT NULL
                         ISO date string: YYYY-MM-DD.
                         The date the pipeline ran for (not
                         necessarily the calendar date of run).

  started_at           — timestamp, NOT NULL

  completed_at         — timestamp, nullable
                         Null if pipeline is in progress or crashed.

  snapshot_generated   — integer, NOT NULL, default 0
                         Boolean (0/1). Snapshot JSON generated
                         from PostgreSQL.

  drive_snapshot        — integer, NOT NULL, default 0
                         Boolean (0/1). Snapshot uploaded to Drive.

  drive_seeds          — integer, NOT NULL, default 0
                         Boolean (0/1). Session seeds uploaded to Drive.

  drive_exports        — integer, NOT NULL, default 0
                         Boolean (0/1). Manual exports uploaded to Drive.

  charts_rendered      — integer, NOT NULL, default 0
                         Boolean (0/1). Engine chart images rendered.

  email_sent           — integer, NOT NULL, default 0
                         Boolean (0/1). Daily summary email delivered.

  error_messages       — text, nullable
                         JSON array of error strings, one per failed
                         step. Null if all steps succeeded.
                         Example: ["Drive upload failed: timeout",
                                   "Chart render failed: engine_stale"]

  pipeline_status      — text, NOT NULL
                         enum: 'running' | 'complete' | 'partial' | 'failed'
                         complete: all steps succeeded.
                         partial: some steps succeeded, some failed.
                         failed: pipeline crashed before any step completed.


---

## TRIGGER REGISTRY

### Engine triggers

| Signal type | Source system | Delivery type | Notes |
|-------------|--------------|---------------|-------|
| absence_detected (type A or D) | void | immediate | Void type A: no deposit in N sessions. Type D: irreversible absence. |
| paradigm_shift | mtm | immediate | MTM cross-domain finding. |
| tier_1_signal | sgr | immediate | Highest graded signal. |
| trajectory_shift | dtx | immediate | DTX acceleration or reversal classified. |
| threshold_crossing | pcv | immediate | New hypothesis from engine output. |
| engine_stale | engine_computation | digest | Engine has not computed beyond configurable window. |
| embedding_failed | embedding_pipeline | digest | Permanent embedding failure — will not auto-retry. |
| correction_rate | integration | digest | Correction rate threshold exceeded. |
| recalibration_recommended | engine_computation | immediate | See recalibration trigger detail below. |

### Sage triggers

Any analytical surface → Sage initiates → trigger_mode = 'sage' → delivery_type = 'immediate'.

| Surface | Event |
|---------|-------|
| Deposit card | Sage triggers from expanded card view |
| Void output panel | Sage triggers from on-demand read (open or targeted) |
| PCV hypothesis card | Sage triggers from hypothesis surface |
| MTM finding | Sage triggers from finding surface |

sage_note (optional free-text) is the only place Sage's voice enters an AOS record directly.

### Recalibration trigger detail

**Fires when:**
- Corpus size crosses 2× multiplier since last calibration
- Engine output variance exceeds threshold over N sessions (N and threshold are calibration items — set per engine)

**AOS record carries:**
```
engine:                       string — which engine recommends recalibration
current_corpus_size:          integer
last_calibration_corpus_size: integer
variance_signal:              float | null
recommendation:               string — plain language description
impact_summary:               string — what changes if approved
```

**Sage options:** approve | defer (N sessions) | decline.
Decline defers with configurable window — does not suppress permanently.

**Post-recalibration:** baseline version marker written to all future engine outputs. Pre- and post-recalibration outputs are distinguishable in the record. Longitudinal analysis can account for the threshold shift.


---

## DELIVERY PIPELINE

### Immediate path

```
Trigger received by AOS service
→ AOS record created (integration hash, delivery_type = 'immediate')
→ Email composed: signal_type + system + event + AI summary
    + evidence_list + sage_note (if present) + integrity_block
→ Larimar Gmail sends to Threshold Studies
→ On success: delivered_at written
→ On failure: delivery_error written, error surfaces in Observatory Pulse
```

### Digest path (daily 11:11 PM cron)

```
APScheduler fires daily pipeline at 23:11
→ Step 1: generate snapshot JSON from PostgreSQL
→ Step 2: upload snapshot to Drive/daily/YYYY-MM-DD/snapshot.json
→ Step 3: upload session seeds captured today
→ Step 4: upload manual exports triggered today
→ Step 5: verify all uploads succeeded
→ Step 6: render engine chart images (matplotlib/plotly → PNG)
→ Step 7: compose daily summary email with digest AOS records + charts
→ Step 8: Larimar sends to Threshold Studies
→ Step 9: log pipeline result to daily_pipeline_log (Operational DB)
→ On step failure: log error, send failure alert email (if Gmail is not
    the failure point), continue remaining steps that can proceed,
    surface failure in Observatory Pulse node
```

### OAuth configuration

Two Google accounts, two refresh tokens:

| Account | Scope | Direction | Token |
|---------|-------|-----------|-------|
| Larimar | gmail.send | Push only — sends to Threshold Studies | LARIMAR_REFRESH_TOKEN in .env |
| Threshold Studies | drive (full read/write) | Push AND pull — two-way Drive pipeline | THRESHOLD_STUDIES_REFRESH_TOKEN in .env |

One-time browser authorization per account. Tokens auto-refresh — no further Sage interaction after initial setup. Any FastAPI service accesses both accounts via `backend/services/google.py`.


---

## EMAIL STRUCTURES

### Immediate event email

```
Subject: [signal_type] — [system] — [event short description]

signal_type: [value]
system:      [value]
event:       [value]

[AI-composed summary]

Evidence:
  [deposit_ids, finding_ids, hypothesis_ids]

[sage_note — present only on Sage-triggered AOS]

---
Integrity: [hash] · System state at [created_at timestamp]
```

### Daily digest email

```
Subject: Aelarian Archives — Daily Summary [YYYY-MM-DD]

Deposits today:    [count] ([delta from yesterday]) across [page list]
Patterns active:   [PCV/DTX/SGR activity summary]
Findings above threshold: [count, brief descriptions]
Null observations: [count]
Session seeds:     [count, agent_ids]
System health:     [embedding failures, stale engines, connection status]
Drive upload:      [succeeded / failed]

[Engine findings above threshold — brief summaries]

[Digest AOS events — any lower-signal events accumulated today]

[Engine chart images — PNG attachments rendered backend]

---
Daily snapshot uploaded: Drive/Aelarian Archives/daily/[date]/
```

### Failure alert email

Sent when a pipeline step fails and Gmail is not the failure point.

```
Subject: AOS Pipeline Failure — [YYYY-MM-DD]

Pipeline run: [log_id]
Failed steps: [list from error_messages]
Steps completed: [list]

Manual review required. AOS records are preserved in Integration DB.
```


---

## FAILURE HANDLING SUMMARY

| Failure | Behavior |
|---------|---------|
| Email delivery fails | delivery_error written to aos_records. delivered_at null. Observatory Pulse surfaces failure. |
| Drive upload fails | Step logged as failed in daily_pipeline_log. Failure alert email sent (Gmail permitting). Pipeline continues with remaining steps. |
| Gmail unavailable | delivery_error on all pending aos_records. Pipeline log marks email_sent = 0. Pulse surfaces failure. Records preserved — available for retry when connectivity restores. |
| APScheduler missed run | Log gap detectable by audit query on daily_pipeline_log (missing run_date). |
| Pipeline crash | completed_at remains null. pipeline_status = 'failed'. Detectable at next startup. |
