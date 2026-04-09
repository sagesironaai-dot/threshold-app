# SYSTEM: Void Engine

## /DESIGN/Systems/Void_Engine/

### Two-layer absence detection · cross-engine pattern classification · Claude analytical intelligence

---

## WHAT THIS SYSTEM OWNS

* Absence pattern detection — cross-engine classification across five types: A (cross_engine_convergent), B (single_engine_persistent), C (temporal_shift), D (convergent_with_origin), E (hypothesis_attrition)
* Examination floor filter — VOID_EXAMINATION_FLOOR enforces the boundary between confirmed absence ("looked and didn't find") and coverage gaps ("never looked"). Signals below threshold never enter Void's compute step.
* void_absence_records PostgreSQL table — record creation, classification, PCV routing status, Type E reactivation tracking
* void_outputs PostgreSQL table — Claude tool output storage for all three trigger modes, LNV routing status
* Claude analytical tool — three trigger modes (session-close pulse check, on-demand open read, on-demand targeted investigation). Reads across all Nexus outputs. Prompt is a versioned artifact.
* PCV entry routing — types A, D enter PCV as hypotheses (void_provenance = true). B, C stay on Void unless secondary thresholds exceeded. E never enters PCV.
* Type E hypothesis attrition detection — monitors PCV for hypotheses losing evidential momentum without being overturned or resolved
* Type E reactivation flow — restores researcher_deprioritised hypotheses to active PCV status (field_silence hypotheses are not reactivatable)
* LNV routing for void_output entries — session-close and on-demand outputs route to LNV via POST /api/lnv/receive (entry_type: void_output)
* Void page visualizations — absence heatmap, expected-vs-observed, silence-duration tracking, Claude tool output panel

## WHAT THIS SYSTEM DOES NOT OWN

* Null observation production — owned by individual pages. Void reads computed null signals from engines; it does not produce the underlying observations.
* Engine computation — owned by individual engine services (Tier 3). Void reads computed absence signals; it does not trigger or own computation.
* PCV hypothesis creation and status management — owned by PCV. Void sends absence hypotheses to PCV; PCV owns the pattern record and status.
* Coverage gap detection — lives on Observatory semantic map. "Where haven't you looked?" is structurally distinct from "where you looked and found nothing." Coverage gap data never enters Void's compute step.
* MTM synthesis — owned by MTM. Void's Claude tool reads MTM findings but does not produce or modify them.
* Routing authority — owned by SOT
* Witness Scroll — WSC is sovereign. Void provides session-close pulse check data for the wsc_write_payload; it has no other relationship to WSC.

---

## THE TWO-LAYER ARCHITECTURE

**Data layer — absence pattern detection:**
Reads computed null signals from all 5 Axis engines. Applies the examination floor filter (VOID_EXAMINATION_FLOOR) to exclude low-examination noise. Classifies absence patterns across five types. Types A and D (cross-engine validated) route to PCV as hypotheses. Types B and C stay on Void's page unless secondary thresholds are exceeded. Type E (hypothesis attrition) is detected from PCV activity monitoring — research-system-level absence, not field-level.

**Analytical layer — Claude interpretive intelligence:**
Nexus-level Claude tool that reads across all Nexus outputs (PCV, DTX, SGR, MTM, Void's own absence data) and names the systemic shape of the research, including its silences. Three trigger modes: session-close pulse check (automatic, lightweight), on-demand open read (full Nexus state, no scope constraint), on-demand targeted investigation (scoped by Sage). All outputs stored permanently with prompt version.

**Why two layers:** The data layer detects WHERE absence is. The analytical layer asks WHAT the pattern of absence means systemically. Neither can substitute for the other. Detection without interpretation is a heatmap. Interpretation without detection is speculation. Together they make absence a first-class analytical instrument.

---

## THE BOUNDARY — ABSENCE vs COVERAGE GAPS

"Looked and didn't find" (confirmed absence) and "never looked" (coverage gap) are opposite in evidential value. Confirmed absence is evidence. Coverage gaps are ignorance.

Void owns confirmed absence. Observatory owns coverage gaps (built from embedding vector distribution on the semantic map). The examination floor filter enforces the boundary at Void's input. Coverage gap data never enters Void's compute step. This is spatial separation, not just labeling.

---

## VOID-PCV INTERACTION

Bidirectional but asymmetric:

**Void → PCV:** Types A, D enter PCV as hypotheses with void_provenance = true. They thread through DTX → SGR like any other hypothesis. Their hypothesis_statement is an absence claim.

**PCV → Void:** PCV topology feeds Void's Claude tool as part of the Nexus-wide read. Void also monitors PCV for Type E (hypothesis attrition) — hypotheses that go quiet without resolution.

**Circularity protection:** void-provenance hypotheses are flagged in the Claude tool's input payload. The prompt explicitly instructs: do not treat SGR grading of a void-provenance hypothesis as independent confirmation of the absence that generated it. The provenance filter prevents the confirmation loop.

---

## TYPE E — HYPOTHESIS ATTRITION

Type E is research-system-level absence — different from field-level absence (types A-D). It asks "why did we stop looking?" not "why did the field stop producing?"

The attrition_reason field (field_silence | researcher_deprioritised) is the load-bearing distinction. A dying hypothesis could be wrongly classified as field-level absence if Sage deprioritized it rather than exhausted it.

Researcher-deprioritised hypotheses are reactivatable from Void's page. Field silence hypotheses are not — their attrition is evidential. Each attrition-reactivation cycle produces its own record in Void.

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| backend/services/void.py | Void service — absence detection, examination floor filter, five-type classification, PCV routing, Type E attrition detection, reactivation flow, Claude tool (three modes), payload assembly, output storage, LNV routing | PLANNED |
| backend/routes/void.py | FastAPI Void endpoints — POST compute/analyze/reactivate, GET absence-records/outputs | PLANNED |

All mechanical specs — store definitions, absence type details, examination floor filter, PCV entry rules, Claude tool payloads and output shapes, reactivation flow, visualizations, failure modes — in VOID ENGINE SCHEMA.md.
