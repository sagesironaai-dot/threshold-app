# METAMORPHOSIS SCHEMA

## MTM · V1

## /DESIGN/Systems/Metamorphosis/METAMORPHOSIS SCHEMA.md

Mechanical spec — synthesis sequence, fingerprinting, deduplication, stores,
validation, failure modes. Architectural description in SYSTEM_ Metamorphosis.md.

---

## OWNERSHIP BOUNDARIES

### OWNS

- Synthesis cycle — the full MTM operation from lens page read through Finding production
- Claude API call for synthesis — system prompt assembly, data payload construction, response handling
- Lens page data assembly — pulling and structuring all five lens page datasets before the API call
- Finding production — extracting, validating, and writing Finding records from the Claude API response
- Content fingerprinting — generating and writing the content_fingerprint on every Finding record
- Deduplication check on retry — comparing candidate Findings against prior session Findings before writing or routing anything
- LNV routing handoff — assembling the result object returned to DNR. MTM's responsibility ends there.
- synthesis_sessions PostgreSQL table
- findings PostgreSQL table

### DOES NOT OWN

- Lens page deposit writing — owned by their respective sections (THR · STR · INF · ECR · SNM)
- PostgreSQL reads of lens page entry data — owned by FastAPI service layer (backend/services/)
- LNV deposit writing — owned by LNV
- Routine orchestration and trigger — owned by DNR. MTM never calls itself. DNR calls MTM.
- WSC — Witness Scroll is sovereign. MTM has no relationship to it.
- Tag pipeline — owned by tagger service
- Routing authority — owned by SOT
- Findings content after handoff — once the result object is returned to DNR, MTM does not track what LNV does with what it receives
- lnv_routing_status and lnv_deposit_id writes — after DNR confirms LNV has received a Finding, the FastAPI service layer writes lnv_routing_status → deposited and populates lnv_deposit_id on the findings record. DNR triggers this write. MTM does not.

---

## STRUCTURAL RULES

1. MTM never receives deposits. Synthesis only.

2. Synthesis cycle fires when DNR triggers the MTM synthesis endpoint
   (POST /mtm/synthesize) at session close only. Never triggered by deposit
   events. Never self-triggered.

3. All five lens pages read simultaneously — never sequentially, never
   partially. Simultaneously means one Claude API call with all five datasets
   present. Not five calls. One.

4. Findings are the only named output type. Not summaries. Not observations.
   Not patterns.

5. Every Finding carries traceable source_pattern_refs to specific lens pages
   and deposit ids.

6. Findings route to LNV (47) only — via DNR handoff. MTM does not write to
   LNV directly.

7. A synthesis cycle that cannot read all five lens pages simultaneously does
   not produce Findings. Status → failed, failure_type → pre_synthesis. Retry
   permitted at next session close.

8. Deduplication runs on every retry where prior_mtm_session_ids is present.
   It never runs on a clean first-time synthesis. A Finding that matches a
   fingerprint from any prior session in the current window is skipped — not
   written, not routed.

---

## TRIGGER DEFINITION

MTM fires as Step 1 of the Daily Nexus Routine only.

DNR triggers the MTM synthesis endpoint (POST /mtm/synthesize) and awaits its
resolution before proceeding to Step 2. POST /mtm/synthesize is the sole public
entry point into this system. Everything inside MTM is internal to that call.

MTM never calls itself. There is no scheduled trigger, no deposit event trigger,
no internal retry. All retry logic lives in DNR. MTM receives a call, runs, and
returns a result object. That is its complete contract with the outside world.

---

## LENS PAGE READ SPEC

### What is pulled

All entries where section ∈ { thr, str, inf, ecr, snm }. Queried from
PostgreSQL via FastAPI service layer at synthesis time. Always fetched fresh —
never from a cached corpus. The corpus at synthesis time is the corpus MTM reads.

### Fields pulled per entry

- id — entry identifier for source_pattern_refs
- section — which lens page this entry belongs to
- body — the deposit content
- tags — full resolved tag array with routing
- phase_state — ontological threshold state at tagging time
- originId — origin node affinity if present
- created_at — timestamp for temporal ordering

### Structure before the API call

Entries are grouped by section into five named datasets:

```json
{
  "THR": [ ...entries ],
  "STR": [ ...entries ],
  "INF": [ ...entries ],
  "ECR": [ ...entries ],
  "SNM": [ ...entries ]
}
```

All five datasets are present in a single API call payload. If any dataset is
missing because the section has no entries: the dataset is an empty array. An
empty array is not a missing lens page. Synthesis proceeds. A lens page is only
unavailable if the database read fails for that section. That failure triggers
pre_synthesis abort.

### Empty lens page handling

When a lens page returns an empty array because the database read succeeded but
the section has zero entries, the payload explicitly includes the key with an
empty array and a note:

```json
"THR": { "entries": [], "note": "no entries" }
```

All five keys are always present in the payload. Absence of data is structurally
different from absence of the key. Claude receives five datasets every time —
populated or empty. Without explicit empty markers, Claude may treat missing
data as a parsing error rather than a valid corpus state. On a small corpus
where three of five lens pages have no entries yet, Claude still sees all five
keys and knows the empty arrays are intentional.

### Simultaneously

One Claude API call. All five datasets in the payload. The AI reads the full
field in a single context window — not five separate reads accumulated across
calls. This is structurally non-negotiable.

---

## CLAUDE API CALL STRUCTURE

### System prompt

DNR passes the system prompt to MTM as a parameter when calling
POST /mtm/synthesize. The prompt is assembled from the global identity context
(api/prompts/) by DNR before the call. MTM does not load or configure its own
system prompt. MTM appends a synthesis directive that specifies:

- You are reading across five Axis lens pages simultaneously. THR · STR · INF · ECR · SNM. All five are present in this call.
- Your function is to surface what becomes visible only when all five are held simultaneously. The missed pattern. The structure no single lens contained.
- The Pillars handoff event is documented origin — not metaphor, not archetype. Hold its weight.
- Produce Findings only. Not summaries. Not observations. Not patterns. A Finding is a named, structured output traceable to specific source patterns across the five lens pages.
- Every Finding must name: its title, its content, and at minimum one source_pattern_ref per lens page it draws from. A Finding with no traceable source is not a Finding.
- Respond in valid JSON only. No preamble. No markdown. No explanation outside the JSON structure.

### Data payload

The five-dataset object is serialized and included in the user message alongside
the synthesis directive.

Message structure:

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "[synthesis directive] + JSON.stringify(datasets)"
    }
  ]
}
```

### Response format — required JSON shape

Claude returns a JSON object. MTM parses this directly.

```json
{
  "findings": [
    {
      "title": "string — required",
      "content": "string — required",
      "source_pattern_refs": [
        {
          "page_code": "THR | STR | INF | ECR | SNM",
          "deposit_id": "entry id from that lens page",
          "note": "what this source contributed"
        }
      ]
    }
  ]
}
```

Constraints on source_pattern_refs:
- Minimum one ref per Finding
- Minimum one ref per lens page drawn from

An empty findings array is a valid response. It means the field held
simultaneously produced no pattern that wasn't visible in a single lens. That
is data. It is not a failure.

### Response handling

Parse JSON response. Validate each Finding against the explicit validation
criteria (see FINDING VALIDATION CRITERIA below). Invalid Findings are dropped
and counted in findings_dropped with the specific failure reason logged. Not
written. Not routed. A Finding that cannot be validated has no structural
integrity and does not enter the archive.

If JSON parsing fails entirely: status → failed, failure_type → mid_synthesis.
Whatever valid Findings were written before the parse failure are preserved.

---

## CONTENT FINGERPRINTING

### What it is

A deterministic string derived from the Finding's source_pattern_refs. It is the
structural identity of the Finding — not its content, its provenance. Two
Findings that draw from the same source deposits in the same lens pages produce
the same fingerprint. That is the definition of a duplicate.

### How it is generated

1. Collect all source_pattern_refs for the Finding.
2. Sort by page_code ascending, then deposit_id ascending.
3. Concatenate: `page_code + ':' + deposit_id` for each ref.
4. Join with `|`.

The resulting string is the content_fingerprint.

Example:

```
refs: [
  { page_code: "ECR", deposit_id: "TS·ECR·EMG·2026-03·0004" },
  { page_code: "THR", deposit_id: "TS·THR·EMG·2026-03·0011" }
]

sorted: ECR first, THR second

fingerprint: "ECR:TS·ECR·EMG·2026-03·0004|THR:TS·THR·EMG·2026-03·0011"
```

### Semantic duplicate limitation

The content fingerprint guarantees structural deduplication — the same sources
producing the same finding won't write twice. It does not guarantee semantic
deduplication — if Claude selects different deposits to support the same insight
on retry, the fingerprint diverges and both findings write.

This is a deliberate tradeoff. Semantic deduplication would require comparing
finding content, which introduces interpretation into what should be a mechanical
process. LNV surfaces both findings. Sage resolves semantic overlap through the
research record, not the pipeline.

### Fingerprint collision

Two genuinely distinct Findings may theoretically produce the same fingerprint
if they draw from exactly the same source deposits but surface different patterns
from them. This is a known risk. Handling:

- The fingerprint match triggers a skip on retry.
- If Sage identifies a legitimate Finding was skipped due to collision, the
  Finding can be manually deposited to LNV as a native entry with MTM provenance
  noted.
- Collision frequency should be logged. If collisions are frequent, the
  fingerprint algorithm is revisited. This is a calibration concern, not an
  architectural one.

---

## FINDING VALIDATION CRITERIA

A Finding is valid if and only if all four conditions pass. A Finding that fails
any condition is dropped and counted in findings_dropped with the specific
failure reason logged.

1. **title present** — string, non-null, non-empty.
2. **content present** — string, non-null, non-empty.
3. **source_pattern_refs present and non-empty** — array with at minimum one
   entry. Each entry must have page_code, deposit_id, and note. A Finding with
   no traceable source is not a Finding.
4. **content_fingerprint generation succeeds** — fingerprint computed from
   source_pattern_refs before write. If generation fails, the Finding is
   dropped. A Finding cannot be written without a fingerprint.

A Finding that passes all four is written. One that fails any is dropped.
These are the drop conditions — not implementation detail, schema definition.
Without this enumeration, "validate each Finding" is a variable behavior at
build time.

Drop reasons logged per Finding:

```
missing_title | missing_content | empty_source_refs |
invalid_source_ref | fingerprint_failed
```

---

## DEDUPLICATION CHECK

Runs on every retry where prior_mtm_session_ids is present in the synthesis
endpoint call options. Never runs on a clean first-time synthesis —
prior_mtm_session_ids is null on clean runs and the check is skipped entirely.

### Session window definition

A session window is the set of all synthesis_session records linked to
routine_session records within the current DNR session — from the first failed
run through the current retry. DNR passes all failed mtm_session_ids for the
current window, not just the most recent. This is the only way to catch
duplicates across multiple consecutive retries.

Example:

```
Run 1 fails   — mtm_session_id: A — 3 Findings written
Retry 1 fails — mtm_session_id: B — 2 Findings written
Retry 2 fires — receives prior_mtm_session_ids: [A, B]

prior_fingerprints Set contains fingerprints from both A and B.
Retry 2 cannot duplicate either.
```

### Sequence

1. Load all findings records where synthesis_session_ref ∈
   prior_mtm_session_ids array. Build a Set of their content_fingerprints.
   Call this the prior_fingerprints set.

2. For each candidate Finding extracted from the Claude API response:
   - a. Generate its content_fingerprint.
   - b. Check against prior_fingerprints.
   - c. If match found: skip. Do not write. Do not route. Log the skip —
     fingerprint, Finding title, prior session id.
   - d. If no match: write to PostgreSQL, add fingerprint to
     prior_fingerprints, proceed.

3. Only new Findings — those not present in any prior failed session in the
   current window — are written and included in the result object's findings
   array.

### Why this order matters

The deduplication check uses prior session findings, not the current session's.
A Finding produced earlier in the same retry run is not checked against itself —
only against what came from prior failed runs. Within a single synthesis call,
Claude does not produce structural duplicates. Across runs on the same corpus,
it can and will.

---

## SYNTHESIS RESULT OBJECT

The exact shape returned to DNR on every call — success or failure. DNR reads
this object. Nothing else.

```json
{
  "status": "complete | failed",

  "failure_type": "null | pre_synthesis | mid_synthesis",

  "findings": [],

  "findings_count": 0,

  "findings_dropped": 0,

  "mtm_session_id": "string",

  "synthesis_duration_ms": 0
}
```

Field definitions:

- **status** — `complete` or `failed`.
- **failure_type** — null on complete runs. `pre_synthesis` if lens page read
  failed. `mid_synthesis` if Claude API call or JSON parse failed.
- **findings** — array of Finding records produced in this cycle. Empty array on
  pre_synthesis failure or clean run with no patterns. Partial array on
  mid_synthesis failure. New Findings only on retry — deduplicated against prior
  session.
- **findings_count** — integer. Count of findings array. Written for LNV display.
  If 0 and findings_dropped > 0, LNV surfaces the drop count alongside the
  empty result.
- **findings_dropped** — integer. Count of candidates that were dropped at
  validation, skipped by deduplication, or lost to fingerprint failure. Zero on
  clean runs. DNR passes this to LNV alongside findings_count.
- **mtm_session_id** — the synthesis_sessions record id for this cycle. Always
  present — the record is created at cycle start before any failure can occur.
- **synthesis_duration_ms** — integer. Wall-clock time from session record
  creation to status write (complete or failed). Computed at result assembly.
  Surfaces in LNV alongside findings_count and findings_dropped. Makes synthesis
  performance visible without requiring a database join on the session record.

MTM's contract with DNR ends when this object resolves. What DNR does with it
is DNR's concern.

---

## STORE: synthesis_sessions

| Field | Type | Description |
| --- | --- | --- |
| id | auto | Primary key |
| session_date | timestamp | Written when record is created. Never updated. |
| status | enum | `in_progress`, `complete`, `failed`. in_progress: cycle executing. complete: all Findings produced. failed: cycle did not complete, retry permitted via DNR. |
| lens_pages_read | array of strings | Page codes confirming which lens pages were read. Expected: [THR, STR, INF, ECR, SNM]. If any read failed: status → failed, failure_type → pre_synthesis. |
| findings_count | integer | Count of Findings successfully written. Written when cycle completes. Null if in_progress or failed. |
| findings_dropped | integer | Count of candidates dropped at validation, deduplication, or fingerprint failure. Written when cycle completes. Null if in_progress or failed. Zero is valid. If findings_count is 0 and findings_dropped > 0, the session completed but produced no usable output. LNV surfaces this distinction. |
| failure_type | enum | null, `pre_synthesis`, `mid_synthesis`. Null on complete runs. Written on failed runs. |
| dedup_skipped | boolean | false on clean first-time runs and on retries where prior session load succeeded. true when prior_mtm_session_ids was passed but prior session findings could not be loaded — deduplication did not run. Null until synthesis step 3 executes. A true value means LNV should treat all Findings from this cycle as potentially containing duplicates. |
| synthesis_duration_ms | integer | Wall-clock time in milliseconds from record creation to status write. Computed at result assembly. Surfaces in LNV for performance visibility. |
| created_at | timestamp | Written once at record creation. Never updated. |

---

## STORE: findings

| Field | Type | Description |
| --- | --- | --- |
| id | auto | Primary key |
| synthesis_session_ref | foreign key | References synthesis_sessions.id |
| title | string | Named output. Required. A Finding without a name is not a Finding. |
| content | text | The full structured output of the Finding. What became visible only when all five lenses were held simultaneously. |
| source_pattern_refs | array of objects | Traceable links to source patterns. Element structure: { page_code, deposit_id, note }. page_code: lens page the pattern was read from. deposit_id: specific deposit that carried the pattern. note: what this source contributed. Minimum one ref per Finding. |
| content_fingerprint | string | Deterministic key derived from source_pattern_refs at Finding production time. Used for deduplication on retry runs. Never null. Never updated after write. See CONTENT FINGERPRINTING. |
| lnv_routing_status | enum | `pending`, `deposited`, `failed`. pending: Finding produced, LNV deposit not yet written. deposited: successfully routed to LNV (47) via DNR handoff. failed: LNV deposit attempt failed, retry permitted. |
| lnv_deposit_id | foreign key | References LNV deposit entry id. Null until lnv_routing_status → deposited. |
| created_at | timestamp | Written once at record creation. Never updated. |

---

## SYNTHESIS SEQUENCE

Fires when DNR triggers the MTM synthesis endpoint (POST /mtm/synthesize).
options.prior_mtm_session_ids is present on retry runs. options is null or
empty on clean first-time runs.

1. **Create synthesis_session record.** Write status → in_progress. Write
   session_date and created_at. mtm_session_id is now available for the result
   object regardless of what happens next.

2. **Read all five lens pages simultaneously from PostgreSQL:**
   THR (02) · STR (03) · INF (04) · ECR (05) · SNM (06).
   Write lens_pages_read. If any database read fails: write status → failed,
   write failure_type → pre_synthesis. Return result object. Halt.

3. **Deduplication setup.** If options.prior_mtm_session_ids is present: load
   all findings records from all failed sessions in the current session window —
   not just the most recent. See DEDUPLICATION CHECK for window definition.
   Build prior_fingerprints Set from their content_fingerprints. Write
   dedup_skipped → false. If prior session load fails: log the failure, write
   dedup_skipped → true on the synthesis_session record. Proceed without
   deduplication. Do not halt — a failed dedup load is not a synthesis failure.
   If options.prior_mtm_session_ids is absent: write dedup_skipped → false.
   Skip dedup entirely.

4. **Assemble payload and call Claude API.** Assemble five-dataset payload.
   Call Claude API with system prompt and data payload. If API call fails: write
   status → failed, failure_type → mid_synthesis. Return result object with
   whatever findings were written before failure. Halt.

5. **Parse and validate response.** Parse JSON response. Validate each Finding.
   Maintain a dropped_count integer starting at 0. Drop invalid Findings —
   increment dropped_count, log each drop with reason. For each valid Finding:
   - a. Generate content_fingerprint. If generation fails: increment
     dropped_count, log, skip. Do not write.
   - b. If prior_fingerprints Set exists: check fingerprint. If match found:
     increment dropped_count, log skip. Do not write.
   - c. Write findings record to PostgreSQL.
   - d. Add fingerprint to prior_fingerprints if Set exists.

6. **Write counts.** Write findings_count to synthesis_session record. Write
   findings_dropped from dropped_count to synthesis_session record.

7. **Write status → complete.**

8. **Assemble and return result object to DNR.**

---

## PUBLIC API

### POST /mtm/synthesize

The sole public entry point. Called by DNR only. Never called directly from any
other system.

**Options** — optional object:

```json
{
  "prior_mtm_session_ids": ["string"] | null
}
```

Present on retry runs. DNR passes the full array of all failed mtm_session_ids
from the current session window — not just the most recent. Null or absent on
clean first-time runs.

**Returns:** result object as defined in SYNTHESIS RESULT OBJECT section. Always
resolves — never throws to the caller. Failures are captured in the result
object, not propagated as exceptions.

Everything else in the MTM synthesis service is internal. No other endpoint is
exposed or called externally.

---

## NEXUS FEED

### Liber Novus (LNV · 47)

Receives MTM Findings via DNR handoff after every successful synthesis cycle,
and failure notification payloads after every failed cycle. MTM does not write
to LNV directly. The result object is DNR's to route. LNV holds Findings with
MTM provenance intact — synthesis_session_ref, source_pattern_refs, and
content_fingerprint are permanently legible on every Finding that lands there.

### Pattern Convergence (PCV · 50)

Reads MTM Findings as pre-processed input per PCV structural rule 1. MTM
Findings are not raw deposits on PCV — they arrive with provenance intact and
are held as a distinct category. PCV does not receive Findings directly from
MTM. It reads from what LNV holds after the DNR handoff completes.

---

## KNOWN FAILURE MODES

### 1. Lens page database read fails before synthesis

One or more lens pages unavailable. Synthesis cannot run. No Findings produced.

**Guard:** If any section database read fails at step 2, status → failed,
failure_type → pre_synthesis. Result object returned immediately. DNR surfaces
failure to LNV. Retry available.

### 2. Claude API returns malformed JSON

JSON parse throws. No Findings can be extracted.

**Guard:** JSON parse is wrapped in try/catch. On parse failure: status →
failed, failure_type → mid_synthesis. Findings written before the failure (none,
in this case) are preserved. Result object returned to DNR.

### 3. Deduplication check not running on retry

prior_mtm_session_ids not passed by DNR. Dedup Set is never built. Claude
produces the same Findings again. All of them write. LNV receives duplicates.
Research data corrupted.

**Guard:** DNR always passes prior_mtm_session_ids on retry calls. MTM checks
for its presence before every Finding write. If prior_mtm_session_ids was passed
but the prior session load failed, the skip is logged and flagged — it does not
silently proceed as if dedup ran.

### 4. Findings written without content_fingerprint

Deduplication has no key to check against on future retries. Every subsequent
retry on this session window will miss the duplicate check for these Findings.

**Guard:** content_fingerprint generation runs before every PostgreSQL write at
step 5. A Finding cannot be written without a fingerprint. If fingerprint
generation fails, the Finding is dropped and logged. Not written. Not routed.

### 5. Fingerprint collision — legitimate Finding skipped

Two genuinely distinct Findings draw from exactly the same source deposits. Same
fingerprint. The second is skipped as a duplicate. A valid Finding does not
reach LNV.

**Guard:** Collisions are logged with full detail — fingerprint, title of
skipped Finding, prior session id. Sage can manually deposit the skipped Finding
to LNV as a native entry with MTM provenance noted. If collision frequency is
high, fingerprint algorithm is reviewed. This is a calibration concern.

### 6. MTM synthesis endpoint called outside DNR

MTM fires without session context. No routine_session record exists for this
run. DNR does not receive the result. Findings may be written to PostgreSQL with
no routing path to LNV. Provenance chain broken.

**Guard:** POST /mtm/synthesize is the sole external trigger. All other internal
functions are unexposed. DNR is the only caller. Document this constraint
explicitly at build. Do not expose additional entry points for convenience.

### 7. Empty corpus / empty findings — three distinct states

These are not the same event. The schema distinguishes them explicitly.

**State A — Genuine empty corpus.** No deposits exist on any of the five lens
pages. All five datasets are empty arrays. Claude returns empty findings array.
findings_count: 0, findings_dropped: 0, status: complete. Clean empty. Nothing
failed.

**State B — Corpus exists, no cross-lens patterns found.** Deposits exist but
nothing became visible at the simultaneous read that wasn't visible in a single
lens. Claude returns empty findings array by design. findings_count: 0,
findings_dropped: 0, status: complete. Also clean. Also correct.

**State C — Candidates produced but all dropped.** Claude returned Findings.
All were dropped at validation, deduplication, or fingerprint failure.
findings_count: 0, findings_dropped > 0, status: complete. Not a failure state
but not a clean empty either. LNV surfaces the drop count. Sage can inspect the
logs to see what was dropped and why.

**Guard:** findings_dropped is always written alongside findings_count. LNV
checks both fields. If findings_count is 0 and findings_dropped > 0, LNV
displays a distinct message: "Synthesis complete — [n] candidate(s) produced,
none written. Review session logs."

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| backend/services/mtm.py | MTM synthesis service — lens page data assembly, Claude API call, JSON response handling, Finding validation, content fingerprinting, deduplication check, synthesis_sessions and findings PostgreSQL writes, result object assembly | PLANNED |
| backend/routes/mtm.py | FastAPI MTM endpoint — POST /mtm/synthesize trigger, result object response | PLANNED |
