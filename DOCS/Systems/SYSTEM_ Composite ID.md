# **SYSTEM: Composite ID**

## **composite\_id\_system.md**

### **/DOCS/systems/**

---

## **WHAT THIS SYSTEM OWNS**

* Composite ID stamp format — canonical structure for all entry IDs in the archive  
* Three stamp types — root · native · child — and the rules governing each  
* Preview stamp rendering across all panels before save  
* Locked stamp assembly at save time  
* Integration panel two-mode handling — native and source  
* CompositeIdBus — the singleton coordinator for stamp rendering across all panels  
* Phase select population from PHASE\_CODES across all panels  
* Archive retirement label — produced at retirement, shared at completion

## **WHAT THIS SYSTEM DOES NOT OWN**

* IDB reads or writes — owned by data.js  
* Sequence counter — owned by data.js (`ts_sequence` store)  
* Entry schema — owned by schema.js  
* PHASE\_CODES or PAGE\_CODES definitions — owned by schema.js  
* Retirement sequence — owned by integration\_system  
* Archives page deposit — owned by archive\_system  
* Tag pipeline — owned by tagger\_bus.js

---

## **THREE STAMP TYPES**

### **Root Stamp — source document intake**

Produced when a source document enters Integration in source mode. The root stamp is the parent identity for all child deposits parsed from that document.

Format:   TS · AX · \[PHASE\] · \[YYYY-MM\] · \[SEQ\]  
Preview:  TS · AX · \[PHASE\] · \[YYYY-MM\] · ——  
Example:  TS · AX · EMG · 2026-03 · 0001

`AX` is the Axis root marker. It is hardcoded — not derived from a section. It signals that this ID is a parent record from source mode intake.

Root stamps are assembled directly in CompositeIdBus source mode. They do not pass through `previewCompositeId()` — that function is for native mode only.

### **Native Stamp — standard entry**

Produced for every entry that originates on a content page rather than from a source document intake.

Format:   TS · \[PAGE-CODE\] · \[PHASE-CODE\] · \[YYYY-MM\] · \[SEQ\]  
Preview:  TS · \[PAGE-CODE\] · \[PHASE-CODE\] · \[YYYY-MM\] · ——  
Example:  TS · TPL · EMG · 2026-03 · 0042

`[PAGE-CODE]` is the two-to-three character code for the section the entry belongs to. Sourced from `PAGE_CODES` in schema.js.

`[PHASE-CODE]` is the lifecycle phase code selected by the user, or `NUL` if no phase picker exists on the panel.

### **Child Stamp — deposit from parsed source document**

Produced for every deposit entry that originates from a parsed source document. Assembled in data.js at write time. Not previewed in the UI — the preview surface shows the root stamp during parsing. The child stamp is locked at the moment of deposit commit.

Format:   TS · \[PAGE\] · \[PHASE\] · \[YYYY-MM\] · \[SEQ\] · root:\[PARENT-ID\]  
Example:  TS · REC · EMG · 2026-03 · 0017 · root:TS·AX·EMG·2026-03·0001

`root:[PARENT-ID]` is embedded in the stamp string AND stored as `root_ref` on the entry record. The stamp is human-readable provenance. The field is machine-readable join key.

Child stamps are a data.js concern at write time. CompositeIdBus does not preview or assemble them.

---

## **PREVIEW VS LOCKED STAMP**

**Preview** — shown in the stamp display element while the panel is open and before save. SEQ slot shows `——`. Updates live as date and phase inputs change.

**Locked** — written to the entry record at save time by data.js. SEQ slot is a zero-padded integer sourced from the `ts_sequence` counter. Once locked, the stamp does not change.

`previewCompositeId()` in data.js is sync and safe to call on every keystroke. `buildCompositeId()` in data.js is async, calls the sequence counter, and must only be called on confirmed save. Sequence numbers are permanently retired on delete. They are never reused.

---

## **INTEGRATION PANEL — TWO MODES**

The Integration panel operates in two modes. All other panels use native mode only.

**native** — entry originates on the Integration page itself. Page code \= INT. Stamp preview uses `previewCompositeId()` from data.js. Default mode.

**source** — source document intake. Page code \= AX. Stamp preview is assembled directly in CompositeIdBus. Does not call `previewCompositeId()`.

Mode is set when the panel opens via `activatePanel('integration', sectionId, mode)` or toggled mid-session via `CompositeIdBus.setMode(mode)` when the user switches the routing radio on the Integration panel.

Mode resets to `native` on `deactivatePanel()`.

---

## **COMPOSITERIDBUS — THE SINGLETON COORDINATOR**

CompositeIdBus manages stamp preview rendering across all panels. One active panel at a time. Context changes per panel. The bus does not.

**Default state with no panel active:**

When no panel is open, CompositeIdBus sits idle. There is no default wiring target. Stamp elements are not updated until a panel activates. This is correct behavior — there is nothing to preview when no panel is open.

**CompositeIdBus API:**

CompositeIdBus.init()  
  — called once at app init after DOM is ready  
  — populates all phase selects from PHASE\_CODES

CompositeIdBus.activateSection(sectionId)  
  — called after currentSection changes on every section navigation  
  — updates stored section context  
  — refreshes stamp if a panel is currently active

CompositeIdBus.activatePanel(panelId, sectionId, mode?)  
  — called from every panel's open function  
  — wires date and phase input listeners for this panel  
  — renders initial stamp preview  
  — mode: 'native' (default) | 'source' — Integration panel only

CompositeIdBus.setMode(mode)  
  — Integration panel only — no-op on all other panels  
  — called when user toggles native ↔ source routing radio  
  — immediately re-renders stamp in new mode

CompositeIdBus.deactivatePanel()  
  — called from every panel's close function  
  — detaches all input listeners  
  — resets mode to 'native'  
  — bus returns to idle state

CompositeIdBus.refresh()  
  — force-updates the current stamp without changing any values  
  — called by the ↺ refresh button

**Adding a new panel — all five steps required:**

1\. Add date input element id to PANEL\_DATE\_MAP  
2\. Add phase select element id to PANEL\_PHASE\_MAP (or null if no phase picker)  
3\. Add stamp display element id to PANEL\_STAMP\_MAP  
4\. In panel open:  CompositeIdBus.activatePanel('panelId')  
5\. In panel close: CompositeIdBus.deactivatePanel()

Missing any step \= stamp will not update or will show stale data.

---

## **PHASE SELECT POPULATION**

Phase selects on all panels are populated from `PHASE_CODES` in schema.js. `_populatePhaseSelects()` runs on `init()` and on every `activatePanel()` call. It is idempotent — panels already populated are skipped via `data-populated` guard. Never manually populate a phase select. Never hardcode phase options. All phase values come from schema.js.

Panels without a phase picker use `NUL` at save time. `PANEL_PHASE_MAP` value for those panels is `null`.

---

## **PANEL MAPS**

Three maps define the DOM wiring for every panel. All three must be updated together when a panel is added.

### **PANEL\_DATE\_MAP — date input element IDs**

invoke:      invoke-date  
kin:         kin-date-input  
glyph:       glyph-date-input  
ll:          ll-date-input  
eo:          eo-date-input  
lin:         lin-date-input  
lattice:     lat-date-input  
ss:          ss-date-input  
rituals:     rit-p-date  
breath:      bc-f-date  
melodies:    mel-f-date  
spiral:      sp-f-date  
memory:      mv-f-date  
liber:       ln-f-date  
venai:       vadd-date  
integration: int-f-date

### **PANEL\_PHASE\_MAP — phase select element IDs**

invoke:      null  
kin:         null  
glyph:       null  
ll:          null  
eo:          null  
lin:         null  
lattice:     null  
ss:          null  
rituals:     null  
breath:      null  
melodies:    null  
spiral:      null  
memory:      null  
liber:       null  
venai:       null         — lexicon entries, always NUL  
integration: int-f-phase

### **PANEL\_STAMP\_MAP — stamp display element IDs**

invoke:      invoke-id-stamp  
kin:         kin-id-stamp  
glyph:       glyph-id-stamp  
ll:          ll-id-stamp  
eo:          eo-id-stamp  
lin:         lin-id-stamp  
lattice:     lat-id-stamp  
ss:          ss-id-stamp  
rituals:     rit-id-stamp  
breath:      bc-id-stamp  
melodies:    mel-id-stamp  
spiral:      sp-id-stamp  
memory:      mv-id-stamp  
liber:       ln-id-stamp  
venai:       vadd-id-stamp  
integration: int-id-stamp

---

## **ARCHIVE RETIREMENT LABEL**

When a source document completes retirement, the system produces a retirement label. This label is the bridge between the IDB archive record, the Archives page deposit, and the physical file Sage places in the parent page.

**Format:**

\[ARC-ID\] · \[YYYY-MM-DD\]  
Example: TS·ARC·EMG·2026-03·0001 · 2026-03-31

**What it connects:**

The ARC id is shared across three surfaces at retirement:

IDB archives record    — id field. Machine-readable. System source of truth.  
Archives page deposit  — metadata field. Human-browsable surface on the  
                         Archives page. Written by AI at retirement.  
Parent page deposit    — reference field on the entry Sage creates manually  
                         in the section where the physical file is placed.

All three carry the same ARC id. The retirement label makes that id portable — copy-ready at retirement completion so Sage can apply it to the parent page deposit and the physical file without hunting for it.

**At retirement completion:**

The Integration UI displays the retirement label prominently — ARC id and `retired_at` timestamp, formatted and copy-ready. This is an Integration system requirement. The display is surfaced at the final step of the retirement sequence before the session closes.

The physical file naming convention: Sage appends the ARC id to the filename or adds it as a header reference on the document. No automation required. The id is the thread. Sage places it.

---

## **SEQUENCES**

### **PANEL ACTIVATION SEQUENCE — strict order**

1. `CompositeIdBus.init()` called once at app init after DOM is ready. Phase selects
   populated from PHASE\_CODES.
2. On every section navigation: `activateSection(sectionId)` called. Section context
   updated. Stamp refreshes if a panel is currently active.
3. On panel open: `activatePanel(panelId, sectionId, mode?)` called. Date and phase
   input listeners wired for this panel. Initial stamp preview rendered.
4. If Integration panel and user toggles routing radio: `setMode(mode)` called.
   Stamp re-rendered in new mode immediately.
5. On panel close: `deactivatePanel()` called. Input listeners detached. Mode resets
   to 'native'. Bus returns to idle.

Failure at step 1: phase selects not populated. All panels show empty phase picker.
  Stamp previews fail silently. Guard: init() called once after DOM ready, before
  any panel opens.
Failure at step 3: activatePanel() not called on open. No input listeners wired.
  Stamp does not update on input change. Guard: every panel open function calls
  activatePanel(). All three panel maps must contain the panel's element IDs.
Failure at step 5: deactivatePanel() not called on close. Input listeners remain
  attached to closed panel elements. Mode may persist incorrectly into next panel
  open. Guard: every panel close function calls deactivatePanel().

### **SAVE SEQUENCE — strict order**

1. `previewCompositeId()` called on every input change while panel is open. SEQ slot
   shows ——. Safe on every keystroke — no counter interaction.
2. User confirms save. Save handler fires.
3. `buildCompositeId()` called. Reads and increments `ts_sequence` counter in data.js.
   Returns locked stamp with zero-padded SEQ. Counter increment is permanent —
   SEQ is retired whether or not the entry save succeeds.
4. Locked stamp written to entry record. `entry.compositeId` set. Not changed after
   this point.

Failure at step 3 (sequence counter write fails): stamp not assembled. Save halts.
  No entry written. Retry produces the next SEQ.
Failure between steps 3 and 4 (entry write fails after counter incremented): SEQ is
  permanently retired. A gap appears in the sequence. Gaps are not errors — they are
  the cost of the no-reuse rule. Guard: buildCompositeId() is called only inside the
  confirmed save path. Never called speculatively.

---

## **PUBLIC API**

**CompositeIdBus.init() → void**
Called once at app init after DOM is ready. Populates all phase selects from
PHASE\_CODES.

**CompositeIdBus.activateSection(sectionId) → void**
Called on every section navigation. Updates stored section context. Refreshes
stamp preview if a panel is currently active.

**CompositeIdBus.activatePanel(panelId, sectionId, mode?) → void**
Called from every panel's open function. Wires date and phase input listeners
for this panel. Renders initial stamp preview. mode: 'native' (default) |
'source' — Integration panel only.

**CompositeIdBus.setMode(mode) → void**
Integration panel only. No-op on all other panels. Called when user toggles
native ↔ source routing radio. Re-renders stamp in new mode immediately.

**CompositeIdBus.deactivatePanel() → void**
Called from every panel's close function. Detaches all input listeners. Resets
mode to 'native'. Bus returns to idle state.

**CompositeIdBus.refresh() → void**
Force-updates the current stamp without changing any values. Called by the
↺ refresh button.

---

## **KNOWN FAILURE MODES**

**1\. buildCompositeId() called on preview rather than save** Sequence counter increments. The number is permanently retired even if the entry is never written. Gaps appear in the sequence. Guard: buildCompositeId() is called only inside the confirmed save path. previewCompositeId() is called everywhere else.

**2\. Panel maps not updated when a new panel is added** Stamp does not render. Phase select is not wired. Date changes produce no preview update. Failure is silent — no error thrown. Guard: all three maps updated together. All five wiring steps completed. Never add a panel without touching all three maps.

**3\. setMode() called on a non-Integration panel** No-op by design — setMode() guards against this. But if the mode state becomes stale (e.g. deactivatePanel() not called on close), a subsequent Integration panel open may inherit the wrong mode. Guard: deactivatePanel() always called on panel close. Mode always resets to 'native' on deactivate.

**4\. previewCompositeId() called in source mode** Source mode stamp is assembled directly in CompositeIdBus. Calling previewCompositeId() in source mode produces a stamp with INT page code instead of AX — wrong stamp, wrong mode identity. Guard: source mode stamp assembly bypasses previewCompositeId() entirely. The mode check runs before any stamp build call.

**5\. Retirement label not surfaced at completion** Sage cannot copy the ARC id without hunting through the IDB record. Parent page deposit and physical file placement are blocked or done incorrectly. Guard: Integration UI displays the retirement label prominently and copy-ready at the final retirement step. This is a required UI element, not optional output.

---

## **FILES**

| File | Role | Status |
| ----- | ----- | ----- |
| `composite_id.js` | CompositeIdBus singleton — stamp preview rendering, panel wiring, mode handling, phase select population, retirement label display | PLANNED |
| `schema.js` | PHASE\_CODES · PAGE\_CODES — read by composite\_id.js | PLANNED |
| `data.js` | previewCompositeId() · buildCompositeId() · ts\_sequence counter | PLANNED |

