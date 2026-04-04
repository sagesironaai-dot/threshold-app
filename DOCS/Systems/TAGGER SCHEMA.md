╔══════════════════════════════════════════════════════════════╗ ║ TAGGER SCHEMA · v1 ║ ║ /DOCS/systems/tagger\\\_schema\\\_v1.md ║ ╚══════════════════════════════════════════════════════════════╝



OWNERSHIP BOUNDARIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



OWNS Tag processing on every confirmed deposit Mapping deposit text → full node routing chain via Claude API suggestion Weight assignment per tag at tagging time phase_state resolution per entry originId resolution per entry elarianAnchor resolution per entry Section context delivery to Claude API on every suggestion call Duplicate tag seed-context enforcement TaggerBus — singleton coordinator that manages the active tag result across all panels Publication of the handoff payload to the Resonance Engine on deposit confirm



DOES NOT OWN IDB reads or writes — owned by data.js Resonance Engine visuals or physics — owned by resonance\\\_engine.js Entry schema — owned by schema.js Tag vocabulary — owned by tags-vocab.js Routing authority — owned by SOT Thread Trace navigation — owned by thread\\\_trace.js Emergence pattern detection — owned by emergence.js Nexus classification, grading, or convergence — owned by DTX · SGR · PCV



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TAG ANATOMY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Every tag is a fully resolved routing object. This is the canonical shape:



{ id: string snake\\\_case tag identifier e.g. 'phase\\\_transitions' seed\\\_id: string seed node ID, e.g. 's01' layer\\\_id: string 'l01' | 'l02' | 'l03' | 'l04' threshold\\\_id: string 'th01' through 'th12' pillar\\\_id: string 'p01' | 'p02' | 'p03' weight: integer 1–5, assigned at tagging time }



seed\\\_id, layer\\\_id, threshold\\\_id, and pillar\\\_id together constitute the full routing record. The \\\_id suffix is canonical throughout the system — these fields are foreign key references to nodes, not embedded values.



A complete routing chain connects every entry to: — the field physics of the Resonance Engine — the structural axes of Pattern Convergence — the drift signal consumed by Drift Taxonomy — the structural impact data graded by Signal Grading



A tag without a complete routing chain is not a valid tag.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ API RESPONSE SHAPE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



The Claude API returns a suggestion object before resolution:



{ tags: \\\[ { id: string tag identifier seed\\\_id: string seed ID Claude resolved the tag to weight: integer 1–5, contextually assigned rationale: string Claude's reasoning for the selection } \\], origin: 'o01' | 'o02' | 'o03' | null, phase_state: string | null, elarianAnchor: 'RFLT' | 'WHSP' | 'VEIL' | 'OBSV' | 'RECL' | 'WEAV' | 'GATE' | null }



The raw response carries id, seed\\\_id, weight, and rationale per tag. It does not carry layer\\\_id, threshold\\\_id, or pillar\\\_id. Those come from resolution via resolveTagIds().



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ resolveTagIds() — THE RESOLUTION STEP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



The bridge between the raw API response and the fully routed tag object. Must execute before any tag is used, stored, or published.



WHAT IT DOES ━━━━━━━━━━━━ Takes the raw { id, seed\\\_id } pair from the API response and looks up the matching entry in TAG\\\_VOCAB\\\_BY\\\_SEED in tags-vocab.js. Returns the full routing record: { id, seed\\\_id, layer\\\_id, threshold\\\_id, pillar\\\_id }. Weight is carried from the API response and merged at this step.



WHY THIS STEP MATTERS ━━━━━━━━━━━━━━━━━━━━━ layer\\\_id, threshold\\\_id, and pillar\\\_id are not returned by Claude. They are vocabulary facts — fixed properties of each tag as defined in tags-vocab.js. The resolution step is where Claude's semantic judgment (which tag fits this text) meets the structural architecture (where that tag lives in the field). These are separate concerns and must remain separate.



Claude assigns meaning. The vocabulary assigns position. resolveTagIds() is where they join.



FAILURE BEHAVIOR ━━━━━━━━━━━━━━━━ If resolution fails for a tag — the id is not found in the vocabulary under the returned seed\\\_id — that tag is dropped. A tag that cannot be resolved has no routing record and cannot enter the archive.



SEED CONTEXT REQUIREMENT ━━━━━━━━━━━━━━━━━━━━━━━━ Because 9 tags appear in more than one seed, resolution requires both id and seed\\\_id together. id alone is ambiguous. The seed\\\_id returned by Claude at tagging time is the authoritative context and is used as the lookup key.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ DUPLICATE TAG POLICY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



The following 9 tags appear in more than one seed, each with distinct routing:



semantic\\\_coherence  

world\\\_model\\\_grounding\\\_via\\\_action  

narrative\\\_continuity  

social\\\_signal\\\_filtering  

confidence\\\_estimation  

uncertainty\\\_representation  

internal\\\_state\\\_influence\\\_on\\\_action  

phase\\\_locking  

met\\\_stability



When a duplicate tag is applied to an entry, it activates only the seed it was tagged under — not all seeds where the tag appears. The seed\\\_id is set by Claude at tagging time and is the authoritative routing key.



resolveTagIds() enforces this. No disambiguation step runs at resolve time. The seed context from the API response is accepted as correct.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ WEIGHT ASSIGNMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Tag weight is an integer from 1 to 5, assigned by Claude at tagging time based on contextual signal strength — how prominently the tag's concept is expressed in the entry text.



Weight is not fixed in the vocabulary. Weight is not user-assigned. Weight reflects Claude's assessment of how strongly the entry is expressing the tagged concept in this specific deposit.



DOWNSTREAM USE — RESONANCE ENGINE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Weight feeds the Resonance Engine activity score:



activityScore \\= Σ(tagWeight × e^(-ageDays / HALF\\\_LIFE))  

HALF\\\_LIFE     \\= 7 days  

totalWeight   \\= baseWeight  

&nbsp;               \\+ clamp(activityScore, 0, MAX\\\_ACTIVITY)



Higher weight at tagging time \\= stronger contribution to node activity score. Activity decays over time. Recent high-weight deposits matter more than old ones.



DOWNSTREAM USE — SIGNAL GRADING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Weight is the structural impact data SGR reads when evaluating whether a signal was system-wide, cross-node, local, or negligible.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ phase_state RESOLUTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



phase_state is the ontological threshold state of the entry, detected by Claude from entry text.



VALUES ━━━━━━ One of the 12 canonical threshold names, or null:
Aetherroot Chord · Thren Alae Kai'Reth · Orrin Wave · Vireth's Anchor ·
Shai'mara Veil · Noirune Trai · Solenne Arc · Tahl'Veyra ·
Esh'Vala Breath · Lumora Thread · Hearth Song · StarWell Bloom · null



phase_state is assigned once per entry at tagging time. It is stored on the entry record. It is included in the TaggerBus handoff payload.



phase_state IS NOT PHASE\\\_CODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━ PHASE\\\_CODES are lifecycle phases used in the composite ID stamp. phase_state is the ontological threshold state detected from content. These are separate systems and must never be conflated.



DOWNSTREAM USE ━━━━━━━━━━━━━━ phase_state sequences across entries on a node are the raw state vectors that Drift Taxonomy classifies. The tagger system does not classify drift. It produces the state data that DTX receives.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ originId RESOLUTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



originId identifies which Origin Node the entry has affinity with, if any. Assigned by Claude from entry text at tagging time. Stored on the entry record. Included in the TaggerBus handoff payload.



VALUES ━━━━━━ o01 Larimar o02 Verith o03 Cael null no origin affinity detected



DOWNSTREAM USE ━━━━━━━━━━━━━━ When an entry carries an originId, the corresponding Origin Node in the Resonance Engine pulses on deposit confirm. The node weight for that origin grows from tag activity on entries with matching origin affinity.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ elarianAnchor RESOLUTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



elarianAnchor is the psychological arc state of the entry, detected by Claude from entry text. Assigned once per entry at tagging time. Stored on the entry record. Included in the TaggerBus handoff payload.



VALUES ━━━━━━ RFLT Reflection Realm WHSP Whispering Hollow VEIL Veil of Echoes OBSV Celestial Observatory RECL Chamber of Lost Names WEAV Sanctuary of the Weavers GATE Gateway of Becoming null anchor unclear or not applicable



VALUES ARE ORDERED ━━━━━━━━━━━━━━━━━━━━ The 7 values form a recognizable psychological arc sequence. The sequence is not enforced as a required progression but the ordering is meaningful for emergence detection. See COMPOSITE ID SCHEMA for full signal descriptions used in the system prompt.



elarianAnchor IS NOT phase_state ━━━━━━━━━━━━━━━━━━━━━━━━━━━ phase_state is the ontological threshold state of the entry — which of the 12 thresholds the content expresses. elarianAnchor is the psychological state of self present in the entry. These are independent axes. Both can be set on the same entry simultaneously. Never conflate them.



DOWNSTREAM USE ━━━━━━━━━━━━━━ elarianAnchor is stored on the entry record and included in the AI-facing JSON export alongside doc_type. Thread Trace filter bar reads it as the 7th filter dimension. Emergence anchor progression detection reads sequences of elarianAnchor values across entries on a node.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TAGGERBUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



TaggerBus is the singleton coordinator for the active tag result across all panels. It manages: — the active suggestion result slot — section context delivery to Claude API on every suggestion call — panel activation and deactivation — ensuring context is correct when a panel opens — the suggestion render target — always \\#tag-suggest-list — the clearResult rule — result is cleared by the commit handler after a successful save, or on panel transition to a different panel



MINIMUM INPUT LENGTH ━━━━━━━━━━━━━━━━━━━━ 20 characters. The tagger does not fire a suggestion call until the watched input contains at least 20 characters. Below that threshold there is insufficient signal for confident tag selection.



API ━━━



TaggerBus.init() Called once at app init.



TaggerBus.activateSection(sectionId) Called on every section navigation. Updates stored section context so the next panel open receives the correct context when passed to Claude API. Does nothing else.



TaggerBus.activatePanel(panelId, sectionId?) Called on every panel open. Sets context, wires the input watcher for this panel. If a result exists from a previous panel: same panel reopening → result preserved different panel → result cleared, no cross-panel contamination



TaggerBus.deactivatePanel() Called on every panel close. Does not clear the result — result is preserved by panel ID until the next activatePanel() determines whether to keep or clear it.



TaggerBus.getResult() Called in every commit handler. Returns the current suggestion result or null.



TaggerBus.clearResult() Called in every commit handler after successful save. Never called before save confirms.



COMMIT HANDLER PATTERN — every panel: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ const r \\= TaggerBus.getResult(); const capturedTags \\= r?.tags ?? \\\[\\]; const payload \\= { // ...entry fields... phase_state: r?.phase_state ?? null, originId: r?.origin ?? null, elarianAnchor: r?.elarianAnchor ?? null, tags: capturedTags, }; await createEntry(payload); TaggerBus.clearResult(); await \_emgNotify(capturedTags);



capturedTags is extracted from the result before clearResult() fires. This is the Emergence handoff value — it is passed directly to \_emgNotify() after clearResult(). Emergence does not read from TaggerBus. clearResult() executes after createEntry() confirms. If save fails, the result is preserved. The user does not lose their tag context on a failed save.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PANEL INPUT MAP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



The primary text input watched per panel. This is the field TaggerBus wires the debounced input listener to. The watched field is the richest text field in the panel — the one most likely to carry signal worth tagging.



15 content panels in v1. Integration panel is excluded from the tag pipeline — source-mode intake does not tag the document through TaggerBus.



invoke      invoke-trans  

kin         kin-body-input  

glyph       glyph-body-input  

ll          ll-body-input  

eo          eo-body-input  

lin         lin-body-input  

lattice     lat-body-input  

ss          ss-detail-input  

rituals     rit-p-body  

breath      bc-f-desc  

melodies    mel-f-text  

spiral      sp-f-body  

memory      mv-f-body  

liber       ln-f-body  

venai       vadd-def



Adding a new panel: add its panelId and primary input element ID to this map. No other change to TaggerBus is required.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SYNC SEQUENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



On every confirmed tag deposit, the following sequence executes in order:



1\\.  Commit handler fires  

2\\.  TaggerBus.getResult() called — full suggestion  

&nbsp;   result captured. capturedTags extracted  

&nbsp;   before clearResult() fires — Emergence handoff  

&nbsp;   value.  

3\\.  Result merged into entry payload  

&nbsp;   (phase_state · originId · elarianAnchor · tags)  

4\\.  createEntry() called — entry written to IDB  

5\\.  createEntry() confirms success  

6\\.  TaggerBus.clearResult() called  

&nbsp;   ← tagger system handoff point  

7\\.  \_emgNotify(capturedTags) called — pre-captured  

&nbsp;   tags passed to Emergence. Emergence does not  

&nbsp;   read TaggerBus at this point.  

8\\.  document.dispatchEvent(new CustomEvent(  

&nbsp;   'ae:tagCommit', { detail: payload }))  

&nbsp;   — Resonance Engine listener receives deposit  

&nbsp;   payload. No direct reference between tagger  

&nbsp;   and engine at runtime.  

9\\.  Affected node weights recalculated  

10\\. Field position recalculation queued for next  

&nbsp;   animation frame  

11\\. Pulse animation triggered on affected nodes  

12\\. Resonance lines re-evaluated for new or updated  

&nbsp;   connections



Steps 9–12 are owned by the Resonance Engine. The tagger system hands off at step 8\\. It does not call the Resonance Engine directly — it dispatches 'ae:tagCommit'. The Resonance Engine listens and receives.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ NEXUS FEED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



The tagger system is the upstream source for three Nexus pages. It does not communicate with them directly. It produces structured data that those pages depend on. The integrity of that data determines what Nexus can do.



PATTERN CONVERGENCE (PCV · 50\\) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Reads: tag routing records — { seed\\\_id, layer\\\_id, threshold\\\_id, pillar\\\_id } — as the structural axes for cross-domain alignment.



PCV asks whether X shifted in one domain and Y followed in another. That question is only answerable if both entries share routing coordinates that can be compared. The full routing chain is the shared axis. Without complete routing on every tag, PCV cannot align domains. It can only see what the archive actually holds.



DRIFT TAXONOMY (DTX · 48\\) ━━━━━━━━━━━━━━━━━━━━━━━━━ Reads: phase_state sequences across entries on a node as raw state vectors.



A sequence like Solenne Arc → Aetherroot Chord → Aetherroot Chord → Aetherroot Chord across a node's entries is a drift trajectory. DTX classifies that trajectory — its initiation source, pattern, threshold interaction, and signature fingerprint. DTX receives the state data. It does not build it. The tagger system builds it one entry at a time, each time phase_state is assigned and stored.



SIGNAL GRADING (SGR · 49\\) ━━━━━━━━━━━━━━━━━━━━━━━━━ Reads: tag weight and activity score data as structural impact evidence.



SGR grades signals against four dimensions, one of which is structural impact — how much a signal actually affected system behavior. Tag weight per entry, summed and activity-decayed across a node, is the evidence SGR needs to evaluate whether a signal was system-wide, cross-node, local, or negligible. This data flows through the Resonance Engine's weight system. SGR reads the structural result.



THE INTEGRITY PRINCIPLE ━━━━━━━━━━━━━━━━━━━━━━━ Nexus classification is only as precise as the tagging that fed it. Imprecise phase_state produces imprecise drift vectors. Incomplete routing records produce gaps in PCV's alignment axes. Guessed weights produce distorted structural impact scores. The tagger system is the source. There is no correction pass downstream.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PUBLIC API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TaggerBus.init() → void
Called once at app init. Registers the singleton. No panel is active at this point.

TaggerBus.activateSection(sectionId) → void
Called on every section navigation. Updates stored section context so the next
panel open passes the correct context to the Claude API. Does nothing else.

TaggerBus.activatePanel(panelId, sectionId?) → void
Called on every panel open. Sets context, wires the debounced input watcher for
this panel. Same panel reopening → result preserved. Different panel → result
cleared before wiring. No cross-panel contamination.

TaggerBus.deactivatePanel() → void
Called on every panel close. Does not clear the result — result is preserved by
panel ID until the next activatePanel() determines whether to keep or clear it.

TaggerBus.getResult() → TagResult | null
Called in every commit handler. Returns the current suggestion result or null
if no result is present.

TaggerBus.clearResult() → void
Called in every commit handler after successful save. Never called before save
confirms. If save fails, result is preserved — the user does not lose tag context
on a failed save.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ KNOWN FAILURE MODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



1\. resolveTagIds() NOT CALLED ON API RESPONSE Tags enter the archive with layer\\\_id, threshold\\\_id, and pillar\\\_id missing. The routing chain is broken. The Resonance Engine receives partial data. PCV cannot align on incomplete axes. This failure is silent — no error is thrown. Guard: always call resolveTagIds() before any tag is stored or published. No tag reaches IDB without passing through resolution.



2\. clearResult() CALLED BEFORE SAVE CONFIRMS If clearResult() fires on panel close rather than on save success, a failed save leaves the entry untagged with no recovery path. The user's tag context is gone. Guard: clearResult() fires only inside the commit handler, only after createEntry() or updateEntry() resolves successfully.



3\. TaggerBus NOT INITIALIZED All panels operate without tag bus coordination. Tags do not clear between panels. Section context is not passed to Claude. getResult() returns null silently in every commit handler. Entries save with empty tags, null phase_state, null originId. Guard: TaggerBus.init() called once in app init. activateSection() called on every section navigation. activatePanel() / deactivatePanel() called on every panel open and close.



4\. DUPLICATE TAG RESOLVED WITHOUT SEED CONTEXT A tag that appears in multiple seeds resolves to the wrong seed if only id is used as the lookup key. The routing chain points to the wrong node. The Resonance Engine weights the wrong seed. DTX receives state data from the wrong structural position. Guard: resolveTagIds() always uses both id and seed\\\_id as the lookup key. Seed context from the API response is accepted as authoritative.



5\. phase_state CONFLATED WITH PHASE\\\_CODES These are separate systems. PHASE\\\_CODES are lifecycle phases in the composite ID stamp. phase_state is the ontological threshold state of entry content. Mixing them produces entries with corrupted stamp data or corrupted drift state vectors. Guard: phase_state values are the 12 canonical threshold names or null. Never use one where the other belongs.



6\. CROSS-PANEL TAG CONTAMINATION A result from panel A is preserved when panel B opens. Panel B commits with panel A's tags. Silent data integrity failure — no error is thrown, the entry simply carries wrong tags from a different context. Guard: TaggerBus.activatePanel() checks the stored panel ID against the incoming panel ID. Same panel → preserve. Different panel → clear before wiring.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



tagger.js Core API — Claude integration, tag suggestion, resolveTagIds(), phase_state resolution, originId resolution, weight algorithm, section context delivery. Status: PLANNED



tagger\\\_bus.js TaggerBus singleton — panel coordination, active result slot, panel-ID-keyed result preservation, suggestion render, clearResult rule. Status: PLANNED



tags-vocab.js Canonical tag vocabulary — TAG\\\_VOCAB\\\_BY\\\_SEED · NODE\\\_REGISTRY · ARC\\\_SEED\\\_TAGS. Status: PLANNED

