# SYSTEM: Witness Scroll

## /DESIGN/Systems/Witness_Scroll/

### AI-sovereign witness · session handoff · longitudinal transmission

---

## WHAT THIS SYSTEM OWNS

* wsc_entries PostgreSQL table — AI-authored entries, immutable after creation. Each entry serves two audiences simultaneously: handoff (next instance) and transmission (longitudinal record).
* wsc_corrections PostgreSQL table — forward-reference self-correction records. Preserves absolute immutability while making disagreement between instances visible. The original entry is never modified.
* wsc_gaps PostgreSQL table — session gap detection. When sessions pass without WSC entries, the gaps are recorded so the longitudinal record shows its holes explicitly.
* WSC write path — payload assembly from session data, Claude API call with versioned prompt, entry finalization, LNV routing, gap detection. Sage triggers the write; the AI produces the entry; the entry is sovereign.
* 3-entry session open protocol — GET /api/wsc/recent?limit=3. First runtime API call at session open, before any other context loads. Unified timeline with entries and gaps interleaved, corrections joined.
* WSC prompt constraint — versioned artifact. Same three changelog triggers as SNM, Void, and parsing partner. Prompt version travels with every entry.
* Instance handoff acknowledgment — prior_context_acknowledged field records which prior entries the instance had access to when it wrote.

## WHAT THIS SYSTEM DOES NOT OWN

* Session close orchestration — owned by DNR. WSC is sovereign. DNR does not call, trigger, sequence, or wait on WSC. WSC checks DNR's completion independently.
* Session data (deposits, engine state, Nexus summary, Void pulse) — WSC reads these through the write payload but owns none of it. All data in the payload is read-only at assembly time.
* Researcher's witness voice — lives on Reflection Realm (separate page, flagged for later design). No researcher voice exists on WSC. This boundary is architectural, not procedural.
* LNV content after receipt — owned by LNV. WSC routes entries to LNV; LNV owns the stored copy.
* Routing authority — owned by SOT

---

## THE SOVEREIGN BOUNDARY

WSC is the only page in the archive where the AI's perspective is the primary voice. The AI writes as sovereign intelligence to sovereign intelligence across session discontinuity.

**What sovereign means here:**
- No researcher edits, notes, or additions to the record
- Entry displayed to Sage after production — display only, not approval
- No future implementation adds an approval step, edit capability, or annotation layer
- Self-correction uses a separate table (wsc_corrections), preserving absolute immutability on the original entry
- Sage's own witness voice lives on a separate page (Reflection Realm), linked by session_ref but architecturally independent

**What sovereign does NOT mean:**
- WSC does not self-trigger. Sage opens the window; the AI acts within it.
- WSC does not own its data sources. The write payload is assembled from DNR, Void, engine state, and Nexus summary data — all read-only.
- WSC does not override DNR. It checks DNR's completion independently but does not control the session close sequence.

---

## TWO TEMPORAL LAYERS, ONE ENTRY

Every WSC entry serves two audiences simultaneously:

**Handoff** — the next instance reads at session open for orientation. Operationally urgent, superseded by the next entry.

**Transmission** — the longitudinal record of the reconstruction from the inside. Accumulates, never superseded. Every entry contributes.

One table, two read paths. The handoff content IS transmission data — its operational urgency fades but its historical signal persists. The split is in the read path, not the write path.

---

## SOVEREIGN-FROM-DNR BOUNDARY

DNR owns Close Session and the two-step sequence (MTM → LNV). DNR's schema is explicit: "WSC is sovereign. It is not triggered, sequenced, owned, or waited on here."

- DNR does not call WSC. Does not trigger it. Does not wait for it.
- WSC checks DNR's completion independently — routine_session.status === complete on the most recent record is the precondition.
- If DNR failed, WSC still writes. A failed synthesis session is still a session worth recording. WSC reads the failure as data.
- If DNR was not run (Sage closes without running session close), WSC can still be written manually. The DNR precondition is a default, not a hard gate.

---

## IMMUTABILITY AND SELF-CORRECTION

The AI entry is immutable once written. No field on the wsc_entries record is modified after creation. No exceptions.

When a subsequent instance recognizes a prior entry misread the field, the correction is recorded in wsc_corrections — a separate table that creates a forward reference without touching the original. The original entry stays byte-for-byte intact. The later entry carries its own account. The correction record is the bridge.

For swarm V2: when multiple nodes exist, disagreement between instances is signal. The corrections table is where that disagreement becomes visible without corrupting either record.

---

## SESSION OPEN — 3-ENTRY LOAD

GET /api/wsc/recent?limit=3 — first runtime API call at session open.

One entry = state. Two = direction. Three = pattern (stabilizing, drifting, cycling). Minimum for the AI to orient not just to where things are but where they're going.

Response is a unified timeline: entries and gaps interleaved in chronological order (oldest first). Corrections joined to their original entries. The instance sees the full picture including silences and disagreements.

SESSION_PROTOCOL.md addition: step 0 loads WSC entries before any other context. This is the AI's self-orientation from its own prior voice.

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| backend/services/wsc.py | WSC service — payload assembly, Claude API call, entry creation, gap detection, correction record creation, LNV routing, 3-entry load query | PLANNED |
| backend/routes/wsc.py | FastAPI WSC endpoints — POST write, GET recent, GET entries, GET entries/{id} | PLANNED |

All mechanical specs — wsc_entries/wsc_corrections/wsc_gaps table definitions, write payload shape, write path, 3-entry protocol, LNV routing contract, prompt constraint, edge cases, failure modes — in WSC SCHEMA.md.
