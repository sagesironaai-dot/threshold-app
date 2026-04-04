# SYSTEM: Metamorphosis

## metamorphosis_system.md

### /DOCS/systems/

---

## WHAT THIS SYSTEM OWNS

* Synthesis cycle — the full MTM operation from lens page read through Finding production
* Claude API call — system prompt assembly, five-dataset payload construction, response handling
* Lens page data assembly — pulling and structuring all five lens page datasets before the API call
* Finding production — extracting, validating, and writing Finding records from the Claude response
* Content fingerprinting — generating and writing the content_fingerprint on every Finding record
* Deduplication check on retry — comparing candidate Findings against prior session Findings before writing or routing anything
* synthesis_sessions IDB store — record creation, status writes, findings_count and findings_dropped
* findings IDB store — record creation, fingerprint write, lnv_routing_status tracking
* LNV routing handoff — assembling the result object returned to DNR. MTM's responsibility ends there.

## WHAT THIS SYSTEM DOES NOT OWN

* Receives no deposits — synthesis only. A deposit routed to MTM is a routing error.
* Lens page deposit writing — owned by their respective sections (THR · STR · INF · ECR · SNM)
* IDB reads of lens page entry data — owned by data.js
* LNV deposit writing — owned by LNV
* Routine orchestration and trigger — owned by DNR. MTM never calls itself. DNR calls MTM.
* lnv_routing_status and lnv_deposit_id writes after LNV receipt — DNR triggers data.js to write these. MTM does not.
* Witness Scroll — WSC is sovereign. MTM has no relationship to it.
* Tag pipeline — owned by tagger_bus.js
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

**Simultaneously** means one Claude API call with all five datasets present in the payload. Not five calls. One. This constraint is structurally non-negotiable. Sequential reads produce sequential analysis. MTM's function is to surface what becomes visible only when all five are held at once in a single context window. Sequential calls cannot produce that output.

Each dataset is an array of entry objects pulled fresh from IDB at synthesis time. Fields pulled per entry: id · section · body · tags · phase_state · originId · created_at. An empty array for a lens page means no entries exist on that page — it is not a missing lens page, and synthesis proceeds. A lens page is only unavailable if the IDB read fails for that section. That failure triggers pre_synthesis abort.

---

## MTM NEVER RECEIVES DEPOSITS

MTM is a synthesis layer. It reads. It produces Findings. It does not accumulate.

Material that would otherwise route to MTM routes instead to the appropriate Axis lens page. MTM reads from there at session close. This is not a limitation — it is the architecture. If MTM received deposits, its synthesis output would be drawn from a second corpus separate from the lens pages, and the five-lens read would no longer represent the full field. The INT gateway rule holds: everything enters through INT, routes to a page. MTM reads pages. MTM produces Findings. Those are two separate operations.

---

## TRIGGER DEFINITION

MTM fires as Step 1 of the Daily Nexus Routine only.

DNR calls MTM.runSynthesis() and awaits its resolution before proceeding to Step 2. MTM.runSynthesis() is the sole public entry point. Everything inside MTM is internal to that call.

MTM never calls itself. There is no scheduled trigger, no deposit event trigger, no internal retry. All retry logic lives in DNR. MTM receives a call, runs, and returns a result object. That is its complete contract with the outside world.

---

## DEDUPLICATION ON RETRY

Deduplication runs on every retry where prior_mtm_session_ids is present in the MTM.runSynthesis() call options. It never runs on a clean first-time synthesis.

DNR assembles the full array of all failed mtm_session_ids from the current session window — not just the most recent — and passes it to MTM.runSynthesis() on every retry. MTM loads all findings records from those prior sessions and builds a Set of their content_fingerprints. A candidate Finding whose fingerprint matches any entry in that Set is skipped — not written, not routed.

A Finding that cannot have its fingerprint generated is also dropped. A Finding cannot be written without a fingerprint.

If the prior session load itself fails, dedup_skipped is written to true on the synthesis_session record and synthesis proceeds without deduplication. This is not a synthesis failure — it is flagged so LNV can treat the cycle's Findings as potentially containing duplicates.

---

## RESULT OBJECT

The exact shape returned to DNR on every call — success or failure:

```
{
  status:           'complete' | 'failed'
  failure_type:     null | 'pre_synthesis' | 'mid_synthesis'
  findings:         array of Finding records produced this cycle
  findings_count:   integer — count of findings array
  findings_dropped: integer — candidates not written
  mtm_session_id:   synthesis_sessions record id for this cycle
}
```

MTM's contract with DNR ends when this object resolves. What DNR does with it is DNR's concern.

**failure_type: pre_synthesis** — one or more lens page IDB reads failed before synthesis began. No Findings produced. findings array is empty.

**failure_type: mid_synthesis** — all five lens pages were read. The Claude API call failed or JSON parsing failed partway through. Findings written before the failure are preserved and included in the findings array.

mtm_session_id is always present — the synthesis_session record is created at the very start of the cycle, before any failure can occur.

---

## LNV HANDOFF

MTM produces Findings and writes them to the findings IDB store. It then returns the result object to DNR. DNR owns routing to LNV — MTM does not write to LNV directly.

After LNV confirms receipt of each Finding, DNR triggers data.js to write lnv_routing_status → deposited and lnv_deposit_id on each findings record. MTM does not own or trigger these writes.

Pattern Convergence (PCV · 50) reads MTM Findings as pre-processed input. PCV does not receive Findings directly from MTM — it reads from what LNV holds after the DNR handoff completes.

---

## PUBLIC API

**MTM.runSynthesis(options?) → Promise\<ResultObject\>**
The sole public entry point. Called by DNR only. Never called from any other system.

options — optional object:
```
{ prior_mtm_session_ids: string[] | null }
```
Present on retry runs — DNR passes the full array of all failed mtm_session_ids from the current window. Null or absent on clean first-time runs.

Always resolves — never throws to the caller. Failures are captured in the result object, not propagated as exceptions.

Everything else in mtm.js is internal. No other function is exposed or called externally.

---

## KNOWN FAILURE MODES

**1. Lens page IDB read fails before synthesis**
One or more lens pages unavailable. Synthesis cannot run. No Findings produced.
Guard: any IDB read failure at step 2 → status failed, failure_type pre_synthesis. Result object returned. DNR surfaces failure to LNV. Retry available.

**2. Claude API returns malformed JSON**
No Findings can be extracted. JSON.parse() throws.
Guard: parse failure → status failed, failure_type mid_synthesis. Findings written before the failure are preserved. Result object returned.

**3. Deduplication not running on retry**
prior_mtm_session_ids not passed. All Findings written again. LNV receives duplicates.
Guard: DNR always passes prior_mtm_session_ids on retry. If prior session load fails, dedup_skipped → true is written and flagged — it does not silently proceed as if dedup ran.

**4. Finding written without content_fingerprint**
Deduplication has no key for future retries. Duplicates will not be caught.
Guard: fingerprint generation runs before every IDB write. A Finding that fails fingerprint generation is dropped and logged. Not written. Not routed.

**5. MTM.runSynthesis() called outside DNR**
No routine_session record exists. DNR does not receive the result. Provenance chain broken.
Guard: runSynthesis() is the only public entry point. All internal functions are unexposed. DNR is the only caller. This constraint is documented at build — do not expose additional entry points.

**6. Empty results — three distinct states**
These are not the same event:
* findings_count: 0, findings_dropped: 0, status: complete — clean empty. Corpus had no cross-lens patterns.
* findings_count: 0, findings_dropped > 0, status: complete — candidates produced, none written. LNV surfaces the drop count with a distinct message.
* status: failed — synthesis did not complete. Retry available.

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| mtm.js | MTM synthesis engine — lens page data assembly, Claude API call, JSON response handling, Finding validation, content fingerprinting, deduplication, synthesis_session and findings IDB writes, result object assembly | PLANNED |
| data.js | synthesis_sessions IDB store · findings IDB store — record creation, status writes, fingerprint write, lnv_routing_status tracking | PLANNED |
