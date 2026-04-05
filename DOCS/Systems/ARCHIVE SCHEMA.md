╔══════════════════════════════════════════════════════════════╗ ║ ARCHIVE SCHEMA · v1 ║ ║ /DOCS/systems/archive\_schema\_v1.md ║ ╚══════════════════════════════════════════════════════════════╝

OWNERSHIP BOUNDARIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OWNS Archives page (ARV · 45\) — permanent sealed record surface Three-surface architecture — IDB archives record \+ Archives page deposit \+ parent page placement Authentication threshold — criteria for sealing Sealed record rule — no reopening, no reinterpretation Archives page deposit format — what AI writes at retirement page\_deposit\_id — field on IDB archives record linking to the page deposit Media intake trigger — dropdown button on all pages routing media files to INT

DOES NOT OWN Retirement sequence — owned by integration\_system IDB archives store schema — owned by data.js and INT schema Provenance summary generation — owned by integration\_system (AI generates at retirement step 5; content surfaces here but originates there) ARC id generation or stamp assembly — owned by composite\_id\_system and data.js Media intake processing — owned by integration\_system Source document parsing — owned by integration\_system Routing authority — owned by SOT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ THREE-SURFACE ARCHITECTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every retired source document produces three outputs that share the same ARC id. The first two are automated. The third is manual. The ARC id is the structural thread connecting all surfaces. No surface is authoritative over the others — each serves a distinct function.

SURFACE 1 — IDB ARCHIVES RECORD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Machine-readable. System source of truth. Created at retirement step 6\. Contains the full provenance record, routing data, and statistical summary of the parsed document. Not directly browsable on the Archives page. Schema fully specified in INT schema v1.

Key fields for reference: id — ARC stamp: TS · ARC · \[PHASE\] · \[YYYY-MM\] · \[SEQ\] root\_ref — references root\_entries.id provenance\_summary — six-section AI-generated text (from retirement step 5\) confirmed\_targets — all confirmed section routing total\_deposits — integer confirmed — integer skipped — integer lifetime\_deferrals — integer retired\_at — ISO timestamp page\_deposit\_id — references the Archives page deposit entry id. Written after page deposit is created. Links machine record to browsable surface. Null between retirement step 6 and post-retirement step b — expected, not an error state.

SURFACE 2 — ARCHIVES PAGE DEPOSIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Human-browsable. Written by AI at retirement. A structured entry on the Archives page drawn from the provenance\_summary on the IDB record. This is what Sage reads, searches, and retrieves.

Carries the ARC id and retired\_at as metadata fields — the same values on the IDB record.

SURFACE 3 — PARENT PAGE PLACEMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Not automated. Sage manually creates a deposit entry in the section where the physical file belongs and references the ARC id. The retirement label — displayed copy-ready at retirement completion — carries exactly what is needed:

Format:  \[ARC-ID\] · \[YYYY-MM-DD\]  
Example: TS·ARC·EMG·2026-03·0001 · 2026-03-31

NOTE — Surface 3 is outside the automated system boundary. It requires no system logic — the retirement label supplies everything Sage needs to complete it. The TWO-SURFACE label used in earlier references to this architecture is retired.

WRITE SEQUENCE AT RETIREMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Strict order. Non-negotiable.

1\. IDB archives record created (retirement step 6\)  
   page\_deposit\_id is null at this point.

2\. Archives page deposit written from  
   provenance\_summary content.

3\. page\_deposit\_id written to IDB archives record  
   with the deposit's entry id.

4\. Retirement label surfaced in Integration UI —  
   copy-ready for Sage.  
   Format: \[ARC-ID\] · \[YYYY-MM-DD\]  
   Persistent until dismissed by Sage.  
   Required UI element — not optional output.

IDB record is always created first. Archives page deposit is written second. page\_deposit\_id written third. This sequence cannot be inverted.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ARCHIVES PAGE DEPOSIT FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The page deposit is a structured entry on the Archives page. It is not the provenance\_summary verbatim — it is a formatted deposit drawn from that content.

REQUIRED FIELDS ━━━━━━━━━━━━━━━ title — string From root\_entries.title.

arc\_id         — string  
                 The ARC stamp id.

retired\_at     — timestamp  
                 ISO timestamp formatted for display.

doc\_type       — enum  
                 Mirrors root\_entries.doc\_type.  
                 session\_transcript | field\_note |  
                 compiled\_research | external\_source |  
                 glyph\_image

section        — 'archives'  
                 Fixed value.

type           — 'archive\_record'  
                 Fixed value.

status         — 'sealed'  
                 Fixed value. Written once.  
                 Never changed after write.

BODY CONTENT — SIX REQUIRED SECTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Drawn from provenance\_summary. All six required. A deposit missing any section is incomplete and must not be written.

Source overview      — what the document is and where  
                       it came from.

Signal weight        — what the material carried and  
                       why it mattered.

Deposit distribution — deposit count, receiving  
                       sections, notable routing  
                       patterns.

Split routing notes  — deposits that crossed multiple  
                       sections and why.

Unresolved notes     — anything flagged during parsing  
                       that didn't fit cleanly.

Parsing confidence   — honest self-assessment of read  
                       quality. Flags anything  
                       potentially missed, misrouted,  
                       or that exceeded parsing  
                       clarity. A future model reads  
                       this to weight its own  
                       interpretation of the record.

WHAT THE DEPOSIT DOES NOT CONTAIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ — No interpretation beyond what the provenance\_summary states. — No narrative framing. — No thematic expansion. — The deposit reflects what the system found. It does not editorialize what it means.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ AUTHENTICATION THRESHOLD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Archives page receives only retired source documents. It is not a thematic page. It does not receive deposits routed from INT parsing. It receives the retirement record of the document itself.

WHAT QUALIFIES ━━━━━━━━━━━━━━ — Source document has completed the full INT retirement sequence. — confirmed\_targets is fully written on root\_entries. — provenance\_summary contains all six required sections. — retirement\_status on root\_entries \= 'complete'. — open\_deferrals \= 0, OR Sage has explicitly accepted remaining deferrals as unresolvable.

WHAT DOES NOT QUALIFY ━━━━━━━━━━━━━━━━━━━━━ — Partially parsed documents with open pending deposits. — Documents where provenance\_summary is incomplete. — Native entries from any content page — those live on their own pages. — Any entry that has not passed through INT retirement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SEALED RECORD RULE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Once an entry is written to the Archives page with status `sealed`, it is not reopened and not reinterpreted.

The record reflects what the system found at retirement. If new analysis reveals something missed, that finding lives in the relevant content page or in a new INT intake — not as a modification to the sealed record.

The ledger records what happened. It does not revise it.

ENFORCEMENT ━━━━━━━━━━━ — Entries with status `sealed` are read-only in the UI. — No edit function is exposed on sealed entries. — data.js enforces this at the update layer — updates to sealed entries are rejected.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ MEDIA INTAKE TRIGGER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A media intake button appears in a dropdown on every page in the archive. Its function is a routing shortcut — it sends a media file to INT as a new source document intake. It does not attach files directly to entries. Nothing enters the archive without INT provenance.

WHY THIS RULE EXISTS ━━━━━━━━━━━━━━━━━━━━ An image relevant to both Convergence and Lineage must not be siloed to one page entry. It needs INT intake so confirmed\_targets can route it to all relevant sections cleanly. Direct attachment bypasses that routing and creates a cross-mapping dead end. The button exists to make INT intake frictionless — not to circumvent it.

WHAT THE BUTTON DOES ━━━━━━━━━━━━━━━━━━━━ 1\. Opens a lightweight media intake form.

2\. User selects file  
   (image · audio · document · other).

3\. File and basic metadata submitted to INT as a  
   new source document with doc\_type matching  
   the file type.

4\. INT intake sequence begins — file receives  
   provenance, parsing, confirmed\_targets routing,  
   and retirement in the normal sequence.

5\. Deposits from that media file route to confirmed  
   target pages through INT — not directly from  
   the upload point.

BUTTON PLACEMENT ━━━━━━━━━━━━━━━━ — Dropdown on every page. — Consistent position and label across all pages. — Does not replace or interfere with the page's primary deposit flow. — It is an entry point to INT, not a page-level function.

PLANNED: exact UI spec — dropdown position, label, form fields, file type handling, and INT handoff implementation. Built in index.html Phase 11\.

GUARD: no direct file attachment path exists on content page entries. The only upload path is this trigger, which routes to INT. If a direct attachment mechanism is ever added for other purposes, it must be explicitly scoped to non-source-document file types.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ NEXUS FEED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Archives feeds three pages. What makes Archives a distinct nexus source is epistemic weight — sealed records are authenticated and fixed. Nexus pages reading from Archives are reading from the most verified layer of the system.

PATTERN CONVERGENCE (PCV · 50\) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Reads from Archives as authenticated structural data. When PCV aligns cross-domain signals on shared axes, sealed archive records carry more weight than provisional entries. A pattern that appears in both live entries and sealed archive records is structurally confirmed, not just emergent.

LIBER NOVUS (LNV · 47\) ━━━━━━━━━━━━━━━━━━━━━━━ Receives Archives outputs as part of the consolidated surface. Sealed records arriving on LNV carry their provenance intact — arc\_id, retired\_at, source origin, confirmed routing. LNV holds them without editorializing.

RCT (38) ━━━━━━━━ Archives feeds RCT with fixed relational configurations. RCT reads sealed archive records as the stable reference layer against which current relational configurations are measured. What is archived is what the system was confident enough to seal — that confidence is the data RCT needs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ KNOWN FAILURE MODES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PAGE\_DEPOSIT\_ID NOT WRITTEN AFTER RETIREMENT IDB archives record has no pointer to the browsable surface. The two surfaces are linked only by ARC id — no direct machine-readable join. Guard: page\_deposit\_id is written in the same retirement transaction after the Archives page deposit is confirmed created. Never left null after a successful retirement.

2. ARCHIVES PAGE DEPOSIT WRITTEN BEFORE IDB RECORD Write sequence inverts. page\_deposit\_id cannot be written to the IDB record because the record does not exist yet. Guard: IDB archives record is always created first (retirement step 6). Archives page deposit written second. page\_deposit\_id written third. Sequence is non-negotiable.

3. SEALED ENTRY MODIFIED AFTER RETIREMENT A sealed record is updated — status changed, body edited, fields overwritten. The ledger no longer reflects what actually happened at retirement. Guard: entries with status `sealed` are read-only in the UI. No edit function is exposed on sealed entries. data.js rejects updates to sealed entries at the update layer.

4. MEDIA FILE UPLOADED DIRECTLY TO A PAGE ENTRY File bypasses INT. No provenance. No confirmed\_targets. Cross-mapping impossible. The file exists on one entry in one section with no routing record. Guard: no direct file attachment path exists on content page entries. The only upload path is the media intake trigger, which routes to INT.

5. ARCHIVES PAGE DEPOSIT MISSING A PROVENANCE SECTION The deposit is incomplete. Future models cannot assess parsing confidence. Signal weight and routing distribution are absent. Guard: provenance\_summary completeness is validated at retirement step 5\. All six sections must be present before retirement continues. The Archives page deposit is drawn from a complete provenance\_summary or it is not written.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

data.js IDB archives store — record creation, page\_deposit\_id write, sealed entry enforcement. Status: PLANNED

index.html Archives page render, media intake trigger dropdown, sealed entry display. Status: PLANNED