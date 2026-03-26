// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  ⬡  GUARDIAN NOTE — tagger_bus.js                                          │
// │  Role: Single coordinator for ALL tagger activity. One pipeline. One       │
// │  suggestion slot. One render function. Context changes per panel.           │
// │  The system does not change.                                                │
// │                                                                             │
// │  WIRING RULE — every panel requires ALL of these calls:                    │
// │    On section nav:    TaggerBus.activateSection(sectionId)                 │
// │    On panel open:     TaggerBus.activatePanel('panelId')                   │
// │    On panel close:    TaggerBus.deactivatePanel()                          │
// │    In commit handler: const r = TaggerBus.getResult();                     │
// │                       TaggerBus.clearResult();                             │
// │    Missing any call = stale tags, wrong context, or ghost suggestions.     │
// │                                                                             │
// │  ADDING A NEW PANEL:                                                       │
// │    Add panel's primary rich text input id to PANEL_INPUT_MAP.              │
// │    Key = panelId string used in activatePanel() calls.                     │
// │    Value = DOM element id of the text field to watch for tagger input.     │
// │                                                                             │
// │  AE-KAI IS SPECIAL:                                                        │
// │    PANEL_INPUT_MAP['aekai'] = null — uses _fBodyProxy() to bridge          │
// │    contenteditable #f-body, which does not have a .value property.         │
// │    All other panels use standard textarea/input elements.                  │
// │                                                                             │
// │  SUGGESTION RENDER TARGET:                                                  │
// │    Always renders into #tag-suggest-list.                                  │
// │    Loading indicator uses #ae-kai-autosave-dot + #ae-kai-autosave-label.  │
// │    Do not create per-panel render targets.                                  │
// │                                                                             │
// │  DEPENDENCIES (must load before this file):                                │
// │    tagger.js · schema.js · tags-vocab.js                                   │
// └─────────────────────────────────────────────────────────────────────────────┘

// =============================================================================
//  TAGGER BUS — Aelarian Archive
//  Single coordinator for all tagger activity across ae-kai + every add panel.
//
//  Principle: the tagger is infrastructure, not per-panel logic.
//  One pipeline. One suggestion slot. One render function.
//  Context changes per section/panel. The system does not.
//
//  HOW IT WORKS:
//    1. On section navigation  → TaggerBus.activateSection(sectionId)
//    2. On any panel open      → TaggerBus.activatePanel('panelId')
//    3. On any panel close     → TaggerBus.deactivatePanel()
//    4. In every commit handler → const r = TaggerBus.getResult(); TaggerBus.clearResult();
//
//  Wiring calls required per-panel: see WIRING GUIDE in master-notes.md
//
//  Dependencies (must be imported before this script):
//    - tagger.js     (attachTaggerToPanel, suggestTags, resolveTagIds)
//    - schema.js     (getSectionContext)
//    - tags-vocab.js (ARC_SEED_TAGS)
// =============================================================================

window.TaggerBus = (() => {

  // ── State ─────────────────────────────────────────────────────────────────
  let _detach    = null;   // cleanup fn from current attachTaggerToPanel call
  let _result    = null;   // last { tags, arcPhase, origin, unitNote } from API
  let _panelId   = null;   // which panel is currently wired
  let _sectionId = null;   // current section (set by activateSection)

  // ── Selector constants ────────────────────────────────────────────────────
  const SUGGEST_LIST_ID   = 'tag-suggest-list';
  const LOADING_DOT_ID    = 'ae-kai-autosave-dot';
  const LOADING_LABEL_ID  = 'ae-kai-autosave-label';

  // ── Panel → primary body input ID map ────────────────────────────────────
  // 'aekai' is special — resolved via contenteditable proxy (see below).
  // The input used for tagging should be the richest text field in the panel.
  const PANEL_INPUT_MAP = {
    aekai:    null,             // → _fBodyProxy()
    invoke:   'invoke-trans',   // Translation field (richer than Ven'ai text)
    kin:      'kin-body-input',
    glyph:    'glyph-body-input',
    ll:       'll-body-input',
    eo:       'eo-body-input',
    lin:      'lin-body-input',
    lattice:  'lat-body-input',
    ss:       'ss-detail-input',
    rituals:  'rit-p-body',
    breath:   'bc-f-desc',
    melodies: 'mel-f-text',
    spiral:   'sp-f-body',
    memory:   'mv-f-body',
    liber:    'ln-f-body',
    venai:    'vadd-def',
  };

  // ── #f-body contenteditable proxy ─────────────────────────────────────────
  // attachTaggerToPanel expects { value, addEventListener, removeEventListener }.
  // #f-body is contenteditable — this proxy bridges the gap cleanly.
  function _fBodyProxy() {
    const getEl = () => document.getElementById('f-body');
    return {
      get value() {
        return getEl()?.textContent?.trim() ?? '';
      },
      addEventListener(evt, fn, opts) {
        getEl()?.addEventListener(evt, fn, opts);
      },
      removeEventListener(evt, fn) {
        getEl()?.removeEventListener(evt, fn);
      },
    };
  }

  // ── Resolve input element for a given panelId ─────────────────────────────
  function _resolveInput(panelId) {
    if (panelId === 'aekai') return _fBodyProxy();
    const id = PANEL_INPUT_MAP[panelId];
    if (!id) {
      console.warn(`[TaggerBus] no input id mapped for panel "${panelId}"`);
      return null;
    }
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[TaggerBus] input element #${id} not found in DOM (panel "${panelId}")`);
    }
    return el;
  }

  // ── Loading indicator ─────────────────────────────────────────────────────
  function _setLoading(on) {
    const dot   = document.getElementById(LOADING_DOT_ID);
    const label = document.getElementById(LOADING_LABEL_ID);
    if (dot)   dot.classList.toggle('saving', on);
    if (label) label.textContent = on ? 'tagging…' : (_result ? 'tagged ·' : '—');
  }

  // ── Render suggestions into ae-kai tag zone ───────────────────────────────
  // Single render function — all panels route here. No per-panel render logic.
  function _render(result) {
    const list = document.getElementById(SUGGEST_LIST_ID);
    if (!list) return;

    if (!result?.tags?.length) {
      list.innerHTML = '';
      list.classList.remove('open');
      return;
    }

    // Weight → filled diamond glyph count
    const diamonds = n => '◆'.repeat(Math.min(n, 5)) + '◇'.repeat(Math.max(0, 5 - n));

    // Seed label from ARC_SEED_TAGS
    const seedName = id => {
      const s = (window.ARC_SEED_TAGS || []).find(x => x.id === id);
      return s ? s.name.split('–')[0].trim() : id;
    };

    const tagRows = result.tags.map(t => `
      <div class="tag-suggest-item" data-tag-id="${t.id}" data-seed="${t.seed || ''}">
        <span class="tag-suggest-id">${t.id.replace(/_/g, '\u200b')}</span>
        <span class="tag-suggest-layer">${seedName(t.seed)} · ${t.layer || '—'}</span>
        <span class="tag-suggest-weight" title="weight ${t.weight}/5">${diamonds(t.weight || 3)}</span>
      </div>`).join('');

    const phaseBadge = result.arcPhase
      ? `<div class="tag-suggest-group">
           <span class="phase-pill" title="Detected arc phase">◈ ${result.arcPhase}</span>
           ${result.origin ? `<span class="phase-pill" style="opacity:.7">⟠ ${result.origin}</span>` : ''}
         </div>`
      : '';

    const noteBadge = result.unitNote
      ? `<div class="tag-suggest-group" style="font-size:0.72rem;opacity:0.55;padding:0.4rem 0.75rem 0.5rem">${result.unitNote}</div>`
      : '';

    list.innerHTML = tagRows + phaseBadge + noteBadge;
    list.classList.add('open');
  }

  // ── Core: wire attachment ─────────────────────────────────────────────────
  function _attach(panelId, sectionId) {
    // Tear down existing listener first
    if (typeof _detach === 'function') {
      _detach();
      _detach = null;
    }

    _panelId = panelId;

    const inputEl = _resolveInput(panelId);
    if (!inputEl) return;

    const sid     = sectionId || _sectionId || null;
    const context = (typeof getSectionContext === 'function' && sid)
      ? getSectionContext(sid)
      : {};

    _detach = attachTaggerToPanel({
      textInputEl:   inputEl,
      context,
      minLength:     20,
      onLoading:     _setLoading,
      onSuggestions: (res) => {
        _result = res;
        _render(res);
      },
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * activateSection(sectionId)
   * Call immediately after `currentSection = sectionId` in selectSection().
   * Re-wires tagger to #f-body with fresh section context.
   */
  function activateSection(sectionId) {
    _sectionId = sectionId;
    _render(null); // clear stale suggestions from previous section
    _attach('aekai', sectionId);
  }

  /**
   * activatePanel(panelId, sectionIdOverride?)
   * Call from every panel's Open/OpenAdd function.
   * Switches tagger from #f-body to this panel's text input.
   * panelId must be a key in PANEL_INPUT_MAP.
   * sectionIdOverride only needed if the panel doesn't use currentSection.
   */
  function activatePanel(panelId, sectionIdOverride) {
    const sid = sectionIdOverride
      || _sectionId
      || (typeof currentSection !== 'undefined' ? currentSection : null);
    _attach(panelId, sid);
  }

  /**
   * deactivatePanel()
   * Call from every panel's Close function.
   * Clears suggestions and returns tagger to #f-body.
   */
  function deactivatePanel() {
    _render(null);
    _result = null;
    _attach('aekai', _sectionId);
  }

  /**
   * getResult()
   * Call in every commit handler to read last tagger output.
   * Returns { tags, arcPhase, origin, unitNote } or null.
   *
   * Standard merge pattern in commit handlers:
   *   const r = TaggerBus.getResult();
   *   const payload = {
   *     ...fields,
   *     arcPhase: r?.arcPhase ?? null,
   *     originId: r?.origin   ?? null,
   *     tags:     r?.tags     ?? [],
   *   };
   *   await createEntry(payload);
   *   TaggerBus.clearResult();
   */
  function getResult() {
    return _result;
  }

  /**
   * clearResult()
   * Call after every successful createEntry/updateEntry in commit handlers.
   * Resets the result slot and clears the suggestion UI.
   */
  function clearResult() {
    _result = null;
    _render(null);
  }

  /**
   * init()
   * Call once in init(), after setupTagInput().
   * Bootstraps the tagger onto #f-body at page load.
   * At load, no section is active yet — wires a null-context attachment
   * so the tagger is ready the moment a section is selected.
   */
  function init() {
    _attach('aekai', null);
    console.log('[TaggerBus] initialized');
  }

  return {
    init,
    activateSection,
    activatePanel,
    deactivatePanel,
    getResult,
    clearResult,
    PANEL_INPUT_MAP, // expose for inspection
  };

})();