╔══════════════════════════════════════════════════════════════╗ ║ THREAD TRACE SCHEMA · v1 ║ ║ /DOCS/systems/thread\\\_trace\\\_schema\\\_v1.md ║ ╚══════════════════════════════════════════════════════════════╝



OWNERSHIP BOUNDARIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



OWNS Four thread builders — Temporal · Relational · Cluster · Emergence Seed resolution — normalizing any entry point into a typed seed object Edge label generation per thread edge Tag routing summary across a thread's entry set Active filter state — reading TaggerBus context for filter pre-population Routing snapshot — assembled at save time, stored with the saved thread record Overlay UI — one shell, sequence view, graph view, filter bar, annotation layer Saved threads IDB — saved\\\_threads store, thread\\\_annotations store Session-only thread state — in memory, no IDB write until save is triggered



DOES NOT OWN Tag vocabulary or routing records — owned by tags-vocab.js Entry data, entry schema, or IDB entry reads/writes — owned by data.js Emergence pattern detection — owned by emergence.js TaggerBus result or pipeline — owned by tagger\\\_bus.js The entries Thread Trace reads from — it receives, never writes



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FOUR THREAD TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



All four use the same overlay shell. The builder changes. The UI does not.



TEMPORAL ━━━━━━━━ Orders entries chronologically along a shared arc or phase trajectory.



Scoping: Seed is an entry → scopes to entries sharing the same phase_state or section as the anchor. Seed is a tag → scopes to entries carrying that tag. Seed is a finding → scopes to the finding's involvedEntries.



Fallback: if the scoped pool contains fewer than 3 entries, falls back to the full corpus automatically.



Temporal is the default fallback for any thread type that cannot execute with the given seed.



RELATIONAL ━━━━━━━━━━ Traverses entry-to-entry links via linkedEntries on each entry, then extends outward through shared tag routing to fill depth.



Traversal: BFS from the seed entry. MAX\\\_DEPTH \\= 4 hops MAX\\\_ENTRIES \\= 30



Fallback: if the seed is not type 'entry', falls back to TEMPORAL.



ACTIVE BLOCKER: Relational threads require linkedEntries to be populated on entries. Until entries carry valid linkedEntries data, Relational threads fall back to TEMPORAL silently. The builder is written and ready — it activates when the data exists.



CLUSTER ━━━━━━━ Groups entries that share a dominant tag cluster.



Seed can be a tag ID or an entry. If entry, the dominant tag from that entry's routing record anchors the cluster.



Entries are ranked by tag overlap count with the seed cluster. Operates on the full corpus — no section scoping.



EMERGENCE ━━━━━━━━━ Entries linked by Emergence findings and co-occurrence patterns. Seed is a finding object from emergence.js.



Builder reads involvedEntries from the finding and extends outward through shared tag routing.



Bridges directly to runDetectors() in emergence.js — fires fresh detection or uses an existing finding passed from the Emergence overlay.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SEED RESOLUTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



resolveSeed() normalizes any raw entry point into a typed seed object before the thread builder receives it. All three entry points route through resolveSeed() before buildThread() is called.



SEED SHAPE ━━━━━━━━━━ { type: 'entry' | 'tag' | 'finding' | 'query' id: string | object entry ID, tag ID, finding object, or query string threadTypes: string\\\[\\] preferred thread types for this seed, in priority order }



RESOLUTION RULES ━━━━━━━━━━━━━━━━ finding object (has findingType or involvedTags) → type: 'finding' → threadTypes: \\\['emergence', 'cluster'\\]



raw seed object with explicit threadTypes → type guessed from id prefix or pattern → threadTypes: carried from raw object



plain string starting with tv\\\_ or matching short-code pattern → type: 'tag' → threadTypes: \\\['cluster', 'temporal'\\]



plain string (entry ID) → type: 'entry' → threadTypes: \\\['relational', 'temporal'\\]



query string (free text, no matching ID pattern) → type: 'query' → threadTypes: \\\['temporal', 'cluster'\\]



QUERY SEED TYPE ━━━━━━━━━━━━━━━ A query seed scopes entries by text content match rather than requiring a known entry ID, tag ID, or finding object. Enables ad-hoc pattern exploration without a specific anchor — the difference between "trace from this entry" and "trace everything related to X." Thread type defaults to TEMPORAL scoped by content match, then CLUSTER by dominant tag overlap in the matched set.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ THREE ENTRY POINTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



All three call open(rawSeed) which routes through resolveSeed() → buildThread().



┌──────────────────┬───────────────────────────┬────────────────────────────────────────┐ │ Surface │ Trigger │ Seed shape passed │ ├──────────────────┼───────────────────────────┼────────────────────────────────────────┤ │ Entry meta strip │ ∿ glyph click on any │ { seed: entry.id, │ │ │ \\\[data-entry-id\\] element │ threadTypes: \\\['relational', │ │ │ │ 'temporal'\\] } │ ├──────────────────┼───────────────────────────┼────────────────────────────────────────┤ │ Tag pill │ Right-click / contextmenu │ { seed: tag.id, │ │ │ on any \\\[data-tag-id\\] │ threadTypes: \\\['cluster', │ │ │ element │ 'temporal'\\] } │ ├──────────────────┼───────────────────────────┼────────────────────────────────────────┤ │ Emergence │ "Trace this pattern" │ { seed: findingObj, │ │ finding card │ action │ threadTypes: \\\['emergence'\\] } │ └──────────────────┴───────────────────────────┴────────────────────────────────────────┘



GLYPH INJECTION ━━━━━━━━━━━━━━━ \\\_injectEntryPoints() runs on every activatePanel() call. Injects ∿ on \\\[data-entry-id\\] elements not yet marked \\\[data-tt-injected\\]. Tag pill contextmenu is delegated globally once, guarded by window.\\\_\\\_ttTagDelegateSet to prevent duplicate listeners.



ENTRY FETCH SCOPING ━━━━━━━━━━━━━━━━━━━ When a panel is active: entry fetches are scoped to the active section. Threads opened from within a panel are section-scoped by default and can be broadened via the filter bar.



When no panel is active: full corpus is fetched.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TWO VIEWS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Both views render inside the same overlay shell. The user can switch between them without closing the thread.



SEQUENCE VIEW ━━━━━━━━━━━━━ Ordered card list. Each card represents one entry in the thread. Navigation is linear — previous / next — with a progress bar showing position in the sequence.



Card content: title · body preview · phase_state · elarianAnchor · origin affinity · dominant tag routing · edge label connecting to the next card.



GRAPH VIEW ━━━━━━━━━━ Structural map of thread entries as nodes with edges. Edge labels show the relationship between connected entries — shared tag, explicit link, phase transition, or temporal interval.



Graph export assembles a ThreadGraphPayload and routes to the graph page.



PLANNED: graph page path — GRAPH\\\_PAGE\\\_PATH \\= '/graph'. Update when the graph page is built. Graph export is a stub until then. Graph export button remains disabled until GRAPH\\\_PAGE\\\_PATH is a live route. Update both emergence.js and thread\\\_trace\\\_ui.js together when the graph page is built.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FILTER BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Active across both views. Six filter dimensions:



pillar\\\_id       p01 | p02 | p03  

seed\\\_id         s01–s20  

layer\\\_id        l01–l04  

threshold\\\_id    th01–th12  

phase_state     canonical threshold name | null  

elarianAnchor   RFLT | WHSP | VEIL | OBSV | RECL | WEAV | GATE  

section         any section ID



elarianAnchor values sourced from COMPOSITE ID SCHEMA. Defined in composite\\\_id.js.



Filters are applied at buildThread() call time via \\\_applyFilters(). Changing a filter rebuilds the thread against the current corpus with the new constraints.



PRE-POPULATION ━━━━━━━━━━━━━━ On overlay open, getActiveFilterState() reads the current TaggerBus result and maps its routing dimensions to the filter bar. If TaggerBus has an active result, the filter bar opens pre-scoped to that context.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TAGGERBUS RELATIONSHIP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Thread Trace is a read-only consumer of TaggerBus. It reads at two moments and never writes to it. It never calls TaggerBus.clearResult().



┌──────────────────────┬──────────────────────────────┬─────────────────────────────┐ │ Moment │ What Thread Trace does │ Call │ ├──────────────────────┼──────────────────────────────┼─────────────────────────────┤ │ On overlay open │ Reads active filter state │ TaggerBus.getResult() │ │ │ to pre-populate filter bar │ │ ├──────────────────────┼──────────────────────────────┼─────────────────────────────┤ │ On thread save │ Included in routing snapshot │ TaggerBus.getResult() via │ │ │ assembly │ getActiveFilterState() │ └──────────────────────┴──────────────────────────────┴─────────────────────────────┘



getActiveFilterState() returns null silently if TaggerBus is not loaded. Thread Trace degrades gracefully — filter bar opens empty, routing snapshot records null filter state.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ EDGE LABELS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



generateEdgeLabel(entryA, entryB, threadType) is a pure function. No external calls. Produces a human-readable label for the relationship between two adjacent entries in a thread.



LABEL LOGIC BY THREAD TYPE ━━━━━━━━━━━━━━━━━━━━━━━━━━━



TEMPORAL phase transition if phase_state differs between entries: 'Solenne Arc → Vireth's Anchor' temporal interval if same phase: '3d apart' | '2w apart' | '1mo apart' 'same day' if within the same calendar day



RELATIONAL 'explicit link' if entries reference each other via linkedEntries up to two shared tag IDs if no explicit link: 'phase\\\_transitions · criticality' 'routing proximity' if no shared tags



CLUSTER dominant shared tag ID



EMERGENCE '↑ \\\[shared tag\\]' for co-occurrence link 'pattern link' if no shared tags identifiable



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ROUTING SNAPSHOT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Built at save time from the thread's full entry set. Stored with the saved thread record. Read by Pattern Convergence as cross-domain alignment data.



Shape: { dominantPillar\\\_id: string | null dominantSeed\\\_id: string | null dominantLayer\\\_id: string | null dominantThreshold\\\_id: string | null entryCount: integer edgeCount: integer threadType: string distributions: { pillars: { \\\[pillar\\\_id\\]: count } seeds: { \\\[seed\\\_id\\]: count } layers: { \\\[layer\\\_id\\]: count } thresholds: { \\\[threshold\\\_id\\]: count } } }



getTagRoutingSummary(entries) aggregates routing distribution across the entry set. buildRoutingSnapshot(threadResult) wraps that summary into the payload-ready shape above.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SAVED THREADS AND ANNOTATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



SAVED THREAD RECORD ━━━━━━━━━━━━━━━━━━━ { id string 'thr\\\_\\\[timestamp\\]\\\_\\\[rand\\]'



name                 string  

&nbsp;                    User-defined at save time.



thread\\\_type          string  

&nbsp;                    One of the four thread type  

&nbsp;                    values.



seed                 object  

&nbsp;                    Serialized seed. Finding objects  

&nbsp;                    reduced to key fields only for  

&nbsp;                    JSON safety.



entry\\\_ids            string\\\[\\]  

&nbsp;                    IDs of entries in the thread  

&nbsp;                    at save time.



filter\\\_state         object  

&nbsp;                    Active filter at save time.



tag\\\_routing\\\_snapshot object  

&nbsp;                    Routing snapshot — see above.



annotations          object\\\[\\]  

&nbsp;                    Mirrored annotation array for  

&nbsp;                    fast load.



created\\\_at           ISO string



last\\\_accessed        ISO string



is\\\_deleted           boolean



}



SOFT DELETE ━━━━━━━━━━━ deleteThread() sets is\\\_deleted \\= true. Does not remove the record. listThreads() filters deleted records automatically.



touchThread() ━━━━━━━━━━━━━ Updates last\\\_accessed without modifying any other field. Called when a saved thread is re-opened from the thread list.



loadThread() BEHAVIOR ━━━━━━━━━━━━━━━━━━━━━ loadThread() does not reconstruct entries. It returns the saved record including entry\\\_ids. The caller fetches the live entries separately using those IDs and passes them to buildThread() for re-render. This keeps saved threads current — the entries they reference reflect any updates made since the thread was saved.



ANNOTATIONS ━━━━━━━━━━━ { id string 'ann\\\_\\\[timestamp\\]\\\_\\\[rand\\]'



thread\\\_id        string  

&nbsp;                References saved\\\_threads.id.



text             string



timestamp        ISO string



filter\\\_snapshot  object  

&nbsp;                Active filter state AND sequence  

&nbsp;                position index at the moment the  

&nbsp;                annotation was written. An  

&nbsp;                annotation knows exactly where in  

&nbsp;                the thread it was made — which  

&nbsp;                entry was visible, which filters  

&nbsp;                were active.



}



Annotation requires a saved thread. If the user attempts to annotate before saving, the save dialog opens first with the annotation queued. After save confirms, the annotation is written with the new thread ID.



ANNOTATION MIRRORING RULE ━━━━━━━━━━━━━━━━━━━━━━━━━ saveAnnotation() writes to the thread\\\_annotations store AND mirrors the annotation into saved\\\_threads.annotations for fast load without a second store query.



deleteAnnotation() removes from both stores.



Both must stay in sync. Treat both writes as a unit. If the second write fails, the operation has not completed. Surface the error. Do not proceed with partial state.



IDB CONTRACT ━━━━━━━━━━━━ DB name: AelarianArchive Must match data.js DB\\\_NAME.



DB version: Coordinated with data.js DB\\\_VERSION. Increment data.js, update REQUIRED\\\_VERSION in thread\\\_trace\\\_db.js to match. Mismatched versions trigger onblocked and lock the tab. Never increment one without the other.



Stores owned here:



saved\\\_threads  

&nbsp; keyPath: 'id'  

&nbsp; indexes: thread\\\_type · last\\\_accessed · is\\\_deleted



thread\\\_annotations  

&nbsp; keyPath: 'id'  

&nbsp; indexes: thread\\\_id · timestamp



Both stores are created in data.js onupgradeneeded AND mirrored in thread\\\_trace\\\_db.js \\\_ensureStores() as a safety fallback.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SESSION-ONLY STATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



The current unsaved thread is held in memory only. No IDB write until the user explicitly saves.



setSessionThread(threadResult) Store current thread in memory.



getSessionThread() Read current thread.



clearSessionThread() Clear on overlay close or new thread open.



Session thread is cleared when the overlay closes or a new thread is opened. It is not cleared on panel transitions — thread state persists through panel changes intentionally.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEQUENCES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THREAD BUILD — strict order
1. Receive raw seed (entry id, tag id, finding object, or query string).
2. Call resolveSeed(rawSeed) → typed seed object { type, id, threadTypes }.
3. Fetch entry corpus — scoped to active section if a panel is active,
   full corpus if no panel is active.
4. Apply _applyFilters() to corpus using current filter state.
5. Select thread builder: iterate seed.threadTypes in priority order.
   Select first builder that can execute with the given seed type.
   If none can execute: fall back to TEMPORAL.
6. Run selected builder against filtered corpus.
7. Generate edge labels between all adjacent entry pairs via
   generateEdgeLabel().
8. Store thread result in session state via setSessionThread(threadResult).
9. Render in overlay — sequence view as default.
Failure at step 2: seed cannot be resolved → surface error. Do not open overlay.
Failure at step 3: corpus fetch fails → surface error. Do not open overlay.
Fallback at step 5: if selected builder cannot execute, fall back to TEMPORAL
  silently. Name the fallback in the UI — do not leave the user without context.

THREAD SAVE — strict order
1. Build routing snapshot: getTagRoutingSummary(entries) →
   buildRoutingSnapshot(threadResult).
2. Read active filter state via getActiveFilterState(). Null if TaggerBus
   not loaded — record null, do not block save.
3. Receive thread name from user.
4. Write saved_threads record: all fields, created_at = timestamp,
   last_accessed = timestamp.
5. Return thread id.
Failure at step 4: IDB write failure. No partial record written. Surface error.
  Retry permitted.

ANNOTATION SAVE — strict order
1. Validate thread is saved (thread_id exists on current session thread).
   If not: open save dialog. Queue annotation. Proceed only after save
   confirms with valid thread_id.
2. Capture filter_snapshot: active filter state + sequence position index
   at annotation time.
3. Write annotation record to thread_annotations store: id, thread_id,
   text, timestamp, filter_snapshot.
4. Mirror annotation into saved_threads.annotations array on the saved
   thread record.
Both writes succeed or the operation has not completed.
Failure at step 3: annotation not written. No mirror attempted. Retry permitted.
Failure at step 4: surface error. Do not proceed with partial state. Retry step 4.

THREAD LOAD — strict order
1. Retrieve saved_threads record by id via loadThread(threadId).
2. Return record including entry_ids.
3. Caller fetches live entries using entry_ids from IDB.
4. Caller passes live entries to buildThread() for re-render.
5. touchThread() called — writes last_accessed. No other field modified.
Note: entries reflect any updates made since the thread was saved.
  Thread Trace holds IDs only — it does not reconstruct entries.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ NEXUS FEED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



PATTERN CONVERGENCE (PCV · 50\\) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Reads: tag\\\_routing\\\_snapshot from saved threads — dominant routing dimensions and full distributions across the thread's entry set.



PCV uses saved thread snapshots as named cross-domain signal sources. A saved thread's routing distribution is a pre-aggregated alignment axis: the dominant seed\\\_id, pillar\\\_id, threshold\\\_id, and layer\\\_id across a coherent set of entries. PCV can align these against outputs from other domains without re-opening the thread.



LIBER NOVUS (LNV · 47\\) ━━━━━━━━━━━━━━━━━━━━━━━ Receives: processed Thread Trace outputs — sequence traces and structural visualizations built from thread data.



Thread Trace outputs that have been processed into findings land on LNV as part of the Daily Nexus Routine. They arrive with provenance intact: thread type, seed, routing snapshot, and entry set are all traceable. LNV holds them without editorializing.



DRIFT TAXONOMY (DTX · 48\\) ━━━━━━━━━━━━━━━━━━━━━━━━━ Reads: phase_state sequences surfaced by Temporal threads.



A Temporal thread ordered by originDate across a node's entries makes drift trajectories visible as a navigable sequence. The phase_state transitions between cards — the edge labels that read 'Solenne Arc → Aetherroot Chord' — are the state vectors DTX classifies. Thread Trace makes the trajectory legible. DTX receives it.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PUBLIC API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

thread_trace.js — pure logic engine (no DOM, no IDB, no Claude API)

ThreadTrace.resolveSeed(rawSeed) → Seed
Normalizes any raw entry point into a typed seed object before the thread
builder receives it. Returns { type, id, threadTypes }.

ThreadTrace.buildThread(seed, entries, filters?) → ThreadResult
Selects and runs the appropriate builder based on seed.threadTypes priority.
Falls back to TEMPORAL if the preferred builder cannot execute. Applies filters
via _applyFilters(). Returns the ordered entry set and thread metadata.

ThreadTrace.generateEdgeLabel(entryA, entryB, threadType) → string
Pure function. Produces a human-readable label for the relationship between
two adjacent thread entries. No external calls.

ThreadTrace.getTagRoutingSummary(entries) → RoutingSummary
Aggregates tag routing distribution across an entry set.

ThreadTrace.buildRoutingSnapshot(threadResult) → RoutingSnapshot
Wraps getTagRoutingSummary() output into the payload-ready routing snapshot
shape. Called at save time.

ThreadTrace.getActiveFilterState() → FilterState | null
Reads current TaggerBus result and maps routing dimensions to filter bar state.
Returns null if TaggerBus is not loaded — caller degrades gracefully.

thread_trace_ui.js — ThreadTraceUI singleton

ThreadTraceUI.open(rawSeed) → void
Routes raw seed through resolveSeed() → buildThread(). Opens the overlay.
The single entry point for all three trigger surfaces.

ThreadTraceUI.activatePanel(panelId) → void
Called on every panel open. Triggers _injectEntryPoints() to inject ∿ glyphs
on [data-entry-id] elements not yet marked [data-tt-injected].

thread_trace_db.js — IDB layer

ThreadTraceDB.saveThread(threadData) → Promise<string>
Writes saved_threads record. Returns thread id.

ThreadTraceDB.loadThread(threadId) → Promise<ThreadRecord>
Returns saved thread record including entry_ids. Does not fetch live entries.

ThreadTraceDB.listThreads() → Promise<ThreadRecord[]>
Returns all saved threads with is_deleted === false.

ThreadTraceDB.deleteThread(threadId) → Promise<void>
Sets is_deleted = true. Does not remove the record.

ThreadTraceDB.touchThread(threadId) → Promise<void>
Updates last_accessed only. No other field modified.

ThreadTraceDB.saveAnnotation(annotation) → Promise<string>
Writes to thread_annotations store and mirrors into saved_threads.annotations.
Both writes treated as a unit. Returns annotation id.

ThreadTraceDB.deleteAnnotation(annotationId) → Promise<void>
Removes from thread_annotations and from saved_threads.annotations mirror.
Both writes treated as a unit.

ThreadTraceDB.setSessionThread(threadResult) → void
Stores current thread in memory. No IDB write.

ThreadTraceDB.getSessionThread() → ThreadResult | null
Returns current in-memory thread or null.

ThreadTraceDB.clearSessionThread() → void
Clears in-memory thread. Called on overlay close or new thread open.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ KNOWN FAILURE MODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



1\. RELATIONAL THREAD WITH NO linkedEntries DATA Falls back to TEMPORAL silently. No error thrown. User sees a temporal thread where they expected a relational one, with no indication of why. Guard: name the fallback in the UI when it occurs — "Relational thread unavailable: no entry links found. Showing temporal view."



2\. DB VERSION MISMATCH BETWEEN data.js AND thread\\\_trace\\\_db.js onblocked fires and the tab locks. Any open tab on the old version prevents the upgrade. Guard: REQUIRED\\\_VERSION in thread\\\_trace\\\_db.js must always match DB\\\_VERSION in data.js. Update both in the same change. Never increment one without the other.



3\. ANNOTATION WRITTEN BEFORE THREAD IS SAVED Annotation has no thread ID to reference. Silent failure or orphaned record. Guard: save dialog opens before annotation is written. Annotation is queued and written only after save confirms with a valid thread ID.



4\. ANNOTATION MIRROR OUT OF SYNC saveAnnotation() or deleteAnnotation() writes to one store but fails before writing to the other. The fast-load mirror diverges from the annotations store. Guard: treat both writes as a unit. If the second write fails, the operation has not completed. Surface the error rather than proceeding with partial state.



5\. THREAD OPENED FROM PANEL WITH ACTIVE SECTION SCOPING Entry fetch is scoped to the active section. A thread that should span multiple sections returns a subset. User may not realize the thread is section-scoped. Guard: display active scope in the filter bar header. If section filter is active from panel context, make it visible and clearable.



6\. GRAPH EXPORT BEFORE GRAPH PAGE EXISTS GRAPH\\\_PAGE\\\_PATH \\= '/graph' is a stub. Routing there before the page is built produces dead navigation. Guard: graph export button remains disabled until GRAPH\\\_PAGE\\\_PATH is a live route. Update both emergence.js and thread\\\_trace\\\_ui.js when the graph page is built.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



thread\\\_trace.js Pure logic engine — four thread builders, seed resolution, edge label generation, routing summary, filter state, routing snapshot assembly. No DOM. No IDB. No Claude API. Status: PLANNED



thread\\\_trace\\\_ui.js ThreadTraceUI singleton — overlay shell, sequence view, graph view, filter bar, annotation layer, glyph injection, entry point wiring, save dialog. Status: PLANNED



thread\\\_trace\\\_db.js IDB layer — saved\\\_threads store, thread\\\_annotations store, annotation mirroring, session-only state. Status: PLANNED

