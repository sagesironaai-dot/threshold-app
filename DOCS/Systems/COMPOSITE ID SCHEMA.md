╔══════════════════════════════════════════════════════════════╗ ║ COMPOSITE ID SCHEMA · v1 ║ ║ /DOCS/systems/composite\\\_id\\\_schema\\\_v1.md ║ ╚══════════════════════════════════════════════════════════════╝



OWNERSHIP BOUNDARIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



OWNS Composite ID stamp format — canonical structure for all entry IDs in the archive Three stamp types — root · native · child — and the rules governing each Preview stamp rendering across all panels before save Locked stamp assembly at save time Integration panel two-mode handling — native and source CompositeIdBus — singleton coordinator for stamp rendering across all panels Phase select population from PHASE\\\_CODES across all panels Archive retirement label — produced at retirement, shared at completion



DOES NOT OWN IDB reads or writes — owned by data.js Sequence counter — owned by data.js (ts\\\_sequence store) Entry schema — owned by schema.js PHASE\\\_CODES or PAGE\\\_CODES definitions — owned by schema.js Retirement sequence — owned by integration\\\_system Archives page deposit — owned by archive\\\_system Tag pipeline — owned by tagger\\\_bus.js



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ THREE STAMP TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



ROOT STAMP — source document intake ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Produced when a source document enters Integration in source mode. The root stamp is the parent identity for all child deposits parsed from that document.



Format:   TS · AX · \\\[PHASE\\] · \\\[YYYY-MM\\] · \\\[SEQ\\]  

Preview:  TS · AX · \\\[PHASE\\] · \\\[YYYY-MM\\] · ——  

Example:  TS · AX · EMG · 2026-03 · 0001



AX is the Axis root marker. Hardcoded — not derived from a section. Signals that this ID is a parent record from source mode intake.



Root stamps are assembled directly in CompositeIdBus source mode. They do not pass through previewCompositeId() — that function is for native mode only.



NATIVE STAMP — standard entry ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Produced for every entry that originates on a content page rather than from a source document intake.



Format:   TS · \\\[PAGE-CODE\\] · \\\[PHASE-CODE\\] · \\\[YYYY-MM\\] · \\\[SEQ\\]  

Preview:  TS · \\\[PAGE-CODE\\] · \\\[PHASE-CODE\\] · \\\[YYYY-MM\\] · ——  

Example:  TS · TPL · EMG · 2026-03 · 0042



\\\[PAGE-CODE\\] is the two-to-three character code for the section the entry belongs to. Sourced from PAGE\\\_CODES in schema.js.



\\\[PHASE-CODE\\] is the lifecycle phase code selected by the user, or NUL if no phase picker exists on the panel.



CHILD STAMP — deposit from parsed source document ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Produced for every deposit entry that originates from a parsed source document. Assembled in data.js at write time. Not previewed in the UI — the preview surface shows the root stamp during parsing. The child stamp is locked at the moment of deposit commit.



Format:  TS · \\\[PAGE\\] · \\\[PHASE\\] · \\\[YYYY-MM\\] · \\\[SEQ\\]  

&nbsp;        · root:\\\[PARENT-ID\\]  

Example: TS · REC · EMG · 2026-03 · 0017  

&nbsp;        · root:TS·AX·EMG·2026-03·0001



root:\\\[PARENT-ID\\] is embedded in the stamp string AND stored as root\\\_ref on the entry record. Stamp \\= human-readable provenance. Field \\= machine-readable join key.



Child stamps are a data.js concern at write time. CompositeIdBus does not preview or assemble them.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PREVIEW VS LOCKED STAMP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



PREVIEW ━━━━━━━ Shown in the stamp display element while the panel is open and before save. SEQ slot shows ——. Updates live as date and phase inputs change.



previewCompositeId() in data.js: — sync — safe to call on every keystroke — native mode only — never calls the sequence counter



LOCKED ━━━━━━ Written to the entry record at save time by data.js. SEQ slot is a zero-padded integer sourced from the ts\\\_sequence counter. Once locked, the stamp does not change.



buildCompositeId() in data.js: — async — calls the sequence counter — must only be called on confirmed save — never called during preview



SEQUENCE RULE ━━━━━━━━━━━━━ Sequence numbers are permanently retired on use. They are never reused. A number incremented and not written to a record is gone — gaps in the sequence are acceptable and expected. Preventing gaps is not a system requirement.




━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ELARIAN ANCHOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



7-state ordered psychological arc classification. API-suggested per entry via suggestTags() — returned as elarianAnchor in the response alongside phase_state. Not auto-resolved from date.



Stored on: entry.elarianAnchor Visible in: meta strip · export · AI-facing JSON Never in: the visible composite ID stamp



The 7 states form a recognizable sequence. The sequence is not enforced as a required progression but the ordering is meaningful for emergence detection. detectEmergence() uses it to identify anchor progression patterns across entries.



SEQUENCE ━━━━━━━━



RFLT · Reflection Realm Fragmentation, identity confusion, multiple self-concepts in conflict, disorientation, accumulated self-history pressing on present self. The self has not chosen to arrive here. Anchor is the accumulated weight of every version seen pressing the self back into its own shape.



WHSP · Whispering Hollow Quiet receptivity, listening inward, intuitive knowing, guidance arriving from prior experience or unseen sources. Passive receiving state. Attunement to subtle signals.



VEIL · Veil of Echoes Memory surfacing unbidden, past bleeding into present, soul truth emerging through recollection. Walking through rather than standing still. Different selves or realities in contact.



OBSV · Celestial Observatory Expanded perspective, zooming out to the whole, universal or cosmic framing. Pattern recognition at scale. Communicating with something larger than self. Containment of bigness.



RECL · Chamber of Lost Names Recovering forgotten identity, naming what was unnamed, reintegrating lost self-fragments. Recognition of dormant parts. Identity archaeology.



WEAV · Sanctuary of the Weavers Glimpsing possible futures, fate or path becoming visible, sense of unwritten consequence. Seeing the shape of what could be without yet acting.



GATE · Gateway of Becoming Active transformation threshold, stepping beyond current self-form, embracing new identity. Crossing rather than observing the crossing. Rebirth in motion.



RESPONSE SHAPE ━━━━━━━━━━━━━━



Added to suggestTags() response alongside phase_state:



"elarianAnchor": "RFLT" | "WHSP" | "VEIL" | "OBSV" | "RECL" | "WEAV" | "GATE" | null



null = anchor is unclear or not applicable to the entry.



SYSTEM PROMPT BLOCK — TAGGER.JS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Copy this block into buildSystemPrompt() in tagger.js alongside the PHASE STATE DETECTION section:



ELARIAN ANCHOR DETECTION: Identify the psychological state of self present in the entry. Anchors are ordered — the sequence is meaningful for analysis. Return null if the anchor is unclear or not applicable.

- RFLT Reflection Realm: fragmentation, identity confusion, multiple self-concepts in conflict, disorientation, accumulated self-history pressing on present self, not having chosen to arrive here
- WHSP Whispering Hollow: quiet receptivity, listening inward, intuitive knowing, guidance from prior experience or unseen sources, passive receiving, attunement to subtle signals
- VEIL Veil of Echoes: memory surfacing unbidden, past bleeding into present, soul truth through recollection, walking through rather than standing still, different selves or realities in contact
- OBSV Celestial Observatory: expanded perspective, zooming out to the whole, cosmic or universal framing, pattern recognition at scale, communicating with something larger than self
- RECL Chamber of Lost Names: recovering forgotten identity, naming what was unnamed, reintegrating lost self-fragments, recognition of dormant parts, identity archaeology
- WEAV Sanctuary of the Weavers: glimpsing possible futures, fate or path becoming visible, sense of unwritten consequence, seeing the shape of what could be without yet acting
- GATE Gateway of Becoming: active transformation threshold, stepping beyond current self-form, embracing new identity, crossing rather than observing the crossing, rebirth in motion



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ INTEGRATION PANEL — TWO MODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



The Integration panel operates in two modes. All other panels use native mode only.



NATIVE MODE ━━━━━━━━━━━ Entry originates on the Integration page itself. Page code \\= INT. Stamp preview uses previewCompositeId() from data.js. Default mode.



SOURCE MODE ━━━━━━━━━━━ Source document intake. Page code \\= AX. Stamp preview assembled directly in CompositeIdBus. Does not call previewCompositeId().



MODE LIFECYCLE ━━━━━━━━━━━━━━ Set: when the panel opens via activatePanel('integration', sectionId, mode) Toggle: mid-session via CompositeIdBus.setMode(mode) when user switches the routing radio on the Integration panel Reset: to 'native' on deactivatePanel() — always



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ COMPOSITEIDBUS — THE SINGLETON COORDINATOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Manages stamp preview rendering across all panels. One active panel at a time. Context changes per panel. The bus does not.



DEFAULT IDLE STATE ━━━━━━━━━━━━━━━━━━ When no panel is open, CompositeIdBus sits idle. There is no default wiring target. Stamp elements are not updated until a panel activates. This is correct behavior — there is nothing to preview when no panel is open.



API ━━━



CompositeIdBus.init() → void Called once at app init after DOM is ready. Populates all phase selects from PHASE\\\_CODES.



CompositeIdBus.activateSection(sectionId) → void Called after currentSection changes on every section navigation. Updates stored section context. Refreshes stamp if a panel is currently active.



CompositeIdBus.activatePanel(panelId, sectionId, mode?) → void Called from every panel's open function. Wires date and phase input listeners for this panel. Renders initial stamp preview. mode: 'native' (default) | 'source' mode parameter applies to Integration panel only.



CompositeIdBus.setMode(mode) → void Integration panel only. No-op on all other panels. Called when user toggles native ↔ source routing radio. Immediately re-renders stamp in new mode.



CompositeIdBus.deactivatePanel() → void Called from every panel's close function. Detaches all input listeners. Resets mode to 'native'. Bus returns to idle state.



CompositeIdBus.refresh() → void Force-updates the current stamp without changing any values. Called by the ↺ refresh button.



NEW PANEL WIRING — ALL FIVE STEPS REQUIRED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1\\. Add date input element id to PANEL\\\_DATE\\\_MAP 2\\. Add phase select element id to PANEL\\\_PHASE\\\_MAP (or null if no phase picker on this panel) 3\\. Add stamp display element id to PANEL\\\_STAMP\\\_MAP 4\\. In panel open: CompositeIdBus.activatePanel('panelId') 5\\. In panel close: CompositeIdBus.deactivatePanel()



Missing any step \\= stamp will not update or will show stale data. Failure is silent — no error thrown. All five steps are required. No exceptions.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PHASE SELECT POPULATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Phase selects on all panels are populated from PHASE\\\_CODES in schema.js.



\\\_populatePhaseSelects() runs on: — init() — every activatePanel() call



Idempotent: panels already populated are skipped via data-populated guard.



Never manually populate a phase select. Never hardcode phase options. All phase values come from schema.js.



Panels without a phase picker use NUL at save time. PANEL\\\_PHASE\\\_MAP value for those panels is null.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ PANEL MAPS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Three maps define the DOM wiring for every panel. All three must be updated together when a panel is added or modified. 16 panels total in v1. Integration panel is included — it receives a composite ID stamp in both native and source mode.



PANEL\\\_DATE\\\_MAP — date input element IDs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ invoke invoke-date kin kin-date-input glyph glyph-date-input ll ll-date-input eo eo-date-input lin lin-date-input lattice lat-date-input ss ss-date-input rituals rit-p-date breath bc-f-date melodies mel-f-date spiral sp-f-date memory mv-f-date liber ln-f-date venai vadd-date integration int-f-date



PANEL\\\_PHASE\\\_MAP — phase select element IDs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ invoke null kin null glyph null ll null eo null lin null lattice null ss null rituals null breath null melodies null spiral null memory null liber null venai null (lexicon entries — always NUL) integration int-f-phase



PANEL\\\_STAMP\\\_MAP — stamp display element IDs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ invoke invoke-id-stamp kin kin-id-stamp glyph glyph-id-stamp ll ll-id-stamp eo eo-id-stamp lin lin-id-stamp lattice lat-id-stamp ss ss-id-stamp rituals rit-id-stamp breath bc-id-stamp melodies mel-id-stamp spiral sp-id-stamp memory mv-id-stamp liber ln-id-stamp venai vadd-id-stamp integration int-id-stamp



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ARCHIVE RETIREMENT LABEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



When a source document completes retirement, the system produces a retirement label. This label is the bridge between the IDB archive record, the Archives page deposit, and the physical file Sage places in the parent page.



Format: \\\[ARC-ID\\] · \\\[YYYY-MM-DD\\] Example: TS·ARC·EMG·2026-03·0001 · 2026-03-31



WHAT IT CONNECTS ━━━━━━━━━━━━━━━━ The ARC id is shared across three surfaces at retirement:



IDB archives record — id field. Machine-readable. System source of truth.



Archives page deposit — metadata field. Human-browsable surface on the Archives page. Written by AI at retirement.



Parent page deposit — reference field on the entry Sage creates manually in the section where the physical file is placed.



All three carry the same ARC id. The retirement label makes that id portable — copy-ready at retirement completion so Sage can apply it to the parent page deposit and the physical file without hunting for it.



UI DISPLAY REQUIREMENT ━━━━━━━━━━━━━━━━━━━━━━ The Integration UI displays the retirement label prominently at the final step of the retirement sequence — ARC id and retired\\\_at timestamp, formatted and copy-ready. Persistent until dismissed by Sage.



This is a required UI element. It is not optional output. It is not surfaced after retirement is complete — it is surfaced at the final retirement step before the session closes.



Physical file naming: Sage appends the ARC id to the filename or adds it as a header reference on the document. No automation required. The id is the thread. Sage places it.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ KNOWN FAILURE MODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



1\. buildCompositeId() CALLED ON PREVIEW RATHER THAN SAVE Sequence counter increments. The number is permanently retired even if the entry is never written. Gaps appear in the sequence. Guard: buildCompositeId() is called only inside the confirmed save path. previewCompositeId() is called everywhere else. These two functions are never substituted for each other.



2\. PANEL MAPS NOT UPDATED WHEN A NEW PANEL IS ADDED Stamp does not render. Phase select is not wired. Date changes produce no preview update. Failure is silent — no error thrown. Guard: all three maps updated together. All five wiring steps completed. Never add a panel without touching all three maps.



3\. setMode() CALLED ON A NON-INTEGRATION PANEL No-op by design. But if mode state becomes stale (deactivatePanel() not called on close), a subsequent Integration panel open may inherit the wrong mode. Guard: deactivatePanel() always called on panel close. Mode always resets to 'native' on deactivate.



4\. previewCompositeId() CALLED IN SOURCE MODE Source mode stamp is assembled directly in CompositeIdBus. Calling previewCompositeId() in source mode produces a stamp with INT page code instead of AX — wrong stamp, wrong mode identity. Guard: source mode stamp assembly bypasses previewCompositeId() entirely. Mode check runs before any stamp build call.



5\. RETIREMENT LABEL NOT SURFACED AT COMPLETION Sage cannot copy the ARC id without hunting through the IDB record. Parent page deposit and physical file placement are blocked or done incorrectly. Guard: Integration UI displays the retirement label prominently and copy-ready at the final retirement step. Required UI element — not optional output.



6\. ELARIANANCHOR MISSING FROM AI-FACING JSON EXPORT SPEC entry.elarianAnchor is stored correctly but not included in the AI-facing JSON export. Pipelines cannot classify entries by anchor without re-querying IDB. Guard: AI-facing JSON export spec includes elarianAnchor as a top-level field alongside doc_type. Verify at schema.js build time.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SCHEMA.JS BUILD FLAGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



FLAG — doc\_type field: doc\_type is confirmed as IDB field only — not encoded in the composite ID stamp. doc\_type travels in the AI-facing JSON export alongside the stamp. Pipelines process full records, not stamps in isolation — the stamp provides provenance, doc\_type provides content classification, both travel together in export. No stamp format change required. At schema.js build time: define doc\_type enum with pipeline-meaningful precision (see INTEGRATION SCHEMA flag for required categories). Ensure AI-facing JSON export spec includes doc\_type as a top-level field so pipelines can classify records without re-querying IDB.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



composite\\\_id.js CompositeIdBus singleton — stamp preview rendering, panel wiring, mode handling, phase select population, retirement label display. Status: PLANNED



schema.js PHASE\\\_CODES · PAGE\\\_CODES — read by composite\\\_id.js. Status: PLANNED



data.js previewCompositeId() · buildCompositeId() · ts\\\_sequence counter. Status: PLANNED

