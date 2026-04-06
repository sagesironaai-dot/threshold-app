# SYSTEM: Metamorphosis

## /DESIGN/Systems/Metamorphosis/

### Synthesis layer · five-lens simultaneous read · Finding production

---

## WHAT THIS SYSTEM OWNS

* Synthesis cycle — the full MTM operation from lens page read through Finding production
* Claude API call — system prompt received from DNR as parameter, synthesis directive appended by MTM, five-dataset payload construction, response handling
* Lens page data assembly — pulling and structuring all five lens page datasets before the API call
* Finding production — extracting, validating, and writing Finding records from the Claude response
* Content fingerprinting — generating and writing the content_fingerprint on every Finding record
* Deduplication check on retry — comparing candidate Findings against prior session Findings before writing or routing anything
* synthesis_sessions PostgreSQL table — record creation, status writes, findings_count and findings_dropped
* findings PostgreSQL table — record creation, fingerprint write, lnv_routing_status tracking
* LNV routing handoff — assembling the result object returned to DNR. MTM's responsibility ends there.

## WHAT THIS SYSTEM DOES NOT OWN

* Receives no deposits — synthesis only. A deposit routed to MTM is a routing error.
* Lens page deposit writing — owned by their respective sections (THR · STR · INF · ECR · SNM)
* PostgreSQL reads of lens page entry data — owned by FastAPI service layer (backend/services/)
* LNV deposit writing — owned by LNV
* Routine orchestration and trigger — owned by DNR. MTM never calls itself. DNR calls MTM.
* lnv_routing_status and lnv_deposit_id writes after LNV receipt — DNR triggers the FastAPI service layer to write these. MTM does not.
* Witness Scroll — WSC is sovereign. MTM has no relationship to it.
* Tag pipeline — owned by tagger service
* Routing authority — owned by SOT
* Findings content after handoff — once the result object is returned to DNR, MTM does not track what LNV does with what it received

---

## THE FIVE-LENS READ CONTRACT

MTM reads across five Axis lens pages simultaneously at session close. The five pages are:

* THR (02) — Threshold
* STR (03) — StarRoot
* INF (04) — Infinite Intricacy
* ECR (05) — Echo Recall
* SNM (06) — Sat Nam

**Simultaneously** means one Claude API call with all five datasets present in the payload. Not five calls. One. This constraint is structurally non-negotiable.

**Why simultaneous matters:** Sequential reads produce sequential analysis. MTM's function is to surface what becomes visible only when all five lenses are held at once in a single context window — the missed pattern, the structure no single lens contained. Sequential calls cannot produce that output. The insight lives in the simultaneity. Five separate reads, even if each is correct, produce five separate analyses accumulated in sequence — not one synthesis. The architecture exists to create the conditions under which the synthesis insight can emerge.

Each dataset is an array of entry objects pulled fresh from PostgreSQL at synthesis time. An empty array for a lens page means no entries exist on that page — it is not a missing lens page, and synthesis proceeds. A lens page is only unavailable if the database read fails for that section. That failure triggers pre_synthesis abort.

Full lens page read spec, payload structure, and empty-array handling in METAMORPHOSIS SCHEMA.md.

---

## MTM NEVER RECEIVES DEPOSITS

MTM is a synthesis layer. It reads. It produces Findings. It does not accumulate.

Material that would otherwise route to MTM routes instead to the appropriate Axis lens page. MTM reads from there at session close. This is not a limitation — it is the architecture. If MTM received deposits, its synthesis output would be drawn from a second corpus separate from the lens pages, and the five-lens read would no longer represent the full field. The INT gateway rule holds: everything enters through INT, routes to a page. MTM reads pages. MTM produces Findings. Those are two separate operations.

---

## TRIGGER DEFINITION

MTM fires as Step 1 of the Daily Nexus Routine only.

DNR triggers the MTM synthesis endpoint (POST /mtm/synthesize) and awaits its resolution before proceeding to Step 2. POST /mtm/synthesize is the sole public entry point. Everything inside MTM is internal to that call.

MTM never calls itself. There is no scheduled trigger, no deposit event trigger, no internal retry. All retry logic lives in DNR. MTM receives a call, runs, and returns a result object. That is its complete contract with the outside world.

---

## LNV HANDOFF

MTM produces Findings and writes them to the findings PostgreSQL table. It then returns the result object to DNR. DNR owns routing to LNV — MTM does not write to LNV directly.

After LNV confirms receipt of each Finding, DNR triggers the FastAPI service layer to write lnv_routing_status → deposited and lnv_deposit_id on each findings record. MTM does not own or trigger these writes.

Pattern Convergence (PCV · 50) reads MTM Findings as pre-processed input. PCV does not receive Findings directly from MTM — it reads from what LNV holds after the DNR handoff completes.

---

## KNOWN LIMITATIONS

**Semantic deduplication is not performed.**

The content fingerprint guarantees structural deduplication — the same sources producing the same finding won't write twice. It does not guarantee semantic deduplication — if Claude selects different deposits to support the same insight on retry, the fingerprint diverges and both findings write.

This is a deliberate tradeoff. Semantic deduplication would require comparing finding content, which introduces interpretation into what should be a mechanical process. LNV surfaces both findings. Sage resolves semantic overlap through the research record, not the pipeline.

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| backend/services/mtm.py | MTM synthesis service — lens page data assembly, Claude API call, JSON response handling, Finding validation, content fingerprinting, deduplication, synthesis_sessions and findings PostgreSQL writes, result object assembly | PLANNED |
| backend/routes/mtm.py | FastAPI MTM endpoint — POST /mtm/synthesize trigger, result object response | PLANNED |

All mechanical specs — synthesis sequence, result object shape, fingerprinting algorithm, deduplication check, store definitions, Claude API call structure, Finding validation criteria, failure modes, public API — in METAMORPHOSIS SCHEMA.md.
