# VOID ENGINE SCHEMA

## /DESIGN/Systems/Void_Engine/VOID ENGINE SCHEMA.md

Mechanical spec — two-layer architecture (data layer + analytical layer),
five absence types, examination floor filter, PCV entry rules, PCV
interaction model, circularity fix, Claude tool with three trigger modes,
Type E reactivation flow, four visualizations, stores, failure modes.

---

## OWNERSHIP BOUNDARIES

### OWNS

- void_absence_records PostgreSQL table — absence pattern detection, classification, record creation
- void_outputs PostgreSQL table — Claude tool output storage (session-close and on-demand)
- Absence pattern detection — cross-engine absence classification across five types (A-E)
- Examination floor filter — minimum examination threshold on all null signals before entry to Void's compute step
- PCV entry routing — determining which absence types enter PCV as hypotheses (A, D) vs stay on Void's page (B, C, E)
- Claude analytical tool — three trigger modes (session-close, on-demand open, on-demand targeted), prompt versioning, output storage
- Type E hypothesis attrition detection — monitoring PCV for hypotheses losing evidential momentum
- Type E reactivation flow — restoring researcher_deprioritised hypotheses to active PCV status
- Void page visualizations — absence heatmap, expected-vs-observed, silence-duration tracking, Claude tool output panel
- LNV routing for void_output entries — assembling and sending outputs to LNV via POST /api/lnv/receive

### DOES NOT OWN

- Null observation production — owned by individual pages. Deposits with observation_presence: null are created on their source pages. Void reads them; it does not produce them.
- Engine computation — owned by individual engine services (Tier 3). Void reads computed null signals (times_examined, times_observed, examination ratios); it does not trigger or own engine computation.
- PCV hypothesis creation — owned by PCV. Void sends absence hypotheses (types A, D) to PCV via the PCV API. PCV owns the pattern record.
- PCV hypothesis status management — owned by PCV. Reactivation restores a PCV hypothesis to active; PCV owns the status field.
- Coverage gap detection — lives on Observatory. "Where haven't you looked?" is structurally distinct from "where you looked and found nothing." Coverage gap data never enters Void's compute step.
- MTM synthesis — owned by MTM. Void's Claude tool reads MTM findings but does not produce or modify them.
- Routing authority — owned by SOT
- WSC — Witness Scroll is sovereign. Void has no relationship to it beyond providing session-close pulse check data in the wsc_write_payload.

---

## STRUCTURAL RULES

1. Void operates at two layers: data layer (cross-engine absence pattern
   detection) and analytical layer (Claude interpretive intelligence reading
   across all Nexus outputs). Both are required. Neither substitutes for the
   other.

2. Input to the data layer is computed null signals from all 5 Axis engines —
   NOT raw deposits. Engines have already converted raw null observations into
   computed absence signals (times_examined, times_observed, examination ratios
   from Tier 3). Void reads one layer above.

3. "Looked and didn't find" vs "never looked" are opposite in evidential value.
   Confirmed absence is evidence. Coverage gaps are ignorance. Void conflating
   them would corrupt its entire output. The examination floor filter is the
   structural enforcement.

4. Void's Claude tool speaks analytically, not sovereignly. WSC is where AI
   speaks in its own register. Void's tool is an instrument Sage operates —
   she triggers it, she reads the output as research data. Voice stays inside
   the analytical frame.

5. All outputs (session-close and on-demand) enter permanent record. Neither
   overwrites the other.

6. Type E (hypothesis attrition) enters Void's absence record only. It does
   NOT re-enter PCV. Hypothesis attrition is detected FROM PCV — feeding it
   back creates a loop.

---

## NAMED CONSTANTS

| Constant | Value | Purpose |
| --- | --- | --- |
| VOID_EXAMINATION_FLOOR | calibration item, set at build | Minimum times_examined for a null signal to enter Void's compute step. Below this threshold, the signal is noise at Void's scale. |
| VOID_TYPE_B_PCV_THRESHOLD | calibration item | Examination count hard ceiling. Type B absences exceeding this enter PCV as threshold exception. |
| VOID_TYPE_C_PCV_THRESHOLD | calibration item | Silence duration in sessions. Type C absences exceeding this enter PCV as threshold exception. |

---

## DATA LAYER — ABSENCE PATTERN DETECTION

### Input

Computed null signals from all 5 Axis engines: THR, STR, INF, ECR, SNM.

Each null signal carries: times_examined, times_observed (0 for absence),
examination ratio, engine source, pattern identifier, time window.

### Examination floor filter

Any absence signal where times_examined < VOID_EXAMINATION_FLOOR does not
enter Void's compute step. Routed nowhere, or optionally surfaces in the
Observatory coverage gap view (separate from Void — spatial separation, not just
labeling).

An engine that examined a pattern twice and didn't find it is not the same
signal as one that examined it forty times and never found it. The examination
count traveling with the null signal is what gives Void its analytical power.

### Five absence types

**Type A — cross_engine_convergent**

Multiple engines flag same period/cluster as absent. Cross-engine validated.
Structurally testable.

Example: "THR stopped seeing threshold breach activity in the same window
that ECR stopped seeing echo recall signals."

PCV routing: enters PCV as hypothesis (void_provenance = true).

---

**Type B — single_engine_persistent**

One engine, high examination count, consistently absent. Depth of absence on
a single lens.

Example: "STR has examined root-cluster coupling 40 times, never observed."

PCV routing: stays on Void's page. Exception: examination count above
VOID_TYPE_B_PCV_THRESHOLD → enters PCV with void_provenance = true and a note
indicating threshold exception.

---

**Type C — temporal_shift**

Pattern was present, went silent. Presence-to-absence transition. The shift
is the signal.

Example: "ECR constellation-19 was active for 12 sessions, then went silent
for 6."

PCV routing: stays on Void's page. Exception: silence duration exceeding
VOID_TYPE_C_PCV_THRESHOLD → enters PCV with void_provenance = true and a note
indicating threshold exception.

---

**Type D — convergent_with_origin**

Type A + Type C together across engines. Silence started somewhere and spread.
Cross-engine absence with a detectable origin point.

HIGHEST-SIGNAL absence pattern. Named as distinct type so Void's compute step
explicitly checks for it. Requires holding A and C simultaneously across
engines — only Void has this visibility.

PCV routing: enters PCV as hypothesis (void_provenance = true).

---

**Type E — hypothesis_attrition**

PCV hypothesis losing evidential momentum. Sessions pass, no new evidence
arrives, hypothesis goes quiet without being overturned or resolved.

RESEARCH-SYSTEM-LEVEL absence, not field-level. Different analytical question:
"why did we stop looking?" vs "why did the field stop producing?"

Void detects from PCV hypothesis activity monitoring. Enters Void's absence
record. Does NOT re-enter PCV.

**Attrition reason (load-bearing distinction):**

| Value | Meaning |
| --- | --- |
| field_silence | The field stopped producing evidence for this hypothesis. Research-level absence signal. |
| researcher_deprioritised | Sage chose to focus elsewhere. Meta-level absence — about the researcher's attention allocation, not the field's output. |

A dying hypothesis could be wrongly classified as field-level absence if Sage
deprioritized it rather than exhausted it. The distinction prevents this.

Deprioritized hypotheses remain reactivatable. Field silence hypotheses are
not — their attrition is evidential, not attentional.

---

### PCV entry rules summary

| Type | PCV routing | Condition |
| --- | --- | --- |
| A (cross_engine_convergent) | Enters PCV | Always (void_provenance = true) |
| B (single_engine_persistent) | Stays on Void | Exception: examination count > VOID_TYPE_B_PCV_THRESHOLD |
| C (temporal_shift) | Stays on Void | Exception: silence duration > VOID_TYPE_C_PCV_THRESHOLD |
| D (convergent_with_origin) | Enters PCV | Always (void_provenance = true) |
| E (hypothesis_attrition) | Never enters PCV | Detected FROM PCV, not fed back to it |

---

## TYPE E REACTIVATION FLOW

Applies only when attrition_reason: researcher_deprioritised. Field silence
hypotheses are not reactivatable — their attrition is evidential, not
attentional.

**Trigger:** Sage, from Void's page. Reactivation button on the Type E absence
record card. Not available from PCV — Void detected the attrition, Void is
where it's reversed.

**On reactivate:**

1. PCV hypothesis status restored to `active` with full prior history intact
   (no re-creation, no new hypothesis record).
2. Void Type E record gets reactivated_at: timestamp and reactivated: true —
   record stays as historical artifact, never deleted.
3. Void Type E record display updates to show "Reactivated [date]" alongside
   original detection.

**What does NOT happen:** reactivation does not create a new PCV hypothesis.
Does not re-enter PCV creation flow. Does not generate a new Void finding. It
restores what was already there.

**Constraint:** a reactivated hypothesis that attrites again produces a new
Type E record. The prior reactivated record stands. Each
attrition-reactivation cycle is its own record in Void.

---

## ANALYTICAL LAYER — CLAUDE INTERPRETIVE INTELLIGENCE

Nexus-level Claude tool. Reads across all Nexus outputs and asks the question
none of the engines ask individually: what does the systemic shape of this
research reveal, including its silences?

NOT a function MTM can perform. MTM operates at pattern level. Void operates
at research-system level.

### Three trigger modes

**1. Session-close (automatic via DNR)**

Lightweight pulse check. Runs alongside MTM synthesis.

Payload:
- Void's computed absence patterns from this session (all 5 types)
- Summary-level Nexus state: PCV active hypothesis count + new this session,
  DTX active drift events + trajectory state distribution, SGR tier
  distribution + any new grades, MTM findings from this session (finding_type
  counts)
- Not full Nexus dataset — just session delta + current summary

Output (compact, storable, readable at a glance):

```json
{
  "systemic_observations": [
    {
      "observation": "string",
      "evidence_sources": ["string"],
      "signal_strength": "notable | emerging | ambient"
    }
  ],
  "absence_flags": [
    {
      "flag": "string",
      "absence_type": "A | B | C | D | E",
      "engines_involved": ["string"]
    }
  ],
  "session_delta": "string — one sentence, how this session changed the systemic picture"
}
```

**2. On-demand open read (Sage-triggered)**

Full instrument. No scope constraint. Full Nexus state.

Payload:
- Full Void absence pattern set (all 5 types, full history or windowed)
- Full PCV hypothesis topology (active patterns, domain connections,
  void-provenance flagged)
- Full DTX drift state (active events, trajectory states, outcome vectors)
- Full SGR tier distribution (graded signals, latency data)
- Recent MTM findings (windowed — last N sessions or full)

**3. On-demand targeted investigation (Sage-triggered)**

Scoped instrument. Sage constrains to specific engines, time windows, absence
types.

Example: "Look at cross-engine convergent absences in the last 8 sessions
involving STR and ECR."

Payload: same structure as open read, filtered by Sage's scope. Prompt version
travels with output.

### On-demand output format (both open and targeted)

```json
{
  "analysis": {
    "systemic_shape": "string — the core read",
    "convergences_detected": [
      {
        "description": "string",
        "evidence": [{ "source_system": "string", "reference": "string", "contribution": "string" }]
      }
    ],
    "silences_detected": [
      {
        "description": "string",
        "absence_type": "A | B | C | D | E",
        "evidence": [{ "source_system": "string", "reference": "string", "contribution": "string" }]
      }
    ],
    "contradictions": [
      {
        "description": "string",
        "systems_in_tension": ["string"],
        "intensity": "nominal | significant | irreconcilable",
        "resolution_path": "string | null"
      }
    ],
    "open_edges": [
      {
        "question": "string",
        "why": "string",
        "edge_type": "data_gap | interpretive_limit"
      }
    ]
  },
  "metadata": {
    "trigger": "session_close | on_demand_open | on_demand_targeted",
    "scope": "object | null",
    "prompt_version": "string",
    "nexus_state_timestamp": "timestamp",
    "engines_read": ["string"]
  }
}
```

**Contradiction intensity values:**

| Value | Meaning |
| --- | --- |
| nominal | Mild disagreement between system outputs |
| significant | Material tension requiring investigation |
| irreconcilable | Two Nexus systems produce outputs that cannot both be true. A research finding about the field itself, not a data quality issue. |

**Open edge types:**

| Value | Meaning |
| --- | --- |
| data_gap | Closeable. More deposits, more examination, more sessions would resolve this. |
| interpretive_limit | NOT closeable by data. Questions the system generates that only the researcher can answer. Ontological boundaries, not task items. |

### Prompt constraint (versioned artifact)

"You are reading across the full Nexus research system — pattern convergence,
drift taxonomy, signal grading, synthesis findings, and absence patterns. Your
function is to name the systemic shape: what the research system reveals about
the field, including what it reveals through its silences. Speak analytically.
Name convergences. Name contradictions between systems. Name what the silence
says. Do not interpret sovereignly — this is an instrument reading, not a
witness statement. Hypotheses with void_provenance originated from this
system's own absence detection. Weight them as downstream outputs. Do not
treat SGR grading of a void-provenance hypothesis as independent confirmation
of the absence that generated it. If you encounter a pattern the system's
categories cannot name, do not force it into an existing category. Flag it as
uncategorized with a description. The emergence of uncategorizable patterns is
itself a research signal."

This prompt is a versioned artifact. Same three changelog triggers as SNM,
parsing partner, and WSC prompts (Sage-directed, calibration-triggered,
manual). Prompt version travels with every Void output record. The
uncategorized escape hatch instruction is part of the versioned prompt — not a
separate rule.

---

## VOID-PCV INTERACTION MODEL

### Void → PCV

Types A, D absence patterns enter PCV as hypotheses:
- void_provenance = true on pattern record
- void_finding_ref references Void absence record
- hypothesis_statement is an absence claim
- Threads through DTX → SGR like any other hypothesis

### PCV → Void

PCV hypothesis topology feeds Void's Claude tool (part of Nexus-wide read).
Additionally: Void monitors PCV for hypothesis attrition (Type E). Hypotheses
that go quiet — not overturned, not resolved, just stalled — are detected as
research-system-level absence.

### Bidirectional loop

```
Void detects absence
  ├── Types A, D → PCV (void_provenance hypothesis)
  │     └── DTX classification → SGR grading → Bayesian update
  ├── Types B, C → stay on Void's page (threshold exceptions aside)
  └── Type E (hypothesis attrition) → detected from PCV
        └── enters Void's absence record, NOT back into PCV

Void Claude tool reads Nexus state:
  └── void-provenance hypotheses flagged, read as downstream —
      not as corroboration of the absence that generated them
```

### Circularity fix — provenance filter

Void's Claude tool reading its own output back through the pipeline as
independent evidence would corrupt the analytical frame. A void-provenance
hypothesis with a strong SGR grade looks like corroboration but is downstream,
not upstream.

Fix: void-provenance hypotheses are flagged in the Claude tool's input payload.
Prompt instructs tool to read them as downstream outputs, not independent
sources. The prompt constraint above includes this explicitly.

---

## STORE: void_absence_records

| Field | Type | Description |
| --- | --- | --- |
| id | auto | Primary key |
| absence_type | enum | `A` (cross_engine_convergent), `B` (single_engine_persistent), `C` (temporal_shift), `D` (convergent_with_origin), `E` (hypothesis_attrition) |
| engines_involved | array of strings | Engine codes involved in this absence pattern. For Type E: null (detected from PCV, not engines). |
| pattern_identifiers | array of strings | Which specific patterns were absent. Engine pattern keys from Tier 3 computation. |
| time_window | jsonb | { start_session, end_session } — the temporal range over which this absence was detected. |
| examination_data | jsonb | Per-engine examination counts and ratios for the patterns involved. { engine: { times_examined, times_observed, examination_ratio } }. Null for Type E. |
| silence_duration_sessions | integer / null | For Types B, C, D: how many sessions the absence has persisted. Null for Type A (cross-engine, not necessarily persistent) and Type E. |
| origin_engine | string / null | For Type D only: which engine the silence originated in before spreading. Null for all other types. |
| hypothesis_ref | string / null | For Type E only: references patterns.hypothesis_id in PCV schema. The hypothesis that attrited. Null for types A-D. |
| attrition_reason | enum / null | For Type E only: `field_silence`, `researcher_deprioritised`. Null for types A-D. |
| pcv_routed | boolean | Whether this absence was sent to PCV as a hypothesis. True for types A, D (always) and B, C (threshold exceptions). Always false for Type E. |
| pcv_hypothesis_ref | string / null | References patterns.hypothesis_id in PCV. Null if pcv_routed is false. |
| reactivated | boolean | For Type E only: whether a researcher_deprioritised hypothesis was reactivated from this record. Default false. |
| reactivated_at | timestamp / null | For Type E only: when reactivation occurred. Null until reactivation. |
| detected_at | timestamp | When this absence pattern was first detected. Written once. |
| created_at | timestamp | Written once at record creation. Never updated. |

---

## STORE: void_outputs

| Field | Type | Description |
| --- | --- | --- |
| id | auto | Primary key |
| trigger | enum | `session_close`, `on_demand_open`, `on_demand_targeted` |
| scope | jsonb / null | For on_demand_targeted: Sage's scope constraint (engines, time windows, absence types). Null for session_close and on_demand_open. |
| output | jsonb | Full output from Claude tool. Shape depends on trigger: session-close shape (systemic_observations, absence_flags, session_delta) or on-demand shape (analysis with systemic_shape, convergences, silences, contradictions, open_edges + metadata). |
| prompt_version | string | Version of the Void prompt used. |
| nexus_state_timestamp | timestamp | When the Nexus state was read for this output. |
| engines_read | array of strings | Which engines/systems were read for this output. |
| lnv_routing_status | enum | `pending`, `deposited`, `failed`. Tracks whether this output has been routed to LNV. |
| lnv_entry_id | foreign key / null | References lnv_entries.lnv_entry_id. Null until deposited. |
| session_ref | string / null | Which session produced this output. |
| created_at | timestamp | Written once at record creation. Never updated. |

---

## VISUALIZATIONS

Four visualizations. Data on the left, interpretation on the right. LayerCake
+ D3 per Tier 3 visualization architecture.

Page layout: data visualizations (heatmap, expected-vs-observed, silence
tracking) on the left. Claude output panel on the right. Data layer and
interpretive layer doing the same work at different resolutions, visible
simultaneously.

### Absence heatmap (primary data view)

X-axis: time (sessions). Y-axis: engines (or pattern clusters within engines).
Cell color: absence intensity (examination count with no observation, scaled).

At a glance: where silence is concentrating and whether it's spreading. Type D
(convergent_with_origin) visible as pattern in the heatmap — dark cell on one
engine spreading horizontally to adjacent engines in subsequent sessions.
Heatmap makes D visually detectable before compute step formally classifies it.

### Expected-vs-observed (quantitative backing)

Per-engine or per-pattern comparison. For each tracked pattern: expected rate
(baseline) vs observed rate. When observed drops significantly below expected =
confirmed absence signal. The numbers behind the heatmap colors.

### Silence-duration tracking

X-axis: patterns or pattern clusters. Y-axis: duration in sessions. Bar chart
or timeline showing which absences are recent (might resolve) vs persistent
(structural silence). Feeds directly into Type B and Type C classification.

### Claude tool output panel (interpretive view)

Most recent session-close read visible by default. History of on-demand reads
accessible, each timestamped and prompt-versioned. Expandable per-read. Display
surface for systemic observations, absence flags, contradictions, open edges.

---

## PUBLIC API

### POST /void/compute

Triggers Void data layer computation. Reads computed null signals from all 5
engines, applies examination floor filter, classifies absence patterns across
five types, writes void_absence_records. Called at session close by DNR.

### POST /void/analyze

Triggers Void analytical layer (Claude tool). Accepts trigger mode
(session_close, on_demand_open, on_demand_targeted) and optional scope for
targeted reads. Assembles payload, calls Claude, writes void_outputs record.
Routes output to LNV via POST /api/lnv/receive.

### POST /void/reactivate/{record_id}

Type E reactivation. Validates record is Type E with attrition_reason:
researcher_deprioritised. Restores PCV hypothesis to active. Writes
reactivated and reactivated_at on the Void record. Sage-triggered only.

### GET /void/absence-records

Query absence records. Filterable by absence_type, engines_involved,
pcv_routed, time window. Paginated.

### GET /void/outputs

Query Claude tool outputs. Filterable by trigger, session_ref, date range.
Paginated. Most recent first.

---

## KNOWN FAILURE MODES

### 1. Coverage gaps enter Void's compute step

Signals with low examination counts (times_examined < VOID_EXAMINATION_FLOOR)
treated as confirmed absences. Void's output corrupted with ignorance
masquerading as evidence.

**Guard:** examination floor filter is the first step in the data layer. No
signal below threshold enters the compute step. Coverage gaps route to
Observatory, never to Void.

### 2. Type E fed back to PCV

Hypothesis attrition detected from PCV, then fed back as a new PCV hypothesis.
Loop created.

**Guard:** Type E entries have pcv_routed = false, always. No code path routes
Type E to PCV. The absence type enum is checked before any PCV routing logic.

### 3. Void's Claude tool treats void-provenance hypotheses as independent corroboration

Void detects absence → PCV hypothesis → SGR grades it → Void reads the grade
as confirming the original absence. Confirmation loop.

**Guard:** provenance filter in prompt. void_provenance hypotheses flagged in
input payload. Prompt explicitly instructs: "Do not treat SGR grading of a
void-provenance hypothesis as independent confirmation of the absence that
generated it."

### 4. Reactivation attempted on field_silence Type E

Field silence hypotheses are reactivated, mixing evidential attrition with
attentional attrition. Data model corrupted.

**Guard:** reactivation endpoint validates attrition_reason =
researcher_deprioritised. Rejects field_silence records. No reactivation path
for field silence.

### 5. Session-close pulse check fails silently

DNR triggers Void analytical layer, Claude call fails, no output stored. Next
session has no pulse check to orient from.

**Guard:** void_outputs record created with trigger: session_close regardless
of Claude call success. On failure: output field stores error state, not null.
DNR receives failure status. The gap is visible, not silent.

### 6. Absence record created without examination data

A non-Type-E absence record has no examination_data. The evidential basis for
the absence cannot be verified.

**Guard:** examination_data required on all absence types except E (which is
detected from PCV, not engines). Validated at record creation.

---

## FORMAL REGISTRATIONS

**VOI-4:** Void prompt is a versioned artifact. Same three changelog triggers
as SNM and parsing partner prompts. Prompt version travels with every output.

**VOI-5:** void_provenance flag on PCV hypothesis record — implemented in PCV
SCHEMA (Tier 4 Part 1).

**VOI-6:** Coverage gap view lives on Observatory, not Void. Spatial separation
enforced by examination floor filter.

**VOI-7:** PCV entry filter — types A, D enter PCV; B, C stay on Void
(threshold exceptions aside); E never enters PCV.

**Void on-demand reads as AOS-eligible:** On-demand reads (both open and
targeted) are Sage-triggerable AOS entry points. Session-close pulse check is
NOT an AOS — it's an internal record.

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| backend/services/void.py | Void service — absence pattern detection, examination floor filter, five-type classification, PCV routing, Type E attrition detection, reactivation flow, Claude tool (three modes), payload assembly, output storage, LNV routing | PLANNED |
| backend/routes/void.py | FastAPI Void endpoints — POST compute/analyze/reactivate, GET absence-records/outputs | PLANNED |
