# **SYSTEM: Thread Trace**

## **thread\_trace\_system.md**

### **/DOCS/systems/**

---

## **WHAT THIS SYSTEM OWNS**

* Four thread builders — Temporal · Relational · Cluster · Emergence  
* Seed resolution — normalizing any entry point into a typed seed object  
* Edge label generation per thread edge  
* Tag routing summary across a thread's entry set  
* Active filter state — reading TaggerBus context for filter pre-population  
* Routing snapshot — assembled at save time, stored with the saved thread record  
* Overlay UI — one shell, sequence view, graph view, filter bar, annotation layer  
* Saved threads IDB — `saved_threads` store, `thread_annotations` store  
* Session-only thread state — in memory, no IDB write until save is triggered

## **WHAT THIS SYSTEM DOES NOT OWN**

* Tag vocabulary or routing records — owned by tags-vocab.js  
* Entry data, entry schema, or IDB entry reads/writes — owned by data.js  
* Emergence pattern detection — owned by emergence.js  
* TaggerBus result or pipeline — owned by tagger\_bus.js  
* The entries Thread Trace reads from — it receives, never writes

---

## **THREAD TYPES**

Four thread types. All four use the same overlay shell. The builder changes. The UI does not.

### **TEMPORAL**

Orders entries chronologically along a shared arc or phase trajectory.

When the seed is an entry, scopes to entries sharing the same arcPhase or section as the anchor. When the seed is a tag, scopes to entries carrying that tag. When the seed is a finding, scopes to the finding's involved entries.

**Fallback:** if the scoped pool contains fewer than 3 entries, falls back to the full corpus automatically. Temporal is the default fallback for any thread type that cannot execute with the given seed.

### **RELATIONAL**

Traverses entry-to-entry links via `linkedEntries` on each entry, then extends outward through shared tag routing to fill depth.

Traversal is BFS from the seed entry. MAX\_DEPTH \= 4 hops. MAX\_ENTRIES \= 30\.

**Fallback:** if the seed is not type `entry`, falls back to TEMPORAL.

**BLOCKER:** Relational threads require `linkedEntries` to be populated on entries. Until entries carry valid `linkedEntries` data, Relational threads fall back to TEMPORAL silently. The builder is written and ready — it activates when the data exists.

### **CLUSTER**

Groups entries that share a dominant tag cluster. Seed can be a tag ID or an entry — if entry, the dominant tag from that entry's routing record anchors the cluster.

Entries are ranked by tag overlap count with the seed cluster. Operates on the full corpus — no section scoping.

### **EMERGENCE**

Entries linked by Emergence findings and co-occurrence patterns. Seed is a finding object from emergence.js. The builder reads `involvedEntries` from the finding and extends outward through shared tag routing.

Bridges directly to `detectEmergence()` in emergence.js — fires fresh detection or uses an existing finding passed from the Emergence overlay.

---

## **SEED RESOLUTION**

`resolveSeed()` normalizes any raw entry point into a typed seed object before the thread builder receives it. All three entry points route through `resolveSeed()` before `buildThread()` is called.

**Seed shape:**

{  
  type:        'entry' | 'tag' | 'finding' | 'query'  
  id:          string | object   — entry ID, tag ID, finding object, or query string  
  threadTypes: string\[\]          — preferred thread types for this seed, in order  
}

**Resolution rules:**

finding object (has findingType or involvedTags)  
  → type: 'finding'  
  → threadTypes: \['emergence', 'cluster'\]

raw seed object with explicit threadTypes  
  → type guessed from id prefix or pattern  
  → threadTypes: carried from raw object

plain string starting with tv\_ or matching short-code pattern  
  → type: 'tag'  
  → threadTypes: \['cluster', 'temporal'\]

plain string (entry ID)  
  → type: 'entry'  
  → threadTypes: \['relational', 'temporal'\]

query string (free text, no matching ID pattern)  
  → type: 'query'  
  → threadTypes: \['temporal', 'cluster'\]

**Query seed type:**

A `query` seed scopes entries by text content match rather than requiring a known entry ID, tag ID, or finding object. It enables ad-hoc pattern exploration without a specific anchor — the difference between "trace from this entry" and "trace everything related to X." Thread type defaults to TEMPORAL scoped by content match, then CLUSTER by dominant tag overlap in the matched set.

---

## **ENTRY POINTS**

Three surfaces trigger Thread Trace. All three call `open(rawSeed)` which routes through `resolveSeed()` → `buildThread()`.

| Surface | Trigger | Seed shape passed |
| ----- | ----- | ----- |
| Entry meta strip | ∿ glyph click — injected on every `[data-entry-id]` element | `{ seed: entry.id, threadTypes: ['relational', 'temporal'] }` |
| Tag pill | Right-click / contextmenu on any `[data-tag-id]` element | `{ seed: tag.id, threadTypes: ['cluster', 'temporal'] }` |
| Emergence finding card | "Trace this pattern" action | `{ seed: findingObj, threadTypes: ['emergence'] }` |

**Glyph injection:** `_injectEntryPoints()` runs on every `activatePanel()` call. Injects ∿ on `[data-entry-id]` elements not yet marked `[data-tt-injected]`. Tag pill contextmenu is delegated globally once, guarded by `window.__ttTagDelegateSet` to prevent duplicate listeners.

**Entry fetch scoping:** when a panel is active, Thread Trace scopes entry fetches to the active section. When no panel is active, the full corpus is fetched. This means threads opened from within a panel are section-scoped by default and can be broadened via the filter bar.

---

## **TWO VIEWS**

Both views render inside the same overlay shell. The user can switch between them without closing the thread.

### **Sequence View**

Ordered card list. Each card represents one entry in the thread. Navigation is linear — previous / next — with a progress bar showing position in the sequence. Card content: title, body preview, arcPhase, origin affinity, dominant tag routing, and edge label connecting to the next card.

### **Graph View**

Structural map of thread entries as nodes with edges. Edge labels show the relationship between connected entries — shared tag, explicit link, phase transition, or temporal interval. Graph export assembles a `ThreadGraphPayload` and routes to the graph page.

**PLANNED:** graph page path — `GRAPH_PAGE_PATH = '/graph'`. Update when the graph page is built. Graph export is a stub until then.

---

## **FILTER BAR**

Active across both views. Four routing dimensions plus arc phase and section:

pillar\_id   — p01 | p02 | p03  
seed\_id     — s01–s20  
layer\_id    — l01–l04  
threshold\_id — t01–t12  
arcPhase    — aetherrot | solenne | vireth  
section     — any section ID

Filters are applied at `buildThread()` call time via `_applyFilters()`. Changing a filter rebuilds the thread against the current corpus with the new constraints.

**Pre-population:** on overlay open, `getActiveFilterState()` reads the current TaggerBus result and maps its routing dimensions to the filter bar. If TaggerBus has an active result, the filter bar opens pre-scoped to that context.

---

## **TAGGERBUS RELATIONSHIP**

Thread Trace is a read-only consumer of TaggerBus. It reads at two moments and never writes to it. It never calls `TaggerBus.clearResult()`.

| Moment | What Thread Trace does | Call |
| ----- | ----- | ----- |
| On overlay open | Reads active filter state to pre-populate filter bar | `TaggerBus.getResult()` |
| On thread save | Included in routing snapshot assembly | `TaggerBus.getResult()` via `getActiveFilterState()` |

`getActiveFilterState()` returns null silently if TaggerBus is not loaded. Thread Trace degrades gracefully — filter bar opens empty, routing snapshot records null filter state.

---

## **EDGE LABELS**

`generateEdgeLabel(entryA, entryB, threadType)` is a pure function. No external calls. Produces a human-readable label for the relationship between two adjacent entries in a thread.

**Label logic by thread type:**

TEMPORAL  
  — phase transition if arcPhase differs between entries: 'solenne → vireth'  
  — temporal interval if same phase: '3d apart' | '2w apart' | '1mo apart'  
  — 'same day' if within the same calendar day

RELATIONAL  
  — 'explicit link' if entries reference each other via linkedEntries  
  — up to two shared tag IDs if no explicit link: 'phase\_transitions · criticality'  
  — 'routing proximity' if no shared tags

CLUSTER  
  — dominant shared tag ID

EMERGENCE  
  — '↑ \[shared tag\]' for co-occurrence link  
  — 'pattern link' if no shared tags identifiable

---

## **ROUTING SNAPSHOT**

Built at save time from the thread's full entry set. Stored with the saved thread record. Read by Pattern Convergence as cross-domain alignment data.

**Shape:**

{  
  dominantPillar\_id:    string | null  
  dominantSeed\_id:      string | null  
  dominantLayer\_id:     string | null  
  dominantThreshold\_id: string | null  
  entryCount:           integer  
  edgeCount:            integer  
  threadType:           string  
  distributions: {  
    pillars:    { \[pillar\_id\]: count }  
    seeds:      { \[seed\_id\]: count }  
    layers:     { \[layer\_id\]: count }  
    thresholds: { \[threshold\_id\]: count }  
  }  
}

`getTagRoutingSummary(entries)` aggregates routing distribution across the entry set. `buildRoutingSnapshot(threadResult)` wraps that summary into the payload-ready shape above.

---

## **SAVED THREADS AND ANNOTATIONS**

### **Saved Thread Record**

{  
  id:                   string    — 'thr\_\[timestamp\]\_\[rand\]'  
  name:                 string    — user-defined at save time  
  thread\_type:          string    — one of the four thread type values  
  seed:                 object    — serialized seed (finding objects reduced to  
                                    key fields only for JSON safety)  
  entry\_ids:            string\[\]  — IDs of entries in the thread at save time  
  filter\_state:         object    — active filter at save time  
  tag\_routing\_snapshot: object    — routing snapshot, see above  
  annotations:          object\[\]  — mirrored annotation array for fast load  
  created\_at:           ISO string  
  last\_accessed:        ISO string  
  is\_deleted:           boolean  
}

**Soft delete:** `deleteThread()` sets `is_deleted = true`. Does not remove the record. `listThreads()` filters deleted records automatically.

**`touchThread()`:** updates `last_accessed` without modifying any other field. Called when a saved thread is re-opened from the thread list.

**`loadThread()` does not reconstruct entries.** It returns the saved record including `entry_ids`. The caller fetches the live entries separately using those IDs and passes them to `buildThread()` for re-render. This keeps saved threads current — the entries they reference reflect any updates made since the thread was saved.

### **Annotations**

{  
  id:              string    — 'ann\_\[timestamp\]\_\[rand\]'  
  thread\_id:       string    — references saved\_threads.id  
  text:            string  
  timestamp:       ISO string  
  filter\_snapshot: object    — active filter state AND sequence position  
                               at the moment the annotation was written  
}

**Annotation requires a saved thread.** If the user attempts to annotate before saving, the save dialog opens first with the annotation queued. After save confirms, the annotation is written with the new thread ID.

**Positioned annotations:** `filter_snapshot` carries both the active routing filter state and the sequence position index at time of writing. An annotation knows exactly where in the thread it was made — which entry was visible, which filters were active.

**Annotation mirroring:** `saveAnnotation()` writes to the `thread_annotations` store AND mirrors the annotation into `saved_threads.annotations` for fast load without a second store query. `deleteAnnotation()` removes from both. Both must stay in sync.

### **IDB Contract**

DB name:           AelarianArchive    — must match data.js DB\_NAME  
DB version:        coordinated with data.js DB\_VERSION — increment data.js,  
                   update REQUIRED\_VERSION in thread\_trace\_db.js to match.  
                   Mismatched versions trigger onblocked and lock the tab.

Stores owned here:  
  saved\_threads      keyPath: 'id'  
                     indexes: thread\_type · last\_accessed · is\_deleted  
  thread\_annotations keyPath: 'id'  
                     indexes: thread\_id · timestamp

Both stores are created in data.js onupgradeneeded AND mirrored in  
thread\_trace\_db.js \_ensureStores() as a safety fallback.

---

## **SESSION-ONLY STATE**

The current unsaved thread is held in memory only. No IDB write until the user explicitly saves.

setSessionThread(threadResult)   — store current thread in memory  
getSessionThread()               — read current thread  
clearSessionThread()             — clear on overlay close or new thread open

Session thread is cleared when the overlay closes or a new thread is opened. It is not cleared on panel transitions — thread state persists through panel changes intentionally.

---

## **NEXUS FEED**

**Pattern Convergence (PCV · 50\)**

Reads: `tag_routing_snapshot` from saved threads — dominant routing dimensions and full distributions across the thread's entry set.

PCV uses saved thread snapshots as named cross-domain signal sources. A saved thread's routing distribution is a pre-aggregated alignment axis: the dominant seed\_id, pillar\_id, threshold\_id, and layer\_id across a coherent set of entries. PCV can align these against outputs from other domains without re-opening the thread.

**Liber Novus (LNV · 47\)**

Receives: processed Thread Trace outputs — sequence traces and structural visualizations built from thread data.

Thread Trace outputs that have been processed into findings land on LNV as part of the Daily Nexus Routine. They arrive with provenance intact: thread type, seed, routing snapshot, and entry set are all traceable. LNV holds them without editorializing.

**Drift Taxonomy (DTX · 48\)**

Reads: arcPhase sequences surfaced by Temporal threads.

A Temporal thread ordered by originDate across a node's entries makes drift trajectories visible as a navigable sequence. The arcPhase transitions between cards — the edge labels that read `solenne → aetherrot` — are the state vectors DTX classifies. Thread Trace makes the trajectory legible. DTX receives it.

---

## **SEQUENCES**

### **THREAD BUILD SEQUENCE — strict order**

1. `resolveSeed(rawSeed)` called. Raw entry point normalized into typed seed object.
2. Entry corpus fetched. Scoped to active section if a panel is active; full corpus
   if not.
3. `_applyFilters()` called with active filterState. Corpus filtered to matching
   entries.
4. Preferred thread type selected from seed.threadTypes in order. Builder attempted.
5. If builder cannot execute (insufficient entries, missing linkedEntries,
   incompatible seed type): fallback to next type in seed.threadTypes. If all
   preferred types fail: TEMPORAL with full corpus.
6. Builder produces ThreadResult: entry\_ids, edges, edge labels, thread type.

Failure at step 1 (seed cannot be resolved): thread build aborted. Guard:
  resolveSeed() returns null for unresolvable input. buildThread() checks for
  null seed before proceeding.
Failure at step 2 (corpus fetch fails): thread build cannot proceed. Guard:
  fetch failure surfaced to caller. Overlay shows error state — not empty thread.
Failure at step 4 (builder throws): fallback to TEMPORAL with full corpus. Guard:
  each builder runs in isolation. A builder failure does not halt the fallback chain.

### **THREAD SAVE SEQUENCE — strict order**

1. `buildRoutingSnapshot(threadResult)` called. Routing distributions computed
   from thread's entry set.
2. `getActiveFilterState()` called via TaggerBus.getResult(). Active filter state
   captured. Null if TaggerBus not loaded.
3. Write saved\_threads record: id, name, thread\_type, seed, entry\_ids,
   filter\_state, tag\_routing\_snapshot, annotations=\[\], created\_at,
   last\_accessed, is\_deleted=false.
4. Return saved thread id.

Failure at step 3 (IDB write fails): no record created. Save has not occurred.
  Guard: error surfaced to caller — no silent failure. User can retry.

### **ANNOTATION SAVE SEQUENCE — strict order**

1. Validate thread is saved — saved thread id must exist in saved\_threads. If not:
   open save dialog, queue annotation. Resume after save confirms.
2. Capture filter\_snapshot: active filter state AND current sequence position index.
3. Write thread\_annotations record: id, thread\_id, text, timestamp, filter\_snapshot.
4. Mirror annotation into saved\_threads.annotations array for the parent thread.

Failure at step 3: annotation not written. Mirror not attempted. Guard: error
  surfaced. Retry from step 3.
Failure at step 4: annotation exists in thread\_annotations but not mirrored.
  Guard: surface the error. Do not proceed with partial state. The annotation is
  not considered saved until the mirror write at step 4 confirms.

### **THREAD LOAD SEQUENCE — strict order**

1. `loadThread(threadId)` called. Retrieve saved\_threads record.
2. Return full saved record including entry\_ids and annotations.
3. Caller fetches live entries from data.js using entry\_ids. Entry data reflects
   any updates made since thread was saved.
4. Caller passes live entries and saved seed to `buildThread()` for re-render.
5. `touchThread(threadId)` called. last\_accessed updated.

Failure at step 1 (record not found or is\_deleted=true): load aborted. Guard:
  loadThread() checks is\_deleted flag. Deleted threads are not returned.
Failure at step 3 (entry fetch fails): thread cannot be re-rendered. Saved record
  is intact. Guard: error surfaced. entry\_ids remain valid — retry resolves when
  data layer recovers.

---

## **PUBLIC API**

### **thread\_trace.js**

**ThreadTrace.resolveSeed(rawSeed) → Seed**
Normalizes any raw entry point into a typed seed object before the thread builder
receives it. Returns null if input cannot be resolved.

**ThreadTrace.buildThread(seed, corpus, filterState?) → ThreadResult**
Selects and runs the appropriate builder from seed.threadTypes in order. Falls
back through the preferred type list. Final fallback is TEMPORAL with full corpus.

**ThreadTrace.generateEdgeLabel(entryA, entryB, threadType) → string**
Pure function. Produces a human-readable relationship label for two adjacent
entries in a thread. No external calls.

**ThreadTrace.getTagRoutingSummary(entries) → RoutingSummary**
Aggregates routing distribution (pillar, seed, layer, threshold counts) across
the entry set. Used by buildRoutingSnapshot().

**ThreadTrace.buildRoutingSnapshot(threadResult) → RoutingSnapshot**
Wraps the routing summary into the payload-ready snapshot shape for saving with
the thread record. Called at save time.

**ThreadTrace.getActiveFilterState() → FilterState | null**
Reads current TaggerBus result and maps routing dimensions to filter bar context.
Returns null if TaggerBus is not loaded or has no active result.

### **thread\_trace\_ui.js**

**ThreadTraceUI.open(rawSeed) → void**
Entry point for all three surfaces (entry glyph, tag pill, Emergence finding card).
Routes through resolveSeed() → buildThread(). Opens overlay.

**ThreadTraceUI.activatePanel(panelId, sectionId) → void**
Called on panel open. Injects ∿ entry points on \[data-entry-id\] elements.
Scopes entry fetches to active section.

### **thread\_trace\_db.js**

**ThreadTraceDB.saveThread(threadResult, name) → Promise\<string\>**
Writes saved\_threads record. Returns saved thread id.

**ThreadTraceDB.loadThread(threadId) → Promise\<ThreadRecord\>**
Retrieves saved\_threads record. Returns record including entry\_ids. Does not
fetch live entries — caller fetches separately.

**ThreadTraceDB.listThreads() → Promise\<ThreadRecord\[\]\>**
Returns all saved\_threads records where is\_deleted=false.

**ThreadTraceDB.deleteThread(threadId) → Promise\<void\>**
Soft delete. Sets is\_deleted=true. Does not remove the record.

**ThreadTraceDB.touchThread(threadId) → Promise\<void\>**
Updates last\_accessed on the saved thread record. Called on every thread load.

**ThreadTraceDB.saveAnnotation(threadId, text, filterSnapshot) → Promise\<string\>**
Writes thread\_annotations record and mirrors into saved\_threads.annotations.
Both writes required — partial state is not acceptable.

**ThreadTraceDB.deleteAnnotation(annotationId) → Promise\<void\>**
Removes from thread\_annotations and from saved\_threads.annotations mirror.
Both removals required.

**ThreadTraceDB.setSessionThread(threadResult) → void**
Stores current unsaved thread in memory. No IDB write.

**ThreadTraceDB.getSessionThread() → ThreadResult | null**
Returns current in-memory thread. Null if no thread is active.

**ThreadTraceDB.clearSessionThread() → void**
Clears in-memory thread. Called on overlay close or new thread open.

---

## **KNOWN FAILURE MODES**

**1\. Relational thread with no linkedEntries data** Falls back to TEMPORAL silently. No error is thrown. The user sees a temporal thread where they expected a relational one, with no indication of why. Guard: name the fallback in the UI when it occurs — "Relational thread unavailable: no entry links found. Showing temporal view."

**2\. DB version mismatch between data.js and thread\_trace\_db.js** `onblocked` fires and the tab locks. Any open tab on the old version prevents the upgrade. Guard: REQUIRED\_VERSION in thread\_trace\_db.js must always match DB\_VERSION in data.js. Update both in the same change. Never increment one without the other.

**3\. Annotation written before thread is saved** Annotation has no thread ID to reference. Silent failure or orphaned record. Guard: save dialog opens before annotation is written. Annotation is queued and written only after save confirms with a valid thread ID.

**4\. Annotation mirror out of sync** saveAnnotation() or deleteAnnotation() writes to one store but fails before writing to the other. The fast-load mirror diverges from the annotations store. Guard: treat both writes as a unit. If the second write fails, the operation has not completed. Surface the error rather than proceeding with partial state.

**5\. Thread opened from a panel with active section scoping** Entry fetch is scoped to the active section. A thread that should span multiple sections returns a subset. User may not realize the thread is section-scoped. Guard: display active scope in the filter bar header. If section filter is active from panel context, make it visible and clearable.

**6\. Graph export before graph page exists** `GRAPH_PAGE_PATH = '/graph'` is a stub. Routing there before the page is built produces a dead navigation. Guard: graph export button remains disabled until GRAPH\_PAGE\_PATH is a live route. Update both emergence.js and thread\_trace\_ui.js when the graph page is built.

---

## **FILES**

| File | Role | Status |
| ----- | ----- | ----- |
| `thread_trace.js` | Pure logic engine — four thread builders, seed resolution, edge label generation, routing summary, filter state, routing snapshot assembly. No DOM. No IDB. No Claude API. | PLANNED |
| `thread_trace_ui.js` | ThreadTraceUI singleton — overlay shell, sequence view, graph view, filter bar, annotation layer, glyph injection, entry point wiring, save dialog | PLANNED |
| `thread_trace_db.js` | IDB layer — saved\_threads store, thread\_annotations store, annotation mirroring, session-only state | PLANNED |

