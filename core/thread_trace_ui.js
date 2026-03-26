// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  ⬡  GUARDIAN NOTE — thread_trace_ui.js                                     │
// │  Role: ThreadTraceUI singleton. One overlay, all panels. Owns rendering    │
// │  and session state only. Does NOT build threads or write to IDB.            │
// │                                                                             │
// │  WIRING RULE — every panel requires (parallel to TaggerBus):               │
// │    On panel open:  ThreadTraceUI.activatePanel('panelId', sectionId?)      │
// │    On panel close: ThreadTraceUI.deactivatePanel()                         │
// │    Note: deactivatePanel() does NOT close the overlay — thread state       │
// │    persists through panel transitions intentionally.                        │
// │                                                                             │
// │  THREE ENTRY POINTS:                                                        │
// │    openFromEntry(entryId)    — ∿ glyph on entry meta strip                │
// │    openFromTag(tagId)        — right-click on any tag pill                 │
// │    openFromFinding(finding)  — "Trace this pattern" in Emergence overlay   │
// │    All three route through open(rawSeed) → resolveSeed() → buildThread()   │
// │                                                                             │
// │  GLYPH INJECTION:                                                           │
// │    _injectEntryPoints() runs on every activatePanel() call.               │
// │    Injects ∿ glyph on [data-entry-id] elements not yet marked             │
// │    [data-tt-injected]. Tag pill contextmenu is delegated globally once     │
// │    via window.__ttTagDelegateSet guard.                                     │
// │                                                                             │
// │  GRAPH_PAGE_PATH = '/graph' — update when graph page is built.            │
// │                                                                             │
// │  SAVE DIALOG:                                                               │
// │    Annotation requires a saved thread. If user annotates before saving,    │
// │    _openSaveDialog(true, annotationText) queues the annotation.            │
// │                                                                             │
// │  DEPENDENCIES (ES module imports):                                          │
// │    thread_trace.js · thread_trace_db.js · data.js                         │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * thread-trace-ui.js
 * Thread Trace UI Layer — Aelarian Archive
 *
 * Responsibilities:
 *   · ThreadTraceUI singleton — one overlay, works from any panel
 *   · activatePanel / deactivatePanel hooks (parallel to TaggerBus)
 *   · Overlay shell: open, close, persist session state
 *   · Sequence view: card rendering, navigation, progress bar
 *   · Filter bar: all four routing dimensions + arc/phase/section
 *   · Thread annotations: input, timestamp, filter snapshot
 *   · Entry point injection: ∿ glyph on ID stamps, tag pill listeners
 *   · Graph export stub: builds ThreadGraphPayload → routes to graph page
 *   · Save thread: name dialog → thread-trace-db.js
 *
 * Does NOT own:
 *   · Thread building logic (thread-trace.js)
 *   · IDB reads/writes (thread-trace-db.js)
 *   · Tag vocabulary (tags-vocab.js)
 *
 * Dependencies:
 *   import { buildThread, resolveSeed, generateEdgeLabel,
 *            getTagRoutingSummary, getActiveFilterState,
 *            buildRoutingSnapshot, THREAD_TYPES } from './core/thread-trace.js';
 *   import { saveThread, loadAnnotations, saveAnnotation } from './core/thread-trace-db.js';
 *   import { getAllEntries } from './core/data.js';
 *
 * Revision: March 2026
 */

import {
  buildThread, resolveSeed, generateEdgeLabel,
  getTagRoutingSummary, getActiveFilterState,
  buildRoutingSnapshot, THREAD_TYPES
} from './thread_trace.js';

import {
  saveThread as dbSaveThread,
  loadAnnotations, saveAnnotation
} from './thread_trace_db.js';

import { getEntries as getAllEntries } from './data.js';


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const THREAD_COLORS = {
  [THREAD_TYPES.EMERGENCE]:  { base: '#5C3460', active: '#7A4E7E', name: 'Emergence'  },
  [THREAD_TYPES.TEMPORAL]:   { base: '#8A7040', active: '#C0A870', name: 'Temporal'   },
  [THREAD_TYPES.RELATIONAL]: { base: '#045050', active: '#0A6E6E', name: 'Relational' },
  [THREAD_TYPES.CLUSTER]:    { base: '#7A3A1A', active: '#A85028', name: 'Cluster'    },
};

const LAYER_NAMES = {
  l01: 'Coupling', l02: 'Connectome', l03: 'Metric', l04: 'Mirror'
};

const PILLAR_NAMES = {
  p01: 'TRIA', p02: 'PRIA', p03: 'PARA'
};

const GRAPH_PAGE_PATH = '/graph'; // update when graph page is built


// ─────────────────────────────────────────────────────────────────────────────
// THREADTRACEUI SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

const ThreadTraceUI = (() => {

  // ── Session state ──────────────────────────────────────────────────────────
  let _activePanel     = null;   // current panel id (set by activatePanel)
  let _activeSection   = null;   // current section id
  let _currentThread   = null;   // ThreadResult from thread-trace.js
  let _currentIndex    = 0;      // sequence view position
  let _filters         = {};     // active filter state
  let _savedThreadId   = null;   // if this thread has been saved
  let _overlayOpen     = false;
  let _allEntries      = [];     // pre-fetched on open


  // ── DOM refs ───────────────────────────────────────────────────────────────
  let _overlay, _headerStrip, _filterBar, _seqView, _annotationZone,
      _saveDialog, _progressBar, _progressLabel;


  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * activatePanel
   * Called from each panel's open hook — parallel to TaggerBus.activatePanel().
   * Sets context so Thread Trace knows which section's entries to scope.
   *
   * @param {string} panelId   — e.g. 'aekai' | 'invoke' | 'kin' | etc.
   * @param {string} [section] — current section id (optional, for multi-section panels)
   */
  function activatePanel(panelId, section = null) {
    _activePanel   = panelId;
    _activeSection = section;
    _injectEntryPoints();
  }

  /**
   * deactivatePanel
   * Called from each panel's close hook.
   * Does NOT close the overlay — thread persists through panel transitions.
   */
  function deactivatePanel() {
    _activePanel   = null;
    _activeSection = null;
  }

  /**
   * open
   * Opens the Thread Trace overlay with a seed object.
   * Called from all three entry points.
   *
   * @param {Object} rawSeed  — seed object from entry point
   * @param {string} [preferredThreadType] — optional override
   */
  async function open(rawSeed, preferredThreadType = null) {
    const seedObj = resolveSeed(rawSeed);
    if (!seedObj) {
      console.warn('[ThreadTraceUI] open: could not resolve seed', rawSeed);
      return;
    }

    // Fetch all entries scoped to current panel/section if active
    _allEntries = await _fetchEntries();

    // Determine thread type
    const threadType = preferredThreadType
      || seedObj.threadTypes?.[0]
      || THREAD_TYPES.TEMPORAL;

    // Build thread
    _currentThread = await buildThread(seedObj, _allEntries, threadType, { filters: _filters });
    if (!_currentThread || !_currentThread.entries.length) {
      _showEmpty(seedObj, threadType);
      return;
    }

    _currentIndex  = 0;
    _savedThreadId = null;

    // Pre-populate filters from TaggerBus active state
    const busFilt = getActiveFilterState();
    if (busFilt) _filters = { ..._filters, ...busFilt };

    _buildOverlay();
    _renderHeader();
    _renderFilterBar();
    _renderSequenceView();
    _renderAnnotationZone();

    _show();
  }

  /**
   * close
   * Closes the overlay. Session thread state is preserved in memory.
   */
  function close() {
    if (!_overlayOpen) return;
    _overlay?.classList.remove('tt-visible');
    setTimeout(() => {
      _overlay?.style.setProperty('display', 'none');
    }, 200);
    _overlayOpen = false;
    document.removeEventListener('keydown', _keyHandler);
  }

  /**
   * openFromEntry
   * Convenience — called by the ∿ glyph on any entry meta strip.
   *
   * @param {string} entryId
   */
  function openFromEntry(entryId) {
    open({ seed: entryId, threadTypes: [THREAD_TYPES.RELATIONAL, THREAD_TYPES.TEMPORAL] });
  }

  /**
   * openFromTag
   * Convenience — called by long-press / right-click on any tag pill.
   *
   * @param {string} tagId
   */
  function openFromTag(tagId) {
    open({ seed: tagId, threadTypes: [THREAD_TYPES.CLUSTER, THREAD_TYPES.TEMPORAL] });
  }

  /**
   * openFromFinding
   * Convenience — called by "Trace this pattern" on an Emergence finding card.
   *
   * @param {Object} findingObj — detectEmergence() finding
   */
  function openFromFinding(findingObj) {
    open({ seed: findingObj, threadTypes: [THREAD_TYPES.EMERGENCE] });
  }


  // ── OVERLAY SHELL ──────────────────────────────────────────────────────────

  function _buildOverlay() {
    if (_overlay) { _overlay.innerHTML = ''; return; }

    _overlay = document.createElement('div');
    _overlay.id = 'thread-trace-overlay';
    _overlay.setAttribute('role', 'dialog');
    _overlay.setAttribute('aria-modal', 'true');
    _overlay.setAttribute('aria-label', 'Thread Trace');

    Object.assign(_overlay.style, {
      position:        'fixed',
      inset:           '0',
      zIndex:          '900',
      background:      'rgba(13,13,18,0.96)',
      backdropFilter:  'blur(4px)',
      display:         'none',
      flexDirection:   'column',
      opacity:         '0',
      transition:      'opacity 180ms ease',
      overflowY:       'auto',
    });

    // Header
    _headerStrip = document.createElement('div');
    _headerStrip.id = 'tt-header';
    Object.assign(_headerStrip.style, {
      display:        'flex',
      alignItems:     'center',
      gap:            '12px',
      padding:        '14px 20px',
      borderBottom:   '1px solid rgba(255,255,255,0.08)',
      flexShrink:     '0',
    });

    // Progress bar
    _progressBar = document.createElement('div');
    Object.assign(_progressBar.style, {
      height: '2px', background: 'rgba(255,255,255,0.08)',
      flexShrink: '0', position: 'relative',
    });
    const _progressFill = document.createElement('div');
    _progressFill.id = 'tt-progress-fill';
    Object.assign(_progressFill.style, {
      position: 'absolute', left: '0', top: '0', height: '100%',
      background: '#7A4E7E', transition: 'width 200ms ease',
    });
    _progressBar.appendChild(_progressFill);

    // Filter bar
    _filterBar = document.createElement('div');
    _filterBar.id = 'tt-filter-bar';
    Object.assign(_filterBar.style, {
      padding:     '10px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink:  '0',
    });

    // Sequence view
    _seqView = document.createElement('div');
    _seqView.id = 'tt-sequence';
    Object.assign(_seqView.style, {
      flex:       '1',
      overflowY:  'auto',
      padding:    '20px',
    });

    // Annotation zone
    _annotationZone = document.createElement('div');
    _annotationZone.id = 'tt-annotation-zone';
    Object.assign(_annotationZone.style, {
      padding:      '12px 20px',
      borderTop:    '1px solid rgba(255,255,255,0.06)',
      flexShrink:   '0',
    });

    _overlay.append(_headerStrip, _progressBar, _filterBar, _seqView, _annotationZone);
    document.body.appendChild(_overlay);

    // Save dialog (hidden)
    _saveDialog = _buildSaveDialog();
    document.body.appendChild(_saveDialog);
  }

  function _show() {
    _overlay.style.display  = 'flex';
    requestAnimationFrame(() => {
      _overlay.style.opacity = '1';
    });
    _overlayOpen = true;
    document.addEventListener('keydown', _keyHandler);
  }

  function _keyHandler(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') _navigate(1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   _navigate(-1);
  }


  // ── HEADER STRIP ───────────────────────────────────────────────────────────

  function _renderHeader() {
    _headerStrip.innerHTML = '';
    if (!_currentThread) return;

    const { threadType, seed, entries } = _currentThread;
    const color = THREAD_COLORS[threadType] || THREAD_COLORS[THREAD_TYPES.TEMPORAL];

    // Thread type badge
    const badge = _el('span', {
      style: `background:${color.base};color:#fff;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:600;letter-spacing:0.04em;flex-shrink:0;`,
      textContent: color.name.toUpperCase(),
    });

    // Seed label
    const seedLabel = _el('span', {
      style: 'color:rgba(255,255,255,0.85);font-size:14px;flex:1;',
      textContent: _seedLabel(seed),
    });

    // Entry count
    const count = _el('span', {
      style: 'color:rgba(255,255,255,0.4);font-size:12px;flex-shrink:0;',
      textContent: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`,
    });

    // Routing summary strip
    const summary = getTagRoutingSummary(entries);
    const routingStrip = _buildRoutingStrip(summary);

    // Toggle: Sequence / Graph export
    const toggle = _el('div', { style: 'display:flex;gap:6px;flex-shrink:0;' });
    const seqBtn  = _toggleBtn('Sequence', true,  () => _renderSequenceView());
    const graphBtn = _toggleBtn('Graph Export', false, () => _exportGraph());
    toggle.append(seqBtn, graphBtn);

    // Save button
    const saveBtn = _el('button', {
      style: `background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
              color:rgba(255,255,255,0.7);padding:4px 12px;border-radius:3px;font-size:12px;
              cursor:pointer;flex-shrink:0;`,
      textContent: _savedThreadId ? 'Update Thread' : 'Save Thread',
    });
    saveBtn.addEventListener('click', _openSaveDialog);

    // Close button
    const closeBtn = _el('button', {
      style: `background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;
              cursor:pointer;flex-shrink:0;line-height:1;padding:0 4px;`,
      textContent: '×',
    });
    closeBtn.addEventListener('click', close);

    // Progress label
    _progressLabel = _el('span', {
      style: 'color:rgba(255,255,255,0.35);font-size:11px;flex-shrink:0;',
      textContent: `1 of ${entries.length}`,
    });

    _headerStrip.append(badge, seedLabel, count, routingStrip, toggle, saveBtn, _progressLabel, closeBtn);
    _updateProgress();
  }

  function _buildRoutingStrip(summary) {
    const strip = _el('div', { style: 'display:flex;gap:6px;align-items:center;flex-shrink:0;' });
    const dims = [
      { id: summary.dominantPillarId,    label: PILLAR_NAMES[summary.dominantPillarId]    || summary.dominantPillarId,    color: '#4A3060' },
      { id: summary.dominantSeedId,      label: summary.dominantSeedId,                                                   color: '#2A4040' },
      { id: summary.dominantLayerId,     label: LAYER_NAMES[summary.dominantLayerId]       || summary.dominantLayerId,     color: '#3A3020' },
      { id: summary.dominantThresholdId, label: summary.dominantThresholdId,                                              color: '#302020' },
    ];
    for (const d of dims) {
      if (!d.id) continue;
      strip.appendChild(_el('span', {
        style: `background:${d.color};color:rgba(255,255,255,0.6);padding:2px 7px;
                border-radius:2px;font-size:10px;letter-spacing:0.03em;`,
        textContent: d.label,
      }));
    }
    return strip;
  }

  function _updateProgress() {
    if (!_currentThread) return;
    const total = _currentThread.entries.length;
    const pct   = total > 1 ? ((_currentIndex / (total - 1)) * 100).toFixed(1) : 100;
    const fill  = document.getElementById('tt-progress-fill');
    if (fill) fill.style.width = `${pct}%`;
    if (_progressLabel) _progressLabel.textContent = `${_currentIndex + 1} of ${total}`;
  }


  // ── FILTER BAR ─────────────────────────────────────────────────────────────

  function _renderFilterBar() {
    _filterBar.innerHTML = '';
    const form = _el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;' });

    const dims = [
      { key: 'pillar_id',    label: 'Pillar',    options: [['p01','TRIA'],['p02','PRIA'],['p03','PARA']] },
      { key: 'seed_id',      label: 'Seed',      options: _seedOptions() },
      { key: 'layer_id',     label: 'Layer',     options: Object.entries(LAYER_NAMES) },
      { key: 'threshold_id', label: 'Threshold', options: _thresholdOptions() },
      { key: 'arcPhase',     label: 'Phase',     options: [['aetherrot','Aetherrot'],['solenne','Solenne'],['vireth','Vireth']] },
    ];

    for (const dim of dims) {
      const label = _el('label', {
        style: 'color:rgba(255,255,255,0.35);font-size:10px;letter-spacing:0.05em;',
        textContent: dim.label.toUpperCase(),
      });
      const select = _el('select', {
        style: `background:#1A1A24;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);
                font-size:11px;padding:3px 6px;border-radius:3px;cursor:pointer;`,
      });
      const allOpt = document.createElement('option');
      allOpt.value = ''; allOpt.textContent = 'All';
      select.appendChild(allOpt);

      for (const [val, name] of dim.options) {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = name;
        if (_filters[dim.key] === val) opt.selected = true;
        select.appendChild(opt);
      }

      select.addEventListener('change', () => {
        _filters[dim.key] = select.value || null;
        _applyFilters();
      });

      const group = _el('div', { style: 'display:flex;flex-direction:column;gap:3px;' });
      group.append(label, select);
      form.appendChild(group);
    }

    // Clear filters
    const clearBtn = _el('button', {
      style: `background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.35);
              font-size:10px;padding:3px 8px;border-radius:3px;cursor:pointer;align-self:flex-end;`,
      textContent: 'Clear',
    });
    clearBtn.addEventListener('click', () => { _filters = {}; _renderFilterBar(); _applyFilters(); });
    form.appendChild(clearBtn);

    _filterBar.appendChild(form);
  }

  function _applyFilters() {
    if (!_currentThread) return;
    // Filter is applied at render time — no re-fetch needed
    _currentIndex = 0;
    _renderSequenceView();
    _updateProgress();
  }

  function _filteredEntries() {
    if (!_currentThread) return [];
    return _currentThread.entries.filter(entry => {
      for (const [key, val] of Object.entries(_filters)) {
        if (!val) continue;
        if (key === 'arcPhase') {
          if (entry.arcPhase !== val) return false;
          continue;
        }
        // Routing dimensions — check against entry tags
        const match = (entry.tags || []).some(t => t[key] === val);
        if (!match) return false;
      }
      return true;
    });
  }


  // ── SEQUENCE VIEW ──────────────────────────────────────────────────────────

  function _renderSequenceView() {
    _seqView.innerHTML = '';
    const entries = _filteredEntries();

    if (!entries.length) {
      _seqView.appendChild(_el('div', {
        style: 'color:rgba(255,255,255,0.25);text-align:center;padding:40px;font-size:13px;',
        textContent: 'No entries match the active filters.',
      }));
      return;
    }

    // Navigation row
    const navRow = _el('div', {
      style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;',
    });
    const prevBtn = _navBtn('← Prev', () => _navigate(-1));
    const nextBtn = _navBtn('Next →', () => _navigate(1));
    navRow.append(prevBtn, nextBtn);
    _seqView.appendChild(navRow);

    // Cards — show current ± 1
    const indices = [_currentIndex - 1, _currentIndex, _currentIndex + 1].filter(i => i >= 0 && i < entries.length);
    for (const idx of indices) {
      const card = _buildEntryCard(entries[idx], idx === _currentIndex);
      _seqView.appendChild(card);
    }

    // Edges
    if (_currentIndex < entries.length - 1) {
      const edge = _currentThread.edges?.find(
        e => e.from === entries[_currentIndex]?.id && e.to === entries[_currentIndex + 1]?.id
      );
      if (edge?.label) {
        _seqView.appendChild(_el('div', {
          style: `color:rgba(255,255,255,0.3);font-size:11px;font-style:italic;
                  text-align:center;padding:6px 0;letter-spacing:0.02em;`,
          textContent: `· ${edge.label} ·`,
        }));
      }
    }
  }

  function _buildEntryCard(entry, isActive) {
    const card = _el('div', {
      style: `background:${isActive ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)'};
              border:1px solid ${isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'};
              border-radius:6px;padding:16px;margin-bottom:10px;
              opacity:${isActive ? '1' : '0.45'};
              transition:opacity 200ms ease, border-color 200ms ease;
              cursor:${isActive ? 'default' : 'pointer'};`,
    });

    if (!isActive) card.addEventListener('click', () => {
      const entries = _filteredEntries();
      _currentIndex = entries.indexOf(entry);
      _renderSequenceView(); _updateProgress();
    });

    // Title row
    const titleRow = _el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px;' });
    titleRow.appendChild(_el('span', {
      style: 'color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;flex:1;',
      textContent: entry.title || '(untitled)',
    }));

    // Phase badge
    if (entry.arcPhase) {
      const phaseColors = { aetherrot: '#5C3460', solenne: '#8A7040', vireth: '#045050' };
      titleRow.appendChild(_el('span', {
        style: `background:${phaseColors[entry.arcPhase] || '#333'};color:#fff;
                padding:2px 7px;border-radius:2px;font-size:10px;`,
        textContent: entry.arcPhase,
      }));
    }

    // Section label
    if (entry.section) {
      titleRow.appendChild(_el('span', {
        style: 'color:rgba(255,255,255,0.3);font-size:10px;',
        textContent: entry.section,
      }));
    }

    // Body excerpt
    const bodyText = _stripHtml(entry.body || '').slice(0, 200);
    if (bodyText) {
      card.appendChild(titleRow);
      card.appendChild(_el('p', {
        style: 'color:rgba(255,255,255,0.5);font-size:12px;line-height:1.6;margin:0 0 10px;',
        textContent: bodyText + (bodyText.length === 200 ? '…' : ''),
      }));
    } else {
      card.appendChild(titleRow);
    }

    // Tag pills
    if ((entry.tags || []).length) {
      const pillRow = _el('div', { style: 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;' });
      for (const tag of entry.tags.slice(0, 8)) {
        const pill = _el('span', {
          style: `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                  color:rgba(255,255,255,0.5);padding:2px 8px;border-radius:2px;font-size:10px;
                  cursor:pointer;`,
          textContent: tag.id,
          title: `${tag.threshold_id || ''} · ${tag.seed_id || ''}`,
        });
        pill.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openFromTag(tag.id);
        });
        pill.addEventListener('contextmenu', (ev) => {
          ev.preventDefault(); openFromTag(tag.id);
        });
        pillRow.appendChild(pill);
      }
      card.appendChild(pillRow);
    }

    // Routing strip (Pillar · Seed · Layer · Threshold)
    const routingRow = _el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;' });
    const tagForRouting = (entry.tags || [])[0];
    if (tagForRouting) {
      const dims = [
        { val: PILLAR_NAMES[tagForRouting.pillar_id],    color: 'rgba(92,52,96,0.5)'  },
        { val: tagForRouting.seed_id,                    color: 'rgba(8,64,64,0.5)'   },
        { val: LAYER_NAMES[tagForRouting.layer_id],      color: 'rgba(64,56,16,0.5)'  },
        { val: tagForRouting.threshold_id,               color: 'rgba(48,32,32,0.5)'  },
      ];
      for (const d of dims) {
        if (!d.val) continue;
        routingRow.appendChild(_el('span', {
          style: `background:${d.color};color:rgba(255,255,255,0.4);padding:1px 6px;
                  border-radius:2px;font-size:9px;letter-spacing:0.03em;`,
          textContent: d.val,
        }));
      }
    }
    card.appendChild(routingRow);

    // ∿ trace glyph — bottom right
    const glyphRow = _el('div', { style: 'display:flex;justify-content:flex-end;margin-top:8px;' });
    const glyph = _el('button', {
      style: `background:none;border:none;color:rgba(255,255,255,0.25);font-size:14px;
              cursor:pointer;padding:0;line-height:1;`,
      textContent: '∿',
      title: 'Trace from this entry',
    });
    glyph.addEventListener('click', (ev) => { ev.stopPropagation(); openFromEntry(entry.id); });
    glyphRow.appendChild(glyph);
    card.appendChild(glyphRow);

    return card;
  }

  function _navigate(dir) {
    const entries = _filteredEntries();
    const next = _currentIndex + dir;
    if (next < 0 || next >= entries.length) return;
    _currentIndex = next;
    _renderSequenceView();
    _updateProgress();
  }


  // ── GRAPH EXPORT STUB ──────────────────────────────────────────────────────
  // Builds a ThreadGraphPayload and routes to the graph creation page.
  // The graph page consumes this payload — render logic lives there.

  /**
   * _exportGraph
   * Assembles the ThreadGraphPayload from the current thread and filtered entries,
   * then routes to the graph page. No rendering happens here.
   */
  function _exportGraph() {
    if (!_currentThread) return;

    const entries  = _filteredEntries();
    const threadColor = THREAD_COLORS[_currentThread.threadType] || THREAD_COLORS[THREAD_TYPES.TEMPORAL];

    /** @type {ThreadGraphPayload} */
    const payload = {
      // Metadata
      threadType:   _currentThread.threadType,
      seedLabel:    _seedLabel(_currentThread.seed),
      entryCount:   entries.length,
      generatedAt:  new Date().toISOString(),
      activeFilters: { ..._filters },

      // Routing snapshot across the visible entries
      routingSnapshot: buildRoutingSnapshot(_currentThread),

      // Nodes — one per entry
      nodes: entries.map(entry => {
        const summary = getTagRoutingSummary([entry]);
        return {
          id:           entry.id,
          label:        entry.title || '(untitled)',
          section:      entry.section   || null,
          arcPhase:     entry.arcPhase  || null,
          arcSeedId:    entry.arcSeedId || null,
          pillar_id:    summary.dominantPillarId    || null,
          seed_id:      summary.dominantSeedId      || null,
          layer_id:     summary.dominantLayerId     || null,
          threshold_id: summary.dominantThresholdId || null,
          tagCount:     (entry.tags || []).length,
          bodyLength:   (entry.body || '').length,
          // Graph page uses these for sizing and positioning
          // size = bodyLength (default) or equilibriumState (when ENGINE live)
          size:         entry.equilibriumState || (entry.body || '').length || 20,
          // ring color = dominant pillar
          ringColor:    _pillarColor(summary.dominantPillarId),
          // fill color = section (graph page maps section → color)
          fillKey:      entry.section || 'default',
        };
      }),

      // Edges — from thread engine, enriched with labels
      edges: _currentThread.edges
        .filter(e => {
          const entryIds = new Set(entries.map(en => en.id));
          return entryIds.has(e.from) && entryIds.has(e.to);
        })
        .map(e => ({
          from:            e.from,
          to:              e.to,
          label:           e.label || '',
          weight:          e.weight || 1,
          sharedDimension: e.sharedDimension || null,
          dimensionId:     e.dimensionId     || null,
          isDriftPoint:    e.isDriftPoint    || false,
          color:           threadColor.base,
          activeColor:     threadColor.active,
        })),

      // Annotations (if thread is saved)
      annotations: [],
    };

    // Load saved annotations if thread is already saved
    if (_savedThreadId) {
      loadAnnotations(_savedThreadId).then(anns => {
        payload.annotations = anns || [];
        _routeToGraphPage(payload);
      });
    } else {
      _routeToGraphPage(payload);
    }
  }

  function _routeToGraphPage(payload) {
    // Store payload in sessionStorage for the graph page to pick up
    // Graph page reads window.__threadGraphPayload on load
    try {
      sessionStorage.setItem('threadGraphPayload', JSON.stringify(payload));
    } catch (e) {
      // Fallback: attach to window directly (same session)
      window.__threadGraphPayload = payload;
    }

    // Open graph page
    // If graph page is a panel in the same SPA, call its open function instead:
    //   window.graphPageOpen?.();
    // For now: open in new tab until graph page is built
    window.open(GRAPH_PAGE_PATH, '_blank');
  }

  function _pillarColor(pillarId) {
    return { p01: '#5C3460', p02: '#045050', p03: '#7A3A1A' }[pillarId] || '#333';
  }


  // ── THREAD ANNOTATIONS ─────────────────────────────────────────────────────

  function _renderAnnotationZone() {
    _annotationZone.innerHTML = '';

    const label = _el('div', {
      style: 'color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:0.05em;margin-bottom:6px;',
      textContent: 'THREAD ANNOTATION',
    });

    const textarea = _el('textarea', {
      style: `width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
              color:rgba(255,255,255,0.7);font-size:12px;padding:8px 10px;border-radius:4px;
              resize:none;height:56px;box-sizing:border-box;font-family:inherit;`,
      placeholder: 'Note the pattern you see while traversing…',
    });

    const saveAnnotBtn = _el('button', {
      style: `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
              color:rgba(255,255,255,0.5);font-size:11px;padding:4px 10px;border-radius:3px;
              cursor:pointer;margin-top:6px;`,
      textContent: 'Add annotation',
    });

    saveAnnotBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text || !_savedThreadId) {
        if (!_savedThreadId) _openSaveDialog(true, text);
        return;
      }
      const filterSnapshot = { ..._filters, position: _currentIndex };
      await saveAnnotation(_savedThreadId, text, filterSnapshot);
      textarea.value = '';
    });

    _annotationZone.append(label, textarea, saveAnnotBtn);
  }


  // ── SAVE DIALOG ────────────────────────────────────────────────────────────

  function _buildSaveDialog() {
    const dialog = _el('div', {
      id: 'tt-save-dialog',
      style: `position:fixed;inset:0;z-index:950;background:rgba(13,13,18,0.85);
              display:none;align-items:center;justify-content:center;`,
    });

    const box = _el('div', {
      style: `background:#1A1A24;border:1px solid rgba(255,255,255,0.12);border-radius:8px;
              padding:24px;width:360px;`,
    });

    const title = _el('div', {
      style: 'color:rgba(255,255,255,0.8);font-size:14px;font-weight:600;margin-bottom:14px;',
      textContent: 'Name this thread',
    });

    const input = _el('input', {
      type: 'text',
      style: `width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
              color:rgba(255,255,255,0.8);font-size:13px;padding:8px 10px;border-radius:4px;
              box-sizing:border-box;`,
      placeholder: 'e.g. The Witness Recursion Thread',
    });
    input.id = 'tt-save-input';

    const row = _el('div', { style: 'display:flex;gap:8px;margin-top:14px;justify-content:flex-end;' });

    const cancelBtn = _el('button', {
      style: `background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);
              font-size:12px;padding:5px 12px;border-radius:3px;cursor:pointer;`,
      textContent: 'Cancel',
    });
    cancelBtn.addEventListener('click', () => { dialog.style.display = 'none'; });

    const confirmBtn = _el('button', {
      style: `background:#5C3460;border:none;color:#fff;font-size:12px;
              padding:5px 14px;border-radius:3px;cursor:pointer;`,
      textContent: 'Save',
    });
    confirmBtn.addEventListener('click', async () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      const snapshot = buildRoutingSnapshot(_currentThread);
      const id = await dbSaveThread(_currentThread, name, snapshot, _filters);
      _savedThreadId = id;
      dialog.style.display = 'none';
      _renderHeader(); // update Save button label
    });

    row.append(cancelBtn, confirmBtn);
    box.append(title, input, row);
    dialog.appendChild(box);
    return dialog;
  }

  // pendingAnnotation — if user tries to annotate before saving
  function _openSaveDialog(withAnnotation = false, annotationText = '') {
    _saveDialog.style.display = 'flex';
    const input = document.getElementById('tt-save-input');
    if (input) { input.value = ''; input.focus(); }

    if (withAnnotation && annotationText) {
      // After save completes, save the annotation too
      const confirmBtn = _saveDialog.querySelector('button:last-child');
      const _orig = confirmBtn.onclick;
      confirmBtn.addEventListener('click', async () => {
        if (_savedThreadId) {
          await saveAnnotation(_savedThreadId, annotationText, { ..._filters, position: _currentIndex });
          document.querySelector('#tt-annotation-zone textarea').value = '';
        }
      }, { once: true });
    }
  }


  // ── ENTRY POINT INJECTION ──────────────────────────────────────────────────
  // Injects ∿ glyphs onto entry ID stamps in the currently active panel.
  // Tag pills get contextmenu/longpress listeners via event delegation.

  function _injectEntryPoints() {
    // Delegate tag pill right-click globally — works across all panels
    if (!window.__ttTagDelegateSet) {
      document.addEventListener('contextmenu', (e) => {
        const pill = e.target.closest('[data-tag-id]');
        if (!pill) return;
        e.preventDefault();
        openFromTag(pill.dataset.tagId);
      });
      window.__ttTagDelegateSet = true;
    }

    // Inject ∿ glyphs on entry meta strips
    // Entry meta strips carry data-entry-id attribute
    setTimeout(() => {
      document.querySelectorAll('[data-entry-id]:not([data-tt-injected])').forEach(strip => {
        const entryId = strip.dataset.entryId;
        if (!entryId) return;
        const glyph = _el('span', {
          style: `color:rgba(255,255,255,0.25);font-size:12px;cursor:pointer;
                  margin-left:6px;user-select:none;`,
          textContent: '∿',
          title: 'Trace thread from this entry',
        });
        glyph.addEventListener('click', (e) => { e.stopPropagation(); openFromEntry(entryId); });
        strip.appendChild(glyph);
        strip.dataset.ttInjected = 'true';
      });
    }, 0);
  }


  // ── HELPERS ────────────────────────────────────────────────────────────────

  async function _fetchEntries() {
    try {
      const all = await getAllEntries();
      // Scope to active section if panel is active
      if (_activeSection) return all.filter(e => e.section === _activeSection);
      return all;
    } catch (err) {
      console.warn('[ThreadTraceUI] _fetchEntries failed:', err);
      return [];
    }
  }

  function _seedLabel(seed) {
    if (!seed) return 'Thread';
    if (seed.type === 'entry') return `Entry: ${seed.id}`;
    if (seed.type === 'tag')   return `Tag: ${seed.id}`;
    if (seed.type === 'finding') return seed.id.description || 'Emergence pattern';
    if (seed.type === 'query') return `"${seed.id}"`;
    return String(seed.id || 'Thread');
  }

  function _seedOptions() {
    // s01–s20 with short names — extend from SEED_PHRASES in thread-trace.js if needed
    return Array.from({ length: 20 }, (_, i) => {
      const id = `s${String(i + 1).padStart(2, '0')}`;
      return [id, id];
    });
  }

  function _thresholdOptions() {
    return Array.from({ length: 12 }, (_, i) => {
      const id = `t${String(i + 1).padStart(2, '0')}`;
      return [id, id];
    });
  }

  function _showEmpty(seedObj, threadType) {
    _buildOverlay();
    _seqView.innerHTML = '';
    _seqView.appendChild(_el('div', {
      style: 'color:rgba(255,255,255,0.25);text-align:center;padding:60px;font-size:13px;',
      textContent: `No entries found for this ${threadType} thread.`,
    }));
    _show();
  }

  function _el(tag, props = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'style')       el.style.cssText = v;
      else if (k === 'textContent') el.textContent = v;
      else                     el.setAttribute(k, v);
    }
    return el;
  }

  function _toggleBtn(label, active, onClick) {
    const btn = _el('button', {
      style: `background:${active ? 'rgba(255,255,255,0.1)' : 'none'};
              border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,${active ? '0.8' : '0.35'});
              font-size:11px;padding:3px 10px;border-radius:3px;cursor:pointer;`,
      textContent: label,
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  function _navBtn(label, onClick) {
    const btn = _el('button', {
      style: `background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);
              font-size:11px;padding:4px 12px;border-radius:3px;cursor:pointer;`,
      textContent: label,
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  function _stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // ── Public interface ───────────────────────────────────────────────────────
  return {
    activatePanel,
    deactivatePanel,
    open,
    close,
    openFromEntry,
    openFromTag,
    openFromFinding,
  };

})();

// Expose globally — parallel to TaggerBus
window.ThreadTraceUI = ThreadTraceUI;
export default ThreadTraceUI;