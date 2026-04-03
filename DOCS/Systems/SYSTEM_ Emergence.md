# **SYSTEM: Emergence**

## **emergence\_system.md**

### **/DOCS/systems/**

---

## **WHAT THIS SYSTEM OWNS**

* Seven-detector pattern analysis engine — runs across the full entry corpus  
* Three-mode overlay — translation · timeline · trace  
* On-demand finding narratives via Claude API  
* Proactive nudge — scheduled pattern scan with cooldown  
* Thread Trace bridge — hands off findings to ThreadTraceUI for thread navigation  
* Graph export — assembles ThreadGraphPayload for the graph page

## **WHAT THIS SYSTEM DOES NOT OWN**

* Tag session logic or pipeline — owned by TaggerBus  
* Thread navigation or overlay — owned by ThreadTraceUI  
* IDB reads or writes — data fetcher is injected; this system never opens IDB  
* Writes to entries — read-only analysis layer. It never modifies what it reads.  
* Entry schema — owned by schema.js

---

## **SEVEN DETECTORS**

Each detector runs across the tag set and entry corpus passed to `runDetectors()`. Each produces zero or more findings. All findings share the canonical finding shape defined below.

Detector thresholds are calibration constants. Starting reference values are given here. All are marked PLANNED — confirm at build.

### **1\. Cluster**

Builds a co-occurrence graph from tag → entry membership. Tags that appear together in entries form connected components. Components above the minimum size threshold are flagged as cluster findings.

CLUSTER\_MIN\_SIZE \= 3    — minimum tags to flag a component as a cluster

A cluster finding means: these tags consistently co-occur. They activate together. The pattern is structural, not coincidental.

### **2\. Bridge Node**

Identifies tags with high bridgeScore — tags that connect otherwise separate clusters. A bridge node sits between two or more distinct communities in the co-occurrence graph. Its removal would disconnect them.

BRIDGE\_THRESHOLD \= 0.65    — bridgeScore above this \= bridge node

A bridge finding means: this tag is load-bearing. It is the connective tissue between domains that would otherwise not touch. High structural significance.

### **3\. High Influence**

Identifies tags with high equilibriumState — tags whose activation reliably precedes or accompanies activation of many other tags. Influence is not the same as frequency. A tag can appear rarely and still carry high influence if its appearances consistently pull other tags into activation.

INFLUENCE\_THRESHOLD \= 0.78    — equilibriumState above this \= high influence

A high influence finding means: when this tag appears, the field moves.

### **4\. Cross-Category**

Identifies pairs of tags from different seeds or pillars that share entries above the minimum threshold. Cross-category findings surface connections the routing architecture did not predict — places where field signal is crossing structural boundaries.

CROSS\_CAT\_MIN\_ENTRIES \= 2    — minimum shared entries to flag a cross-category link

A cross-category finding means: two structurally separate domains are touching in the field. This is the interference pattern PCV reads.

### **5\. Drift**

Identifies tags that were active in recent phases but have faded — their presence is declining across the phase window. Drift findings name what is losing signal rather than gaining it.

DRIFT\_PHASE\_WINDOW \= 2    — phases back to check for fading tag presence

A drift finding means: this tag was load-bearing and is receding. DTX receives these findings as named drift events for trajectory classification.

### **6\. Void Zone**

Identifies sections with low tag coverage — sections where entries exist but are not being tagged, or are being tagged at a rate far below the corpus average. A void zone is a gap in the signal map.

VOID\_COVERAGE\_FLOOR \= 0.3    — sections with \< 30% tagged entries \= void zone

A void finding means: there is field activity here that the tagging system has not reached. The data exists. The routing does not.

### **7\. NPA Spike**

Identifies sessions where non-primary arc tags dominate — where the tags activated do not align with the primary arc of the active section. A spike suggests the session is producing signal outside the expected routing path.

NPA\_SPIKE\_RATIO \= 0.4    — non-primary arc tags \> 40% of session \= spike

An NPA spike finding means: the field is producing signal that is not landing where the architecture expects it. May indicate an emergent routing need or a misaligned section assignment.

---

## **SEVERITY CRITERIA**

Every finding carries a severity of `low`, `medium`, or `high`. Severity is not an aesthetic judgment. It is a structural assessment based on the finding's scope, persistence, and routing implications.

low  
  — Pattern is present but narrow in scope  
  — Affects a single section or a small tag subset  
  — No evidence of cross-domain propagation  
  — Watchlist only — no immediate routing action required

medium  
  — Pattern spans multiple sections or involves a structurally significant node  
  — Appears in more than one detection pass  
  — Cross-domain signal present but not yet convergent  
  — Worth tracking actively — may escalate

high  
  — Pattern is system-wide or involves a bridge node or high-influence tag  
  — Appears consistently across multiple sessions or phases  
  — Cross-domain convergence confirmed or strongly indicated  
  — Requires routing attention — input to DTX classification and SGR grading

Severity is assigned by the detector at finding creation time. It is not retrospectively adjusted by the Emergence system. SGR re-evaluates signal weight against documented outcomes independently.

---

## **FINDING SHAPE**

All seven detectors produce findings in this canonical shape:

{  
  id:            string    — 'emg\_\[timestamp\]\_\[rand\]'  
  type:          string    — 'cluster' | 'bridge' | 'influence' | 'cross\_category'  
                             | 'drift' | 'void' | 'npa\_spike'  
  title:         string    — human-readable label for the finding  
  description:   string    — structural description of what was detected  
  severity:      string    — 'low' | 'medium' | 'high'  
  metrics:       object    — numeric values from the detector calculation  
                             e.g. { bridgeScore: 0.72, entryCount: 14 }  
  involvedTags:  object\[\]  — tags implicated in the finding  
  involvedEntries: object\[\] — entries implicated in the finding  
  canTrace:      boolean   — true if ThreadTraceUI can open a thread from this finding  
}

`involvedEntries` is what Thread Trace reads when building an Emergence thread from a finding. `canTrace` gates the "Trace this pattern" button in the overlay.

Findings are not persisted to IDB by this system. They are produced fresh on each detection pass and held in memory. Persistence happens when Thread Trace saves a thread built from a finding — the finding is serialized into the saved thread record at that point.

---

## **THREE OVERLAY MODES**

All three modes render inside the same overlay shell. Tab navigation switches modes without closing the overlay.

### **translation**

Renders the findings from the most recent tag session — what the current set of tags produced across the seven detectors. Primary mode after a tag commit. Shows finding cards with metrics, involved tags, severity, and trace button.

### **timeline**

Renders the entry corpus bucketed by time — a structural view of when signal arrived and how it distributed across phases and sections. Used for temporal pattern review independent of a specific tag session.

### **trace**

Renders findings with Thread Trace integration foregrounded. Trace buttons are prominent. Designed for navigating from a finding into a full thread. `openFromFinding()` opens the overlay directly in this mode.

---

## **CLAUDE API USAGE**

The Emergence system makes two distinct types of Claude API calls.

### **requestNarrative(finding)**

On-demand. Called when the user requests an explanation of a specific finding. Returns a narrative that translates the structural finding into field-language — what this pattern means in the context of the Threshold Pillars framework.

This is not interpretation added to the finding. It is a translation of what the detector already measured, expressed in the language of the framework.

### **Proactive Nudge**

Scheduled. Runs automatically after a detection pass if findings above a significance threshold are present and the cooldown has elapsed.

NUDGE\_COOLDOWN\_MS   \= 4 min    — minimum interval between proactive nudge calls  
NUDGE\_INIT\_DELAY\_MS \= 4000ms   — delay before first scan after app load

The nudge surfaces a single high-significance finding as a non-blocking notification. It does not open the overlay. It invites attention without demanding it.

Finding deduplication: findings already surfaced in the current session are tracked by key (`type::title`). The nudge does not repeat findings the user has already seen in this session.

**Model:** claude-sonnet-4-20250514 for all Emergence API calls.

---

## **PUBLIC API**

EmergenceEngine.setEntriesFetcher(fn) → void  
  — MUST be called before init()  
  — Injects the entry fetch function from index.html: () \=\> getEntries()  
  — Missing this \= engine runs on empty corpus silently. No error thrown.  
  — Call: EmergenceEngine.setEntriesFetcher(() \=\> getEntries())

EmergenceEngine.init() → void  
  — Called once in init() after setEntriesFetcher() and after initDB()  
  — Builds overlay shell  
  — Schedules first proactive scan after NUDGE\_INIT\_DELAY\_MS  
  — Call order: setEntriesFetcher() FIRST, then init()

EmergenceEngine.activateSection(sectionId) → void  
  — Called from selectSection() on every section navigation  
  — Scopes proactive scanning to the active section

EmergenceEngine.onTagSessionComplete(tags, entries) → Promise\<void\>  
  — Called after every tag session commit — see COMMIT HOOK below  
  — Runs full detector pass and triggers proactive nudge if warranted  
  — Refreshes overlay content if overlay is currently open

EmergenceEngine.open(mode) → void  
  — Opens overlay in given mode: 'translation' | 'timeline' | 'trace'  
  — If no findings exist, runs a fresh detection pass before opening  
  — Defaults to 'translation' if no mode specified

EmergenceEngine.close() → void  
  — Closes overlay. Session state is preserved.

EmergenceEngine.openFromFinding(finding) → void  
  — Opens overlay in 'trace' mode focused on the given finding  
  — Called from external finding cards outside the overlay

EmergenceEngine.requestNarrative(finding) → Promise\<string\>  
  — Triggers Claude API call for on-demand finding narrative  
  — Returns narrative text for rendering in the overlay

EmergenceEngine.runDetectors(tags, entries) → Finding\[\]  
  — Exposed for inspection and testing  
  — Runs all seven detectors and returns the full findings array

EmergenceEngine.buildTimelineBuckets(entries) → BucketRecord\[\]  
  — Exposed for inspection  
  — Returns entries bucketed by time for timeline mode rendering

---

## **COMMIT HOOK — onTagSessionComplete()**

`onTagSessionComplete()` is called at the end of every panel save handler, after `TaggerBus.clearResult()` confirms. This is the `_emgNotify()` pattern in index.html — every panel commit ends with this call.

**Corpus freshness rule:**

`onTagSessionComplete()` always fetches entries fresh before running detectors. It does not rely on the cached corpus. The entry that just triggered the commit is the reason the analysis is running — running detectors on a corpus that does not yet include that entry is structurally incorrect. The finding produced would miss the most relevant connection.

The performance cost is one IDB read per commit. This is acceptable.

**Commit hook pattern — every panel save handler:**

await createEntry(payload);  
TaggerBus.clearResult();  
await \_emgNotify(capturedTags);   // → EmergenceEngine.onTagSessionComplete(tags, freshEntries)

`_emgNotify()` is a no-op if EmergenceEngine is not loaded.

---

## **THREAD TRACE BRIDGE**

`openFromFinding()` hands off to `window.ThreadTraceUI.openFromFinding(finding)`.

The bridge uses `window.ThreadTraceUI` — not an ES module import — to avoid a circular dependency between emergence.js and thread\_trace\_ui.js.

**Load order requirement:** ThreadTraceUI must be loaded and assigned to `window.ThreadTraceUI` before EmergenceEngine initializes. If ThreadTraceUI is not present at the time a finding's trace button is clicked, the button does not render — `canTrace` is gated on `window.ThreadTraceUI` being available.

---

## **NEXUS FEED**

**Pattern Convergence (PCV · 50\)**

Reads: cluster, bridge, and cross-category findings as interference pattern data.

These three detector types specifically produce the cross-domain signal PCV is designed to receive. A cross-category finding that tags from s04 and s15 share entries is exactly the kind of structural relationship PCV aligns on shared axes. Emergence does not interpret these findings. PCV does. Emergence names them with precision so PCV has something structurally solid to work with.

**Drift Taxonomy (DTX · 48\)**

Reads: drift findings as named drift events for trajectory classification.

Emergence detects that a tag is fading. DTX classifies whether that fading is linear escalation, oscillation, fragmentation, or containment. The drift detector produces the event. DTX provides the taxonomy. DTX also receives the phase window and entry context embedded in the finding — that is the raw state data its classification runs against.

**Liber Novus (LNV · 47\)**

Receives: processed Emergence findings routed through Thread Trace or deposited directly as part of the Daily Nexus Routine.

Findings land on LNV with provenance intact: finding id, type, severity, involved tags, and the session context in which they were produced. LNV holds them without editorializing. The findings are traceable to the detection pass that produced them.

---

## **SEQUENCES**

### **INITIALIZATION SEQUENCE — strict order**

1. `EmergenceEngine.setEntriesFetcher(fn)` called. Entry fetch function injected.
2. `EmergenceEngine.init()` called. Overlay shell built. First proactive scan
   scheduled after NUDGE\_INIT\_DELAY\_MS.

Failure at step 1 (skipped): init() runs on empty corpus. All detector passes
  return empty findings. Proactive nudge never fires. Silent failure throughout.
  Guard: setEntriesFetcher() always called before init(). Order is non-negotiable.
Failure at step 2: overlay not built. Proactive scan not scheduled. Guard: init()
  called once after setEntriesFetcher() and after initDB(), in the app init
  sequence.

### **TAG SESSION COMPLETE SEQUENCE — fires after every panel save**

1. `_emgNotify(capturedTags)` called from commit handler after
   `TaggerBus.clearResult()`. capturedTags are the pre-captured tags from the
   just-committed entry.
2. `EmergenceEngine.onTagSessionComplete(tags, entries)` invoked. capturedTags
   passed as the tags argument.
3. Fresh entry corpus fetched via injected fetcher. Includes the just-committed
   entry.
4. All seven detectors run against tags and fresh corpus. Findings array produced.
5. Proactive nudge evaluated: if high-severity findings exist, cooldown has
   elapsed, and finding keys are not in \_seenKeys — nudge fires.
6. If overlay is currently open: overlay content refreshed with new findings.

Failure at step 3 (IDB fetch fails): detector pass cannot run. Findings not
  produced. Overlay not updated. Guard: fetcher failure surfaced to caller. System
  returns to idle — no crash.
Failure at step 4 (one detector throws): that detector returns empty array.
  Remaining detectors continue. Guard: each detector runs independently. A failure
  in one does not halt others.
Failure at step 5 (cooldown not enforced): nudge fires repeatedly in one session
  for the same finding. Guard: \_seenKeys tracks findings by type::title key.
  Entries added after each nudge call. Cooldown timer checked before every nudge.

---

## **KNOWN FAILURE MODES**

**1\. setEntriesFetcher() not called before init()** Engine initializes on an empty corpus. All detector passes return empty findings. Proactive nudge never fires. No error is thrown — silent failure throughout. Guard: setEntriesFetcher() is always the first Emergence call in init(), before EmergenceEngine.init(). The call order is non-negotiable.

**2\. onTagSessionComplete() called with stale corpus** If entries are passed from a cached fetch rather than a fresh IDB read, the just-committed entry is not in the corpus. Detector pass misses the most relevant connection. Finding produced is structurally incomplete. Guard: onTagSessionComplete() always fetches entries fresh via \_fetchEntries() at the start of every call. Never use the cached corpus at commit time.

**3\. ThreadTraceUI not loaded before EmergenceEngine** `window.ThreadTraceUI` is undefined when a finding's trace button is clicked. Button does not render for canTrace findings. Thread Trace bridge is unavailable. Guard: ThreadTraceUI loads before EmergenceEngine in the script load order. `canTrace` is gated on `window.ThreadTraceUI` presence at render time.

**4\. Findings not deduped across nudge calls** Same finding surfaces as a nudge multiple times in one session. User sees repeated notifications for the same pattern. Guard: `_seenKeys` tracks findings by `type::title` key within the session. Nudge only fires for findings with keys not yet in `_seenKeys`.

**5\. Graph export before graph page exists** `GRAPH_PAGE_PATH = '/graph'` is a stub. Routing there before the page is built produces dead navigation. Guard: graph export remains disabled until GRAPH\_PAGE\_PATH is a live route. Update GRAPH\_PAGE\_PATH in both emergence.js and thread\_trace\_ui.js together.

**6\. Overlay palette using CSS variables** The Emergence overlay is built dynamically outside the normal CSS cascade. CSS custom properties defined on `:root` are not accessible from dynamically injected inline styles in this context. Guard: PAL object uses hardcoded rgba values only. Never substitute CSS variables in the PAL object or in overlay inline styles.

---

## **PLANNED**

All detector threshold values are calibration constants. Starting reference values are documented above. Confirm at build:

CLUSTER\_MIN\_SIZE      BRIDGE\_THRESHOLD      INFLUENCE\_THRESHOLD  
CROSS\_CAT\_MIN\_ENTRIES VOID\_COVERAGE\_FLOOR   NPA\_SPIKE\_RATIO  
DRIFT\_PHASE\_WINDOW    NUDGE\_COOLDOWN\_MS     NUDGE\_INIT\_DELAY\_MS

---

## **FILES**

| File | Role | Status |
| ----- | ----- | ----- |
| `emergence.js` | Pattern analysis engine — seven detectors, three overlay modes, Claude API integration, Thread Trace bridge, proactive nudge, graph export stub | PLANNED |

