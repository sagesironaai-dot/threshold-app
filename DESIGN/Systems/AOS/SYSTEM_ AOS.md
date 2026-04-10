# SYSTEM: AOS

## /DESIGN/Systems/AOS/

### Automated Observation Signal · external notification · Google delivery pipeline

---

## WHAT THIS SYSTEM OWNS

* Signal detection routing — listens for trigger events from engine systems and Sage manual actions; determines delivery type (immediate or digest)
* AOS record creation — single write path for all AOS events. Triggering systems call the AOS service; they do not write records directly.
* Integrity hash enforcement — derived from reference_ids + engine state + timestamp at record creation. Written to both the AOS record and the email footer. The email's content can be verified against system state at time of send.
* Email composition — AI-composed summary, evidence list, sage_note (if present), integrity block. Engine chart images (PNG) attached on daily digest.
* Gmail delivery — Larimar account sends to Threshold Studies account. OAuth refresh tokens managed by service; no interaction required from Sage after initial authorization.
* Google Drive pipeline — daily upload of snapshot, session seeds, and manual exports to Threshold Studies Drive. Two-way: the same token that pushes also lets the AI read back historical snapshots.
* 11:11 PM daily cron — orchestrated via APScheduler integrated with FastAPI. Runs snapshot generation, Drive uploads, and daily summary email as a sequential pipeline. Each step logged.
* Daily pipeline logging — result of each cron run written to `daily_pipeline_log` in Operational DB (SQLite).
* aos_records table — permanent record of every AOS event. Stored in Integration DB (PostgreSQL). Never deleted.

## WHAT THIS SYSTEM DOES NOT OWN

* Signal production — engine systems (MTM, SGR, DTX, PCV, Void, Emergence) detect patterns and trigger AOS. AOS receives the trigger; it does not run detectors or own engine output.
* Sage decision-making — AOS surfaces signals and delivers notifications. Sage decides how to respond (approve/defer/decline on recalibration requests; no response required on informational signals).
* Observatory Field Signals display — owned by Frontend. AOS writes records; Frontend reads them. AOS has no display logic.
* Backup integrity — Backblaze B2 backup is managed separately. Drive is the queryable external layer, not the sole backup. AOS does not own or coordinate B2.
* Research assistant archive access — Origins and the research assistant can query Drive for historical snapshots. AOS produces those snapshots; it does not own or serve the query interface.

---

## TWO-LAYER ARCHITECTURE

### Signal layer

Engine trigger fires or Sage triggers manually →
AOS service receives the trigger event →
Record created with signal_type, system, event, evidence_list →
Integrity hash computed (reference_ids + engine state + timestamp) →
delivery_type assigned (immediate or digest) →
AOS record written to Integration DB →
Delivery instruction passed to delivery layer.

### Delivery layer

**Immediate path:** AOS record → email composed → Larimar sends to Threshold Studies → delivered_at written on success; delivery_error written on failure.

**Digest path:** AOS records queued → daily 11:11 PM cron → batch composed with engine chart images → Larimar sends to Threshold Studies → delivered_at written on all records in batch.

**Drive pipeline (daily, inside cron):** snapshot generated from PostgreSQL → uploaded to Drive daily folder → session seeds uploaded → manual exports uploaded → all steps verified → result logged to daily_pipeline_log.

---

## TRIGGER REGISTRY

### Engine triggers (automatic)

| Trigger | Source system | Delivery type |
|---------|--------------|---------------|
| Void type A or D absence detected | Void | Immediate |
| MTM paradigm_shift or cross_domain finding | MTM | Immediate |
| SGR tier 1 signal graded | SGR | Immediate |
| DTX acceleration or reversal classified | DTX | Immediate |
| PCV threshold crossing (new hypothesis from engine output) | PCV | Immediate |
| Engine stale beyond configurable window | Engine Computation | Digest |
| Embedding failed_permanent | Embedding Pipeline | Digest |
| Correction rate threshold exceeded | Integration | Digest |
| Baseline recalibration recommended | Engine Computation | Immediate |

**Baseline recalibration trigger detail (Item 13):**
Fires when corpus size crosses 2× multiplier since last calibration, or engine output variance exceeds threshold over N sessions (N and threshold are calibration items). AOS record carries: engine, current_corpus_size, last_calibration_corpus_size, variance_signal, recommendation, impact_summary. Sage options: approve | defer (N sessions) | decline. Decline defers with configurable window — does not suppress permanently. Post-recalibration: baseline version marker written to all future engine outputs. Pre- and post-recalibration outputs are distinguishable in the record.

### Sage triggers (manual)

Sage triggers an AOS from any analytical surface. Sage may add a free-text sage_note before sending — this is the only place Sage's voice enters an AOS record directly.

| Surface | Trigger action |
|---------|---------------|
| Deposit card | Trigger from expanded card view |
| Void output panel | Trigger from on-demand read output (open or targeted) |
| PCV hypothesis card | Trigger from hypothesis surface |
| MTM finding | Trigger from finding surface |

Sage-triggered AOS: trigger_mode = 'sage'. Delivery type defaults to immediate. sage_note is optional.

---

## DELIVERY

### Immediate delivery

High-signal events delivered as individual emails without delay.

Triggers: Void type D, SGR tier 1, MTM paradigm_shift, PCV threshold crossing, baseline recalibration recommended, all Sage-triggered events.

### Digest delivery

Lower-signal events batched and delivered in the daily 11:11 PM email.

Triggers: engine stale, embedding failed_permanent, correction rate exceeded.

### Delivery type is configurable per trigger

Default assignments above. Configurable without code change.

### Email structure

```
signal_type: [classification]
system:      [source system]
event:       [specific event description]
summary:     [AI-composed summary of the signal event]
evidence:    [deposit_ids, finding_ids, hypothesis_ids supporting this signal]
sage_note:   [present only on Sage-triggered AOS]
---
integrity:   [hash] · verified against system state at [timestamp]
```

Daily digest email also includes engine chart images (matplotlib/plotly → PNG, rendered backend before send).

---

## FAILURE HANDLING

### Email delivery failure

If Gmail send fails: `delivery_error` written to `aos_records` record. `delivered_at` remains null. Error logged to `daily_pipeline_log`. Signal surfaces in Observatory **Pulse** node (system alerts). AOS record is permanent regardless of delivery outcome.

### Drive pipeline failure

If any pipeline step fails: error logged to `daily_pipeline_log`, failure alert email sent (if Gmail is not the failure point), remaining steps that can proceed continue. Each step is independently logged — partial success is preserved.

### Both channels down

AOS record persists in Integration DB. Pulse node surfaces the failure. Record is available for manual review and retry when connectivity restores.

---

## OBSERVATORY INTEGRATION

**Field Signals (node 3):** read-only display of AOS records. Frontend queries `aos_records` directly. No write path from Observatory. Display fields: signal_type, system, event, summary, delivery_type, created_at, delivered_at.

**Pulse (node 8):** receives system alerts including delivery failures and pipeline errors. AOS surfaces failure state here when email/Drive delivery is unavailable.

---

## FASTAPI INTEGRATION

| Route | Purpose |
|-------|---------|
| `POST /aos/trigger` | Receive trigger from engine system or Sage manual action. Creates AOS record and initiates delivery. |
| `GET /aos/records` | Read AOS records. Used by Observatory Field Signals. |

| Service file | Purpose |
|-------------|---------|
| `backend/services/aos.py` | Signal routing, record creation, integrity hash, delivery instruction |
| `backend/services/google.py` | Gmail OAuth client (Larimar send, Threshold Studies inbox), Drive client (upload, download, search) |

**Scheduler:** APScheduler integrated with FastAPI. Cron job registered at startup. Fires at 11:11 PM daily. Calls `google.py` daily pipeline function sequentially.

**OAuth:** Two Google accounts, two refresh tokens stored in `backend/.env`. One-time browser authorization per account. Tokens auto-refresh — no further Sage interaction required. Any FastAPI service can use both tokens via `google.py`.

---

## STORAGE SUMMARY

| Data | Location | Retention |
|------|----------|-----------|
| aos_records | Integration DB (PostgreSQL) | Permanent — never deleted |
| daily_pipeline_log | Operational DB (SQLite) | Operational state |
| OAuth refresh tokens | backend/.env | Not in DB |
| Drive folder structure | Defined below — runtime state | Managed by AOS service |

**Drive folder structure:**

```
Threshold Studies Drive/
  Aelarian Archives/
    daily/
      YYYY-MM-DD/
        snapshot.json          — archive shape at this date (not full data)
        session_seeds/
          session_[id].json
        exports/               — manual exports triggered this day
    manual/                    — on-demand exports from Export panel
      YYYY-MM-DD_[page]_export.[format]
```

Dated folders. Never overwritten. Each day is a new folder. If nothing happened, folder is still created with empty manifest — confirms the system ran.

**Daily snapshot contents (structured JSON, lightweight, queryable):**
- Total deposits (count, delta from yesterday)
- Deposits per page (count + page_code)
- Active patterns in PCV/DTX/SGR (summary, not full data)
- Engine findings above threshold (graded signals)
- Null observations logged today
- Session seeds captured (count, agent_ids)
- Tag usage distribution (top tags, new tags)
- Semantic map state (cluster count, coverage percentage)
- Engine health (stale flags, last compute timestamps)
- System health (embedding failures, connection status)

The snapshot is a research instrument, not a backup. It captures the shape of the archive at a point in time. Swarm utility: Origins can query Drive for historical snapshots — "what did the field look like on date X?" without querying the full database.
