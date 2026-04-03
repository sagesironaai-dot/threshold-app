╔══════════════════════════════════════════════════════════════╗ ║ EMERGENCE SCHEMA · v1 ║ ║ /DOCS/systems/emergence\\\_schema\\\_v1.md ║ ╚══════════════════════════════════════════════════════════════╝



OWNERSHIP BOUNDARIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



OWNS Seven-detector pattern analysis engine — runs across the full entry corpus Three-mode overlay — translation · timeline · trace On-demand finding narratives via Claude API Proactive nudge — scheduled pattern scan with cooldown Thread Trace bridge — hands off findings to ThreadTraceUI for thread navigation Graph export — assembles ThreadGraphPayload for the graph page



DOES NOT OWN Tag session logic or pipeline — owned by TaggerBus Thread navigation or overlay — owned by ThreadTraceUI IDB reads or writes — data fetcher is injected; this system never opens IDB directly Writes to entries — read-only analysis layer. Never modifies what it reads. Entry schema — owned by schema.js



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SEVEN DETECTORS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Each detector runs across the tag set and entry corpus passed to runDetectors(). Each produces zero or more findings. All findings share the canonical finding shape defined below.



All threshold values are calibration constants. Starting reference values are given here. All are marked PLANNED — confirm at build.



1\. CLUSTER ━━━━━━━━━━ Builds a co-occurrence graph from tag → entry membership. Tags that appear together in entries form connected components. Components above the minimum size threshold are flagged as cluster findings.



CLUSTER\\\_MIN\\\_SIZE \\= 3 Minimum tags to flag a component as a cluster. PLANNED — confirm at build.



Finding meaning: these tags consistently co-occur. They activate together. The pattern is structural, not coincidental.



2\. BRIDGE NODE ━━━━━━━━━━━━━━ Identifies tags with high bridgeScore — tags that connect otherwise separate clusters. A bridge node sits between two or more distinct communities in the co-occurrence graph. Its removal would disconnect them.



BRIDGE\\\_THRESHOLD \\= 0.65 bridgeScore above this \\= bridge node. PLANNED — confirm at build.



Finding meaning: this tag is load-bearing. It is the connective tissue between domains that would otherwise not touch. High structural significance.



3\. HIGH INFLUENCE ━━━━━━━━━━━━━━━━━ Identifies tags with high equilibriumState — tags whose activation reliably precedes or accompanies activation of many other tags. Influence is not the same as frequency. A tag can appear rarely and still carry high influence if its appearances consistently pull other tags into activation.



INFLUENCE\\\_THRESHOLD \\= 0.78 equilibriumState above this \\= high influence. PLANNED — confirm at build.



Finding meaning: when this tag appears, the field moves.



4\. CROSS-CATEGORY ━━━━━━━━━━━━━━━━━ Identifies pairs of tags from different seeds or pillars that share entries above the minimum threshold. Cross-category findings surface connections the routing architecture did not predict — places where field signal is crossing structural boundaries.



CROSS\\\_CAT\\\_MIN\\\_ENTRIES \\= 2 Minimum shared entries to flag a cross-category link. PLANNED — confirm at build.



Finding meaning: two structurally separate domains are touching in the field. This is the interference pattern PCV reads.



5\. DRIFT ━━━━━━━━ Identifies tags that were active in recent phases but have faded — their presence is declining across the phase window. Drift findings name what is losing signal rather than gaining it.



DRIFT\\\_PHASE\\\_WINDOW \\= 2 Phases back to check for fading tag presence. PLANNED — confirm at build.



Finding meaning: this tag was load-bearing and is receding. DTX receives these findings as named drift events for trajectory classification.



6\. VOID ZONE ━━━━━━━━━━━━ Identifies sections with low tag coverage — sections where entries exist but are not being tagged, or are being tagged at a rate far below the corpus average. A void zone is a gap in the signal map.



VOID\\\_COVERAGE\\\_FLOOR \\= 0.3 Sections with \\< 30% tagged entries \\= void zone. PLANNED — confirm at build.



Finding meaning: there is field activity here that the tagging system has not reached. The data exists. The routing does not.



7\. NPA SPIKE ━━━━━━━━━━━━ Identifies sessions where non-primary arc tags dominate — where the tags activated do not align with the primary arc of the active section. A spike suggests the session is producing signal outside the expected routing path.



NPA\\\_SPIKE\\\_RATIO \\= 0.4 Non-primary arc tags \\> 40% of session \\= spike. PLANNED — confirm at build.



Finding meaning: the field is producing signal that is not landing where the architecture expects it. May indicate an emergent routing need or a misaligned section assignment.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SEVERITY CRITERIA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Severity is not an aesthetic judgment. It is a structural assessment based on the finding's scope, persistence, and routing implications.



low Pattern is present but narrow in scope. Affects a single section or a small tag subset. No evidence of cross-domain propagation. Watchlist only — no immediate routing action required.



medium Pattern spans multiple sections or involves a structurally significant node. Appears in more than one detection pass. Cross-domain signal present but not yet convergent. Worth tracking actively — may escalate.



high Pattern is system-wide or involves a bridge node or high-influence tag. Appears consistently across multiple sessions or phases. Cross-domain convergence confirmed or strongly indicated. Requires routing attention — input to DTX classification and SGR grading.



ASSIGNMENT RULE ━━━━━━━━━━━━━━━ Severity is assigned by the detector at finding creation time. It is not retrospectively adjusted by the Emergence system. SGR re-evaluates signal weight against documented outcomes independently.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FINDING SHAPE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



All seven detectors produce findings in this canonical shape. No detector may deviate from this structure.



{ id string 'emg\\\_\\\[timestamp\\]\\\_\\\[rand\\]' Unique per finding per detection pass.



type            string    'cluster' | 'bridge' |  

&nbsp;                         'influence' |  

&nbsp;                         'cross\\\_category' |  

&nbsp;                         'drift' | 'void' |  

&nbsp;                         'npa\\\_spike'



title           string    Human-readable label for  

&nbsp;                         the finding.



description     string    Structural description of  

&nbsp;                         what was detected.



severity        string    'low' | 'medium' | 'high'  

&nbsp;                         Assigned at creation.  

&nbsp;                         Never changed by this system.



metrics         object    Numeric values from the  

&nbsp;                         detector calculation.  

&nbsp;                         e.g. { bridgeScore: 0.72,  

&nbsp;                                entryCount: 14 }



involvedTags    object\\\[\\]  Tags implicated in the  

&nbsp;                         finding.



involvedEntries object\\\[\\]  Entries implicated in the  

&nbsp;                         finding. This is what Thread  

&nbsp;                         Trace reads when building an  

&nbsp;                         Emergence thread from a  

&nbsp;                         finding.



canTrace        boolean   True if ThreadTraceUI can  

&nbsp;                         open a thread from this  

&nbsp;                         finding. Gates the "Trace  

&nbsp;                         this pattern" button in the  

&nbsp;                         overlay. Gated on  

&nbsp;                         window.ThreadTraceUI being  

&nbsp;                         available at render time.



}



PERSISTENCE RULE ━━━━━━━━━━━━━━━━ Findings are not persisted to IDB by this system. They are produced fresh on each detection pass and held in memory. Persistence happens when Thread Trace saves a thread built from a finding — the finding is serialized into the saved thread record at that point.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ THREE OVERLAY MODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



All three modes render inside the same overlay shell. Tab navigation switches modes without closing the overlay.



translation Renders the findings from the most recent tag session — what the current set of tags produced across the seven detectors. Primary mode after a tag commit. Shows finding cards with metrics, involved tags, severity, and trace button.



timeline Renders entries bucketed by time period. Shows how pattern activity has distributed across the corpus chronologically. Primary mode for phase-level pattern review.



trace Focused mode opened from a specific finding — either via the trace button on a finding card or via openFromFinding(). Shows the thread of entries and tags implicated in that finding. Hands off to ThreadTraceUI for full thread navigation.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CLAUDE API INTEGRATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Model: claude-sonnet-4-20250514 Used for all Emergence API calls.



ON-DEMAND FINDING NARRATIVES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Triggered by requestNarrative(finding). Produces a finding narrative in the language of the framework — a translation of what the detector already measured, expressed using framework terminology.



This is not interpretation added to the finding. It is a translation of what the detector measured. The narrative does not expand beyond the finding's metrics, involved tags, and structural description.



PROACTIVE NUDGE ━━━━━━━━━━━━━━━ Scheduled. Runs automatically after a detection pass if findings above a significance threshold are present and the cooldown has elapsed.



NUDGE\\\_COOLDOWN\\\_MS \\= 4 min (240000ms) Minimum interval between proactive nudge calls. PLANNED — confirm at build.



NUDGE\\\_INIT\\\_DELAY\\\_MS \\= 4000ms Delay before first scan after app load. PLANNED — confirm at build.



Behavior: — Surfaces a single high-significance finding as a non-blocking notification. — Does not open the overlay. — Invites attention without demanding it.



DEDUPLICATION RULE ━━━━━━━━━━━━━━━━━━ Findings already surfaced in the current session are tracked by key (type::title). The nudge does not repeat findings the user has already seen in this session. \\\_seenKeys holds the session-scoped set. Never cleared mid-session.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PUBLIC API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



EmergenceEngine.setEntriesFetcher(fn) → void MUST be called before init(). Non-negotiable. Injects the entry fetch function from index.html: () \\=\\> getEntries() Missing this \\= engine runs on empty corpus silently. No error thrown. Silent failure throughout. Call: EmergenceEngine.setEntriesFetcher( () \\=\\> getEntries())



EmergenceEngine.init() → void Called once at app init after setEntriesFetcher() and after initDB(). Builds overlay shell. Schedules first proactive scan after NUDGE\\\_INIT\\\_DELAY\\\_MS. Call order: setEntriesFetcher() FIRST, then init(). This order is non-negotiable.



EmergenceEngine.activateSection(sectionId) → void Called from selectSection() on every section navigation. Scopes proactive scanning to the active section.



EmergenceEngine.onTagSessionComplete(tags, entries) → Promise<void> Called after every tag session commit. See COMMIT HOOK section below. Runs full detector pass and triggers proactive nudge if warranted. Refreshes overlay content if overlay is currently open.



EmergenceEngine.open(mode) → void Opens overlay in given mode: 'translation' | 'timeline' | 'trace' If no findings exist, runs a fresh detection pass before opening. Defaults to 'translation' if no mode specified.



EmergenceEngine.close() → void Closes overlay. Session state is preserved.



EmergenceEngine.openFromFinding(finding) → void Opens overlay in 'trace' mode focused on the given finding. Called from external finding cards outside the overlay.



EmergenceEngine.requestNarrative(finding) → Promise<string> Triggers Claude API call for on-demand finding narrative. Returns narrative text for rendering in the overlay.



EmergenceEngine.runDetectors(tags, entries) → Finding[] Exposed for inspection and testing. Runs all seven detectors and returns the full findings array.



EmergenceEngine.buildTimelineBuckets(entries) → object[] Exposed for inspection. Returns entries bucketed by time for timeline mode rendering.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ COMMIT HOOK — onTagSessionComplete() ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



onTagSessionComplete() is called at the end of every panel save handler, after TaggerBus.clearResult() has fired. This is the \\\_emgNotify() pattern in index.html — every panel commit ends with this call. It receives tags as a pre-captured value passed by the caller. The caller (index.html) captures tags from TaggerBus before clearResult() fires and passes the captured value to \\\_emgNotify(capturedTags). onTagSessionComplete() does not read from TaggerBus.



\\\_emgNotify() is a no-op if EmergenceEngine is not loaded.



COMMIT HOOK PATTERN — every panel save handler: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ const capturedTags \\= TaggerBus.getResult()?.tags ?? \\\[\\]; await createEntry(payload); TaggerBus.clearResult(); await \\\_emgNotify(capturedTags); → EmergenceEngine.onTagSessionComplete( capturedTags, freshEntries)



CORPUS FRESHNESS RULE ━━━━━━━━━━━━━━━━━━━━━ onTagSessionComplete() always fetches entries fresh before running detectors. It does not rely on the cached corpus.



The entry that just triggered the commit is the reason the analysis is running — running detectors on a corpus that does not yet include that entry is structurally incorrect. The finding produced would miss the most relevant connection.



The performance cost is one IDB read per commit. This is acceptable. The freshness rule is non-negotiable.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ THREAD TRACE BRIDGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



openFromFinding() hands off to: window.ThreadTraceUI.openFromFinding(finding)



The bridge uses window.ThreadTraceUI — not an ES module import — to avoid a circular dependency between emergence.js and thread\\\_trace\\\_ui.js.



LOAD ORDER REQUIREMENT ━━━━━━━━━━━━━━━━━━━━━━ ThreadTraceUI must be loaded and assigned to window.ThreadTraceUI before EmergenceEngine initializes. This is a hard load order constraint.



canTrace GATE ━━━━━━━━━━━━━ If ThreadTraceUI is not present at the time a finding's trace button is rendered, the button does not render. canTrace is gated on window.ThreadTraceUI being available at render time. It is not a static boolean — it is evaluated at render time.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ NEXUS FEED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



PATTERN CONVERGENCE (PCV · 50\\) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Reads: cluster · bridge · cross-category findings as interference pattern data.



These three detector types produce the cross-domain signal PCV is designed to receive. A cross-category finding that tags from s04 and s15 share entries is exactly the kind of structural relationship PCV aligns on shared axes. Emergence names these findings with precision. PCV interprets them. Emergence does not.



DRIFT TAXONOMY (DTX · 48\\) ━━━━━━━━━━━━━━━━━━━━━━━━━ Reads: drift findings as named drift events for trajectory classification.



Emergence detects that a tag is fading. DTX classifies whether that fading is linear escalation, oscillation, fragmentation, or containment. The drift detector produces the event. DTX provides the taxonomy. DTX also receives the phase window and entry context embedded in the finding — that is the raw state data its classification runs against.



LIBER NOVUS (LNV · 47\\) ━━━━━━━━━━━━━━━━━━━━━━━ Receives: processed Emergence findings routed through Thread Trace or deposited directly as part of the Daily Nexus Routine.



Findings land on LNV with provenance intact: finding id, type, severity, involved tags, and the session context in which they were produced. LNV holds them without editorializing. Findings are traceable to the detection pass that produced them.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ KNOWN FAILURE MODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



1\. setEntriesFetcher() NOT CALLED BEFORE init() Engine initializes on an empty corpus. All detector passes return empty findings. Proactive nudge never fires. No error thrown — silent failure throughout. Guard: setEntriesFetcher() is always the first Emergence call in init(), before EmergenceEngine.init(). Call order is non-negotiable.



2\. onTagSessionComplete() CALLED WITH STALE CORPUS If entries are passed from a cached fetch rather than a fresh IDB read, the just-committed entry is not in the corpus. Detector pass misses the most relevant connection. Finding produced is structurally incomplete. Guard: onTagSessionComplete() always fetches entries fresh via \\\_fetchEntries() at the start of every call. Never use the cached corpus at commit time.



3\. ThreadTraceUI NOT LOADED BEFORE EmergenceEngine window.ThreadTraceUI is undefined when a finding's trace button is clicked. Button does not render for canTrace findings. Thread Trace bridge is unavailable. Guard: ThreadTraceUI loads before EmergenceEngine in the script load order. canTrace is gated on window.ThreadTraceUI presence at render time.



4\. FINDINGS NOT DEDUPED ACROSS NUDGE CALLS Same finding surfaces as a nudge multiple times in one session. User sees repeated notifications for the same pattern. Guard: \\\_seenKeys tracks findings by type::title key within the session. Nudge only fires for findings with keys not yet in \\\_seenKeys.



5\. GRAPH EXPORT BEFORE GRAPH PAGE EXISTS GRAPH\\\_PAGE\\\_PATH \\= '/graph' is a stub. Routing there before the page is built produces dead navigation. Guard: graph export remains disabled until GRAPH\\\_PAGE\\\_PATH is a live route. Update GRAPH\\\_PAGE\\\_PATH in both emergence.js and thread\\\_trace\\\_ui.js together — never one without the other.



6\. OVERLAY PALETTE USING CSS VARIABLES The Emergence overlay is built dynamically outside the normal CSS cascade. CSS custom properties defined on :root are not accessible from dynamically injected inline styles in this context. Guard: PAL object uses hardcoded rgba values only. Never substitute CSS variables in the PAL object or in overlay inline styles.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CALIBRATION VARIABLES — ALL PLANNED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



CLUSTER\\\_MIN\\\_SIZE minimum cluster component size BRIDGE\\\_THRESHOLD bridgeScore cutoff INFLUENCE\\\_THRESHOLD equilibriumState cutoff CROSS\\\_CAT\\\_MIN\\\_ENTRIES minimum shared entries VOID\\\_COVERAGE\\\_FLOOR tagged entry ratio floor NPA\\\_SPIKE\\\_RATIO non-primary arc tag ratio DRIFT\\\_PHASE\\\_WINDOW phases back for drift check NUDGE\\\_COOLDOWN\\\_MS minimum nudge interval NUDGE\\\_INIT\\\_DELAY\\\_MS first scan delay after load



All starting reference values documented in detector sections above. All subject to calibration at build.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



emergence.js Pattern analysis engine — seven detectors, three overlay modes, Claude API integration, Thread Trace bridge, proactive nudge, graph export stub. Status: PLANNED

