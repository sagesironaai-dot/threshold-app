// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  ⬡  GUARDIAN NOTE — composite_id.js                                        │
// │  Role: Single coordinator for ALL composite ID stamp rendering and panel    │
// │  wiring across ae-kai and every add panel.                                  │
// │                                                                             │
// │  WIRING RULE — adding a new panel requires ALL FOUR of these steps:        │
// │    1. Add date input id → PANEL_DATE_MAP                                   │
// │    2. Add phase select id → PANEL_PHASE_MAP (or null if no phase picker)   │
// │    3. Add stamp display element id → PANEL_STAMP_MAP                       │
// │    4. In panel Open fn: CompositeIdBus.activatePanel('panelId')            │
// │    5. In panel Close fn: CompositeIdBus.deactivatePanel()                  │
// │    Missing any step = stamp will not update or will show stale data.       │
// │                                                                             │
// │  AE-KAI IS SPECIAL:                                                        │
// │    PANEL_STAMP_MAP['aekai'] = null — ae-kai uses segmented display         │
// │    (#ae-kai-id-section, #ae-kai-id-phase, #ae-kai-id-date, #ae-kai-id-hash)│
// │    not a flat stamp element like all other panels.                          │
// │                                                                             │
// │  ARC SELECT RETIRED:                                                        │
// │    #f-arc is hidden + disabled. Arc is auto-resolved. Do not re-enable.    │
// │    Do not remove from DOM — legacy code may reference the element.          │
// │                                                                             │
// │  THREE GLOBAL SHIMS defined here (were undefined before this file):        │
// │    window.aeKaiRefreshStamp()   — called by ↺ button in ae-kai sidebar    │
// │    window.onOriginDateChange()  — called by f-date onchange attr           │
// │    window.updateModalIdStamp()  — full rewrite of broken legacy version    │
// │    These shims must remain in this file. Do not move them.                 │
// └─────────────────────────────────────────────────────────────────────────────┘

// =============================================================================
//  COMPOSITE-ID.JS — Aelarian Archive
//  UI wiring for the composite ID system across all add panels and ae-kai.
//
//  Handles:
//    — Live stamp preview in ae-kai sidebar (5-part, updates on phase + date change)
//    — Per-panel stamp display in modal header strip
//    — aeKaiRefreshStamp() — previously undefined, now wired
//    — onOriginDateChange() — previously undefined, now wired
//    — updateModalIdStamp() — full rewrite, was broken (used today's date, ignored f-phase)
//    — f-arc select removal: Arc is auto-resolved, never a user input
//    — Phase select population from PHASE_CODES
//    — Per-panel commit: compositeId flows from TaggerBus result or is built fresh
//
//  Stamp format: TS · [PAGE-CODE] · [PHASE-CODE] · [YYYY-MM] · [SEQ]
//  Preview (pre-save): TS · INV · EMG · 2026-03 · ——
//  Locked (post-save): TS · INV · EMG · 2026-03 · 0001
//
//  Arc/Threshold code (THR1–THR5):
//    — Auto-resolved from origin date via resolveThresholdCode()
//    — Stored on entry.arcCode
//    — Shown only in meta strip, export, and AI-facing JSON
//    — NEVER part of the visible stamp
//
//  Dependencies (must be available on window or imported before this script):
//    — data.js: previewCompositeId (sync), buildCompositeId (async on save)
//    — schema.js: PHASE_CODES, PAGE_CODES, resolveThresholdCode
//    — tagger_bus.js: TaggerBus (for per-panel panel activate/deactivate)
//
//  HOW TO WIRE A NEW PANEL:
//    1. Add panel's date input id to PANEL_DATE_MAP
//    2. Add panel's phase select id to PANEL_PHASE_MAP (or null if no phase)
//    3. Add panel's stamp display element id to PANEL_STAMP_MAP
//    4. In panel's Open function: CompositeIdBus.activatePanel('panelId')
//    5. In panel's Close/Cancel: CompositeIdBus.deactivatePanel()
//    6. In panel's Commit handler: entry gets compositeId from createEntry()
//       automatically — no extra wiring needed at commit time
// =============================================================================

window.CompositeIdBus = (() => {

  // ── Panel → input ID maps ─────────────────────────────────────────────────

  // Primary date input per panel (the one driving the stamp)
  const PANEL_DATE_MAP = {
    aekai:    'f-date',
    invoke:   'invoke-date',
    kin:      'kin-date-input',
    glyph:    'glyph-date-input',
    ll:       'll-date-input',
    eo:       'eo-date-input',
    lin:      'lin-date-input',
    lattice:  'lat-date-input',
    ss:       'ss-date-input',
    rituals:  'rit-p-date',
    breath:   'bc-f-date',
    melodies: 'mel-f-date',
    spiral:   'sp-f-date',
    memory:   'mv-f-date',
    liber:    'ln-f-date',
    venai:    'vadd-date',
  };

  // Phase select per panel (null = no phase picker, defaults to 'NUL')
  const PANEL_PHASE_MAP = {
    aekai:    'f-phase',
    invoke:   null,
    kin:      null,
    glyph:    null,
    ll:       null,
    eo:       null,
    lin:      null,
    lattice:  null,
    ss:       null,
    rituals:  null,
    breath:   null,
    melodies: null,
    spiral:   null,
    memory:   null,
    liber:    null,
    venai:    null,   // lexicon — always NUL, no picker shown
  };

  // Stamp display element per panel (where the preview renders)
  const PANEL_STAMP_MAP = {
    aekai:    null,  // ae-kai uses the segmented sidebar display (ae-kai-id-segs)
    invoke:   'invoke-id-stamp',
    kin:      'kin-id-stamp',
    glyph:    'glyph-id-stamp',
    ll:       'll-id-stamp',
    eo:       'eo-id-stamp',
    lin:      'lin-id-stamp',
    lattice:  'lat-id-stamp',
    ss:       'ss-id-stamp',
    rituals:  'rit-id-stamp',
    breath:   'bc-id-stamp',
    melodies: 'mel-id-stamp',
    spiral:   'sp-id-stamp',
    memory:   'mv-id-stamp',
    liber:    'ln-id-stamp',
    venai:    'vadd-id-stamp',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let _panelId   = null;
  let _sectionId = null;
  let _listeners = [];  // [{ el, event, fn }] — cleaned up on panel change

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _getDate(panelId) {
    const id = PANEL_DATE_MAP[panelId];
    if (!id) return null;
    const el = document.getElementById(id);
    return el ? (el.value || null) : null;
  }

  function _getPhase(panelId) {
    const id = PANEL_PHASE_MAP[panelId];
    if (!id) return null;
    const el = document.getElementById(id);
    return el ? (el.value || null) : null;
  }

  function _getSectionId(panelId) {
    // ae-kai uses the global currentSection; panels use their registered section
    if (panelId === 'aekai') return (typeof currentSection !== 'undefined') ? currentSection : null;
    return _sectionId;
  }

  // ── Stamp rendering ───────────────────────────────────────────────────────

  // Render the segmented ae-kai sidebar stamp
  function _renderAeKaiSegs(stamp) {
    // stamp format: "TS · PAGE · PHASE · YYYY-MM · SEQ"
    const parts = stamp.split(' · ');
    const ids   = ['ae-kai-id-section', 'ae-kai-id-phase', 'ae-kai-id-date', 'ae-kai-id-hash'];
    // parts[0] = 'TS' (static), parts[1..4] = dynamic segments
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = parts[i + 1] || '—';
    });

    // Also update the arc/threshold row in the meta timestamp block
    const originDate = _getDate('aekai');
    if (originDate && typeof resolveThresholdCode === 'function') {
      const arcEl = document.getElementById('ae-kai-ts-origin');
      if (arcEl) {
        const thr = resolveThresholdCode(originDate);
        arcEl.textContent = originDate + (thr !== 'THR0' ? ' · ' + thr : '');
      }
    }
  }

  // Render to a flat stamp element (non-ae-kai panels)
  function _renderFlat(panelId, stamp) {
    const id = PANEL_STAMP_MAP[panelId];
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.textContent = stamp;
      el.classList.toggle('assembled', !stamp.includes('——'));
    }
  }

  // ── Core: update stamp for the active panel ───────────────────────────────
  function _updateStamp() {
    if (!_panelId) return;
    const sectionId = _getSectionId(_panelId);
    const originDate = _getDate(_panelId);
    const phaseCode  = _getPhase(_panelId);

    // previewCompositeId is a sync function from data.js
    let stamp;
    if (typeof previewCompositeId === 'function') {
      stamp = previewCompositeId({ sectionId, phaseCode, originDate });
    } else {
      // Fallback if data.js not yet loaded
      const pageCode  = (typeof PAGE_CODES !== 'undefined' && sectionId) ? (PAGE_CODES[sectionId] || '—') : '—';
      const phasePart = phaseCode || '—';
      const datePart  = originDate ? originDate.slice(0, 7) : '———';
      stamp = `TS · ${pageCode} · ${phasePart} · ${datePart} · ——`;
    }

    if (_panelId === 'aekai') {
      _renderAeKaiSegs(stamp);
      // Also keep the legacy modal-id-stamp-text in sync (used by some panels)
      const legacy = document.getElementById('modal-id-stamp-text');
      if (legacy) legacy.textContent = stamp;
    } else {
      _renderFlat(_panelId, stamp);
    }
  }

  // ── Listener wiring ───────────────────────────────────────────────────────

  function _addListener(elId, event, fn) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener(event, fn);
    _listeners.push({ el, event, fn });
  }

  function _detachListeners() {
    for (const { el, event, fn } of _listeners) {
      el.removeEventListener(event, fn);
    }
    _listeners = [];
  }

  function _wirePanel(panelId) {
    _detachListeners();
    _panelId = panelId;

    const dateId  = PANEL_DATE_MAP[panelId];
    const phaseId = PANEL_PHASE_MAP[panelId];

    if (dateId)  _addListener(dateId,  'change', _updateStamp);
    if (dateId)  _addListener(dateId,  'input',  _updateStamp);
    if (phaseId) _addListener(phaseId, 'change', _updateStamp);

    // Render immediately with whatever values are already set
    _updateStamp();
  }

  // ── Phase select population ───────────────────────────────────────────────
  // Populates any phase <select> from PHASE_CODES. Safe to call multiple times.
  function _populatePhaseSelects() {
    if (typeof PHASE_CODES === 'undefined') return;
    const selectIds = Object.values(PANEL_PHASE_MAP).filter(Boolean);
    // Also cover the main f-phase in ae-kai
    const allSelects = [...new Set([...selectIds, 'f-phase'])];

    for (const id of allSelects) {
      const sel = document.getElementById(id);
      if (!sel || sel.dataset.populated) continue;

      // Clear and rebuild
      sel.innerHTML = '<option value="">Phase</option>';
      for (const [name, code] of Object.entries(PHASE_CODES)) {
        const opt = document.createElement('option');
        opt.value       = code;
        opt.textContent = name;
        sel.appendChild(opt);
      }
      sel.dataset.populated = '1';
    }
  }

  // ── f-arc removal ─────────────────────────────────────────────────────────
  // The f-arc select in ae-kai HTML is a leftover — arc is now auto-resolved.
  // Hide it so it doesn't confuse the UI. We don't delete it from DOM in case
  // other code references it; we just render it invisible and disabled.
  function _retireArcSelect() {
    const arcSel = document.getElementById('f-arc');
    if (arcSel) {
      arcSel.style.display = 'none';
      arcSel.disabled = true;
      arcSel.setAttribute('aria-hidden', 'true');
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * init()
   * Call once in app init, after DOM is ready.
   * Populates phase selects, retires arc select, wires ae-kai panel.
   */
  function init() {
    _populatePhaseSelects();
    _retireArcSelect();
    _wirePanel('aekai');
    console.log('[CompositeIdBus] initialized');
  }

  /**
   * activateSection(sectionId)
   * Call after currentSection changes. Refreshes stamp for ae-kai context.
   */
  function activateSection(sectionId) {
    _sectionId = sectionId;
    if (_panelId === 'aekai' || !_panelId) {
      _panelId = 'aekai';
      _updateStamp();
    }
  }

  /**
   * activatePanel(panelId, sectionId)
   * Call from every panel's Open/OpenAdd function — same pattern as TaggerBus.
   */
  function activatePanel(panelId, sectionId) {
    _sectionId = sectionId
      || _sectionId
      || (typeof currentSection !== 'undefined' ? currentSection : null);
    _populatePhaseSelects();
    _wirePanel(panelId);
  }

  /**
   * deactivatePanel()
   * Call from every panel's Close function.
   * Returns stamp wiring to ae-kai.
   */
  function deactivatePanel() {
    _detachListeners();
    _wirePanel('aekai');
  }

  /**
   * refresh()
   * Force-update the current stamp without changing any values.
   * Called by the ↺ refresh glyph button.
   */
  function refresh() {
    _populatePhaseSelects();
    _updateStamp();
  }

  return {
    init,
    activateSection,
    activatePanel,
    deactivatePanel,
    refresh,
    PANEL_DATE_MAP,   // expose for inspection
    PANEL_PHASE_MAP,
    PANEL_STAMP_MAP,
  };

})();

// ── Global shims — these were called in HTML but never defined ────────────────

/**
 * aeKaiRefreshStamp()
 * Called by the ↺ button in ae-kai sidebar. Was undefined before this file.
 */
window.aeKaiRefreshStamp = function () {
  window.CompositeIdBus.refresh();
};

/**
 * onOriginDateChange()
 * Called by f-date onchange in ae-kai. Was undefined before this file.
 * CompositeIdBus already listens to f-date via _addListener — this is a
 * safety shim so the inline onchange attr doesn't throw.
 */
window.onOriginDateChange = function () {
  window.CompositeIdBus.refresh();
};

/**
 * updateModalIdStamp(forceNew)
 * Full rewrite of the broken legacy version.
 * Was: used today's date, hardcoded '—' for phase, built 6-part string with arcCode.
 * Now: reads f-date and f-phase, builds correct 5-part preview stamp.
 *
 * forceNew is kept as a param for backward compatibility but no longer
 * increments the sequence — stamps are only locked on Save.
 */
window.updateModalIdStamp = function (forceNew = false) {
  window.CompositeIdBus.refresh();
};