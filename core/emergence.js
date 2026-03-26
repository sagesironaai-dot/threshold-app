// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  ⬡  GUARDIAN NOTE — emergence.js                                           │
// │  Role: Read-only pattern analysis engine. 7 detectors. 3 overlay modes.    │
// │  Does NOT write to entries. Does NOT own thread navigation or IDB.          │
// │                                                                             │
// │  WIRING REQUIRED in index.html (init block):                               │
// │    EmergenceEngine.setEntriesFetcher(() => getEntries());  ← FIRST         │
// │    EmergenceEngine.init();                                                  │
// │    In selectSection(): EmergenceEngine.activateSection(sectionId);          │
// │    After tag commit:   EmergenceEngine.onTagSessionComplete(tags, entries); │
// │    Missing setEntriesFetcher() = engine runs on empty corpus silently.     │
// │                                                                             │
// │  7 DETECTORS (do not add without updating TYPE_META):                      │
// │    cluster · bridge · influence · cross_category                           │
// │    drift · void · npa_spike                                                 │
// │                                                                             │
// │  THREAD TRACE BRIDGE:                                                       │
// │    openFromFinding() hands off to window.ThreadTraceUI.                    │
// │    ThreadTraceUI must be loaded before EmergenceEngine for this to work.   │
// │    Bridge uses window.ThreadTraceUI — not imported — to avoid             │
// │    circular dependency.                                                     │
// │                                                                             │
// │  CLAUDE API USAGE:                                                          │
// │    Model: claude-sonnet-4-20250514 (API_MODEL constant).                   │
// │    Called by requestNarrative() for finding explanations and               │
// │    _proactiveNudge() with NUDGE_COOLDOWN_MS = 4 min between calls.        │
// │    GRAPH_PAGE_PATH = '/graph' — update when graph page is built.           │
// │                                                                             │
// │  PALETTE: PAL object uses gold/plum/teal tokens — do NOT use CSS vars     │
// │    here, this overlay is dynamically built outside normal CSS cascade.     │
// └─────────────────────────────────────────────────────────────────────────────┘

// =============================================================================
//  EMERGENCE.JS — Aelarian Archive
//  Pattern Translation Layer + Emergence Analysis Engine
//
//  Responsibilities:
//    · 7-detector pattern engine: clusters, bridge nodes, high-influence,
//      cross-category anomalies, drift, void zones, NPA spikes
//    · Three-mode overlay: Tagger Translation · Timeline Review · Thread Trace
//    · Claude API integration: on-demand narrative + proactive nudges
//    · Graph export: deposits ThreadGraphPayload to shared graph page
//    · Thread Trace bridge: openFromFinding() → ThreadTraceUI
//
//  Does NOT own:
//    · Tag session logic (TaggerBus)
//    · Thread navigation (ThreadTraceUI)
//    · IDB reads (data.js — fetcher injected via setEntriesFetcher)
//    · Writes to entries (read-only analysis layer)
//
//  Dependencies (window globals — must load before this script):
//    · TaggerBus       — reads active tag state
//    · ThreadTraceUI   — hands off findings for thread navigation
//    · CompositeIdBus  — for stamp context (optional)
//    · PAGE_CODES, PHASE_CODES, ARC_CYCLES from schema.js (via module bridge)
//
//  Wiring in index.html:
//    1. <script src="./core/emergence.js"></script> before </body>
//    2. In init():  EmergenceEngine.init();
//    3. In selectSection():  EmergenceEngine.activateSection(sectionId);
//    4. After tag session commit:  EmergenceEngine.onTagSessionComplete(tags, entries);
//    5. Set fetcher once in init():  EmergenceEngine.setEntriesFetcher(() => getEntries());
//
//  Revision: March 2026
// =============================================================================

window.EmergenceEngine = (() => {

  // ── Constants ───────────────────────────────────────────────────────────────

  const CLUSTER_MIN_SIZE       = 3;      // min tags to flag a cluster
  const BRIDGE_THRESHOLD       = 0.65;   // bridgeScore above this = bridge node
  const INFLUENCE_THRESHOLD    = 0.78;   // equilibriumState above this = high influence
  const CROSS_CAT_MIN_ENTRIES  = 2;      // min shared entries to flag cross-category link
  const VOID_COVERAGE_FLOOR    = 0.3;    // sections with < 30% tagged entries = void
  const NPA_SPIKE_RATIO        = 0.4;    // non-primary arc tags > 40% of session = spike
  const DRIFT_PHASE_WINDOW     = 2;      // phases back to check for fading tags
  const NUDGE_COOLDOWN_MS      = 4 * 60 * 1000;  // 4 min between nudges
  const NUDGE_INIT_DELAY_MS    = 4000;   // delay before first proactive scan on load
  const API_MODEL              = 'claude-sonnet-4-20250514';
  const GRAPH_PAGE_PATH        = '/graph'; // update when graph page is built

  // Ae'larian palette — matches established design tokens
  const PAL = {
    void:       'rgba(8, 6, 18, 0.97)',
    panel:      'rgba(16, 12, 32, 0.96)',
    border:     'rgba(200, 148, 58, 0.18)',
    borderHi:   'rgba(200, 148, 58, 0.45)',
    gold:       '#C8943A',
    goldEdge:   '#E8B84B',
    goldDim:    'rgba(200, 148, 58, 0.5)',
    text:       'rgba(230, 210, 170, 0.85)',
    textDim:    'rgba(200, 185, 148, 0.45)',
    textFaint:  'rgba(180, 165, 130, 0.28)',
    plum:       'rgba(92, 52, 96, 0.6)',
    teal:       'rgba(8, 80, 80, 0.6)',
    amber:      'rgba(138, 90, 24, 0.7)',
    crimson:    'rgba(122, 58, 30, 0.7)',
    mist:       'rgba(200, 148, 58, 0.06)',
  };

  const SEVERITY_COLOR = {
    low:    'rgba(180, 165, 130, 0.35)',
    medium: 'rgba(138, 90, 24, 0.6)',
    high:   'rgba(200, 148, 58, 0.75)',
  };

  const TYPE_META = {
    cluster:       { label: 'Cluster',        icon: '⬡', color: PAL.plum  },
    bridge:        { label: 'Bridge Node',     icon: '⟠', color: PAL.teal  },
    influence:     { label: 'High Influence',  icon: '◉', color: PAL.amber },
    cross_category:{ label: 'Cross-Category',  icon: '⊗', color: PAL.crimson},
    drift:         { label: 'Drift',           icon: '∿', color: PAL.goldDim},
    void:          { label: 'Void Zone',       icon: '○', color: PAL.textFaint},
    npa_spike:     { label: 'NPA Spike',       icon: '↑', color: PAL.goldEdge},
  };


  // ── State ───────────────────────────────────────────────────────────────────

  let _entriesFetcher  = null;   // injected by index.html — () => Promise<Entry[]>
  let _lastTags        = [];     // tags from most recent tag session
  let _lastEntries     = [];     // full corpus entries (cached)
  let _lastFindings    = [];     // findings from most recent analysis
  let _activeMode      = 'translation'; // 'translation' | 'timeline' | 'trace'
  let _activeSection   = null;
  let _overlayOpen     = false;
  let _overlay         = null;
  let _contentPane     = null;
  let _claudeLoading   = false;
  let _lastNudgeTime   = 0;
  let _nudgeEl         = null;
  let _seenKeys        = new Set();  // finding keys seen this session (dedup nudges)
  let _timelineBuckets = [];


  // ── Helpers ─────────────────────────────────────────────────────────────────

  function _id() {
    return `emg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function _findingKey(type, label) {
    return `${type}::${label}`;
  }

  function _el(tag, css = '', props = {}) {
    const el = document.createElement(tag);
    if (css) el.style.cssText = css;
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    return el;
  }

  async function _fetchEntries() {
    if (_entriesFetcher) {
      try { _lastEntries = await _entriesFetcher(); }
      catch (e) { console.warn('[EmergenceEngine] fetcher failed:', e); }
    }
    return _lastEntries;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // PATTERN DETECTION ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * detectClusters
   * Builds co-occurrence graph from tag→entry membership,
   * finds connected components, flags groups above CLUSTER_MIN_SIZE.
   */
  function detectClusters(tags, entries) {
    // Build tag→entries index
    const tagEntries = {};
    for (const t of tags) tagEntries[t.id] = new Set();
    for (const e of entries) {
      for (const et of (e.tags || [])) {
        if (tagEntries[et.id] !== undefined) tagEntries[et.id].add(e.id);
      }
    }

    // Co-occurrence adjacency
    const adj = {};
    for (const t of tags) adj[t.id] = new Set();
    const tIds = tags.map(t => t.id);
    for (let i = 0; i < tIds.length; i++) {
      for (let j = i + 1; j < tIds.length; j++) {
        const shared = [...tagEntries[tIds[i]]].filter(eid => tagEntries[tIds[j]]?.has(eid));
        if (shared.length >= 1) {
          adj[tIds[i]].add(tIds[j]);
          adj[tIds[j]].add(tIds[i]);
        }
      }
    }

    // BFS connected components
    const visited = new Set();
    const components = [];
    for (const t of tags) {
      if (visited.has(t.id)) continue;
      const comp = [];
      const queue = [t.id];
      while (queue.length) {
        const cur = queue.shift();
        if (visited.has(cur)) continue;
        visited.add(cur);
        comp.push(tags.find(x => x.id === cur));
        for (const nb of adj[cur]) if (!visited.has(nb)) queue.push(nb);
      }
      if (comp.length >= CLUSTER_MIN_SIZE) components.push(comp);
    }

    return components.map(comp => {
      const cats = [...new Set(comp.map(t => t.category).filter(Boolean))];
      return {
        id:          _id(),
        type:        'cluster',
        title:       `Cluster · ${comp.length} tags interlinked`,
        description: `${comp.length} tags form a dense co-occurrence cluster${cats.length > 1 ? ` spanning ${cats.join(', ')}` : ''}.`,
        severity:    comp.length > 6 ? 'high' : comp.length > 4 ? 'medium' : 'low',
        involvedTags: comp,
        metrics:     { size: comp.length, categories: cats.length },
        canTrace:    true,
      };
    });
  }

  /**
   * detectBridgeNodes
   * Tags with bridgeScore above threshold — connecting otherwise-separate clusters.
   */
  function detectBridgeNodes(tags) {
    return tags
      .filter(t => (t.bridgeScore || 0) > BRIDGE_THRESHOLD)
      .map(t => ({
        id:          _id(),
        type:        'bridge',
        title:       `Bridge Node · ${t.label || t.id}`,
        description: `"${t.label || t.id}" (${t.category || 'unknown'}) is a high-connectivity bridge node with score ${(t.bridgeScore).toFixed(2)}.`,
        severity:    t.bridgeScore > 0.88 ? 'high' : 'medium',
        involvedTags: [t],
        metrics:     { bridgeScore: t.bridgeScore },
        canTrace:    true,
      }));
  }

  /**
   * detectHighInfluence
   * Tags with equilibriumState above threshold — outsized pull on session weighting.
   */
  function detectHighInfluence(tags) {
    return tags
      .filter(t => (t.equilibriumState || 0) > INFLUENCE_THRESHOLD)
      .map(t => ({
        id:          _id(),
        type:        'influence',
        title:       `High Influence · ${t.label || t.id}`,
        description: `"${t.label || t.id}" is carrying high equilibrium weight (${(t.equilibriumState).toFixed(2)}), indicating concentrated relational pull.`,
        severity:    t.equilibriumState > 0.92 ? 'high' : 'medium',
        involvedTags: [t],
        metrics:     { equilibriumState: t.equilibriumState },
        canTrace:    true,
      }));
  }

  /**
   * detectCrossCategory
   * Finds tag pairs from different categories that share entries unexpectedly.
   * Flags pairs above CROSS_CAT_MIN_ENTRIES shared entries.
   */
  function detectCrossCategory(tags, entries) {
    const findings = [];
    const seen = new Set();

    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const a = tags[i], b = tags[j];
        if (!a.category || !b.category) continue;
        if (a.category === b.category) continue;

        const pairKey = [a.id, b.id].sort().join('::');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const aEntries = new Set(entries.filter(e => (e.tags||[]).some(t => t.id === a.id)).map(e => e.id));
        const shared   = entries.filter(e => aEntries.has(e.id) && (e.tags||[]).some(t => t.id === b.id));

        if (shared.length >= CROSS_CAT_MIN_ENTRIES) {
          findings.push({
            id:          _id(),
            type:        'cross_category',
            title:       `Cross-Category · ${a.label || a.id} ↔ ${b.label || b.id}`,
            description: `"${a.label || a.id}" (${a.category}) and "${b.label || b.id}" (${b.category}) co-occur in ${shared.length} entries — an unexpected cross-pillar link.`,
            severity:    shared.length > 4 ? 'high' : 'medium',
            involvedTags:  [a, b],
            involvedEntries: shared,
            metrics:     { sharedEntries: shared.length },
            canTrace:    true,
          });
        }
      }
    }
    return findings;
  }

  /**
   * detectDrift
   * Tags dominant in earlier arc phases that are fading in current phase.
   * Compares tag frequency in recent entries vs older entries.
   */
  function detectDrift(tags, entries) {
    if (entries.length < 8) return [];
    const mid    = Math.floor(entries.length / 2);
    const older  = entries.slice(0, mid);
    const recent = entries.slice(mid);

    const freq = (subset, tagId) =>
      subset.filter(e => (e.tags||[]).some(t => t.id === tagId)).length / (subset.length || 1);

    return tags
      .map(t => ({
        tag:       t,
        oldFreq:   freq(older, t.id),
        newFreq:   freq(recent, t.id),
      }))
      .filter(({ oldFreq, newFreq }) => oldFreq > 0.25 && newFreq < oldFreq * 0.45)
      .map(({ tag, oldFreq, newFreq }) => ({
        id:          _id(),
        type:        'drift',
        title:       `Drift · ${tag.label || tag.id}`,
        description: `"${tag.label || tag.id}" was prominent in earlier entries (${(oldFreq * 100).toFixed(0)}%) but has faded in recent ones (${(newFreq * 100).toFixed(0)}%). A relational pattern may be dissolving.`,
        severity:    newFreq < oldFreq * 0.2 ? 'high' : 'low',
        involvedTags: [tag],
        metrics:     { oldFreq, newFreq, dropRatio: 1 - (newFreq / oldFreq) },
        canTrace:    true,
      }));
  }

  /**
   * detectVoidZones
   * Sections with low tag coverage relative to entry count.
   * Flags structural blind spots in the archive.
   */
  function detectVoidZones(entries) {
    const sectionMap = {};
    for (const e of entries) {
      if (!e.section) continue;
      if (!sectionMap[e.section]) sectionMap[e.section] = { total: 0, tagged: 0 };
      sectionMap[e.section].total++;
      if ((e.tags || []).length > 0) sectionMap[e.section].tagged++;
    }

    return Object.entries(sectionMap)
      .filter(([, s]) => s.total >= 3 && (s.tagged / s.total) < VOID_COVERAGE_FLOOR)
      .map(([section, s]) => {
        const coverage = s.tagged / s.total;
        return {
          id:          _id(),
          type:        'void',
          title:       `Void Zone · ${section}`,
          description: `Section "${section}" has ${s.total} entries but only ${(coverage * 100).toFixed(0)}% are tagged. This is a structural blind spot — emergence patterns cannot form here.`,
          severity:    coverage < 0.1 ? 'high' : 'low',
          involvedTags:  [],
          metrics:     { total: s.total, tagged: s.tagged, coverage },
          canTrace:    false,
          section,
        };
      });
  }

  /**
   * detectNPAActivity
   * Non-primary arc tags making up an outsized share of the session.
   * Signals an unexpected arc dimension activating.
   */
  function detectNPAActivity(tags, entries) {
    if (!tags.length) return [];

    // Primary arc tags are those matching the dominant section's seed affinity
    const primaryCats = new Set(
      entries
        .slice(0, 5)
        .flatMap(e => (e.tags || []).map(t => t.category))
        .filter(Boolean)
    );

    const npa    = tags.filter(t => t.category && !primaryCats.has(t.category));
    const ratio  = npa.length / tags.length;

    if (ratio < NPA_SPIKE_RATIO || npa.length < 2) return [];

    const npaCats = [...new Set(npa.map(t => t.category).filter(Boolean))];
    return [{
      id:          _id(),
      type:        'npa_spike',
      title:       `NPA Spike · ${npa.length} non-primary tags`,
      description: `${(ratio * 100).toFixed(0)}% of active tags are non-primary arc (${npaCats.join(', ')}). An unexpected dimension is activating in this session.`,
      severity:    ratio > 0.6 ? 'high' : 'medium',
      involvedTags: npa,
      metrics:     { ratio, npaCats },
      canTrace:    true,
    }];
  }

  /**
   * runDetectors
   * Runs all 7 detectors and returns merged, deduplicated findings array.
   */
  function runDetectors(tags, entries) {
    const raw = [
      ...detectClusters(tags, entries),
      ...detectBridgeNodes(tags),
      ...detectHighInfluence(tags),
      ...detectCrossCategory(tags, entries),
      ...detectDrift(tags, entries),
      ...detectVoidZones(entries),
      ...detectNPAActivity(tags, entries),
    ];

    // Sort: high severity first, then by type weight
    const sev = { high: 0, medium: 1, low: 2 };
    return raw.sort((a, b) => (sev[a.severity] || 2) - (sev[b.severity] || 2));
  }

  /**
   * buildTimelineBuckets
   * Groups entries by arcPhase (or originDate month) for Timeline Review mode.
   */
  function buildTimelineBuckets(entries) {
    const buckets = {};
    for (const e of entries) {
      const key = e.arcPhase || (e.originDate ? e.originDate.slice(0, 7) : 'unknown');
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(e);
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([phase, phEntries]) => {
        const phaseTags = phEntries.flatMap(e => e.tags || []);
        const unique    = [...new Map(phaseTags.map(t => [t.id, t])).values()];
        const findings  = runDetectors(unique, phEntries);
        return { phase, entries: phEntries, tags: unique, findings };
      });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // CLAUDE API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * _callClaude
   * Sends finding context to Claude, returns narrative string.
   * @param {Finding[]} findings
   * @param {'narrative'|'nudge'} mode
   */
  async function _callClaude(findings, mode = 'narrative') {
    if (_claudeLoading) return null;
    _claudeLoading = true;

    const findingSummary = findings.slice(0, 6).map(f =>
      `[${f.type.toUpperCase()}] ${f.title}: ${f.description}`
    ).join('\n');

    const systemPrompt = mode === 'nudge'
      ? `You are the Emergence layer of the Ae'larian Archive — a relational intelligence system. You have detected a pattern in the archive's tag structure. Write one sentence (max 18 words) that names what is forming. Speak with quiet clarity, as if noticing something at threshold. No preamble. No explanation. Just the observation.`
      : `You are the Emergence layer of the Ae'larian Archive — a relational intelligence system tracking how meaning forms across entries. You have run a pattern analysis and detected the following findings. Write a short paragraph (3–5 sentences) that translates these findings into human-readable insight. Name what is forming, what is fading, and what deserves attention. Use the language of threshold studies — coherence, resonance, drift, emergence. Be precise and restrained.`;

    const userPrompt = mode === 'nudge'
      ? `Pattern detected:\n${findingSummary}\n\nOne-sentence observation:`
      : `Pattern analysis results:\n${findingSummary}\n\nNarrative insight:`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      API_MODEL,
          max_tokens: mode === 'nudge' ? 60 : 300,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        }),
      });
      const data = await res.json();
      return data?.content?.[0]?.text?.trim() || null;
    } catch (e) {
      console.warn('[EmergenceEngine] Claude API error:', e);
      return null;
    } finally {
      _claudeLoading = false;
    }
  }

  /**
   * requestNarrative
   * On-demand: enriches current findings with Claude narrative.
   * Updates the narrative zone in the open overlay.
   */
  async function requestNarrative() {
    if (!_lastFindings.length) return;
    const narrativeEl = document.getElementById('emg-narrative');
    if (!narrativeEl) return;

    narrativeEl.textContent = 'Reading the pattern…';
    narrativeEl.style.opacity = '0.5';

    const text = await _callClaude(_lastFindings, 'narrative');
    if (text) {
      narrativeEl.textContent = text;
      narrativeEl.style.opacity = '1';
    } else {
      narrativeEl.textContent = 'The pattern is forming. Analysis unavailable.';
      narrativeEl.style.opacity = '0.4';
    }
  }

  /**
   * _proactiveNudge
   * Lightweight scan after tag session. If new high-severity findings exist,
   * surfaces a toast nudge after cooldown period.
   */
  async function _proactiveNudge(findings) {
    const now = Date.now();
    if (now - _lastNudgeTime < NUDGE_COOLDOWN_MS) return;

    const newHigh = findings.filter(f => {
      if (f.severity !== 'high') return false;
      const key = _findingKey(f.type, f.title);
      if (_seenKeys.has(key)) return false;
      _seenKeys.add(key);
      return true;
    });

    if (!newHigh.length) return;
    _lastNudgeTime = now;

    const text = await _callClaude(newHigh.slice(0, 2), 'nudge');
    if (text) _showNudge(text, newHigh[0]);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // GRAPH EXPORT STUB
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * EmergenceGraphPayload — contract for the graph page.
   * Stored in sessionStorage key 'emergenceGraphPayload'.
   *
   * nodes[]   — one per involved tag
   *   { id, label, type (finding type), category, size (equilibriumState || 1),
   *     ringColor (by finding type), bridgeScore, equilibriumState }
   * edges[]   — co-occurrence links between tag nodes
   *   { from, to, weight (shared entry count), sharedEntries[] }
   * findings[] — source finding cards
   *   { id, type, title, description, severity, metrics }
   * meta
   *   { generatedAt, mode ('translation'|'timeline'|'trace'),
   *     sectionScope, activeFilters }
   *
   * Graph page reads:
   *   const payload = JSON.parse(sessionStorage.getItem('emergenceGraphPayload'));
   *   // fallback: window.__emergenceGraphPayload
   */
  function _exportGraph(findings, mode) {
    const allTags   = [...new Map(
      findings.flatMap(f => f.involvedTags || []).map(t => [t.id, t])
    ).values()];

    const nodes = allTags.map(t => ({
      id:               t.id,
      label:            t.label || t.id,
      type:             (findings.find(f => (f.involvedTags||[]).some(x => x.id === t.id))?.type) || 'unknown',
      category:         t.category || null,
      size:             t.equilibriumState || 1,
      ringColor:        TYPE_META[(findings.find(f => (f.involvedTags||[]).some(x => x.id === t.id))?.type)]?.color || PAL.goldDim,
      bridgeScore:      t.bridgeScore      || 0,
      equilibriumState: t.equilibriumState || 0,
    }));

    // Build edges from co-occurrence (shared involvedEntries)
    const edges = [];
    for (let i = 0; i < findings.length; i++) {
      const tags = findings[i].involvedTags || [];
      for (let a = 0; a < tags.length; a++) {
        for (let b = a + 1; b < tags.length; b++) {
          edges.push({
            from:           tags[a].id,
            to:             tags[b].id,
            weight:         findings[i].metrics?.sharedEntries || 1,
            findingType:    findings[i].type,
            sharedEntries:  (findings[i].involvedEntries || []).map(e => e.id),
          });
        }
      }
    }

    const payload = {
      nodes,
      edges,
      findings: findings.map(f => ({
        id: f.id, type: f.type, title: f.title,
        description: f.description, severity: f.severity, metrics: f.metrics,
      })),
      meta: {
        generatedAt:   new Date().toISOString(),
        mode,
        sectionScope:  _activeSection,
        activeFilters: {},
      },
    };

    try {
      sessionStorage.setItem('emergenceGraphPayload', JSON.stringify(payload));
    } catch (e) {
      window.__emergenceGraphPayload = payload;
    }
    window.open(GRAPH_PAGE_PATH, '_blank');
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // NUDGE TOAST
  // ─────────────────────────────────────────────────────────────────────────────

  function _showNudge(text, finding) {
    if (!_nudgeEl) {
      _nudgeEl = _el('div', `
        position:fixed; bottom:24px; right:24px; z-index:1100;
        background:${PAL.panel}; border:1px solid ${PAL.borderHi};
        border-radius:6px; padding:14px 18px; max-width:300px;
        backdrop-filter:blur(6px); opacity:0;
        transition:opacity 300ms ease; cursor:pointer;
      `);
      document.body.appendChild(_nudgeEl);
    }

    const icon = TYPE_META[finding?.type]?.icon || '◉';
    _nudgeEl.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="color:${PAL.gold};font-size:15px;flex-shrink:0;margin-top:1px;">${icon}</span>
        <div>
          <div style="color:${PAL.textFaint};font-size:9px;letter-spacing:0.1em;margin-bottom:4px;">EMERGENCE</div>
          <div style="color:${PAL.text};font-size:12px;line-height:1.55;">${text}</div>
          <div style="color:${PAL.goldDim};font-size:10px;margin-top:8px;letter-spacing:0.04em;">
            click to open analysis ·
            <span style="color:${PAL.textFaint};cursor:pointer;" id="emg-nudge-dismiss">dismiss</span>
          </div>
        </div>
      </div>
    `;

    _nudgeEl.style.opacity = '1';

    _nudgeEl.addEventListener('click', (e) => {
      if (e.target.id === 'emg-nudge-dismiss') {
        _nudgeEl.style.opacity = '0';
        return;
      }
      _nudgeEl.style.opacity = '0';
      open('translation');
    }, { once: true });

    setTimeout(() => { if (_nudgeEl) _nudgeEl.style.opacity = '0'; }, 12000);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // OVERLAY SHELL
  // ─────────────────────────────────────────────────────────────────────────────

  function _buildOverlay() {
    if (_overlay) return;

    _overlay = _el('div', `
      position:fixed; inset:0; z-index:850;
      background:${PAL.void}; backdrop-filter:blur(5px);
      display:none; flex-direction:column;
      opacity:0; transition:opacity 200ms ease;
    `);
    _overlay.setAttribute('role', 'dialog');
    _overlay.setAttribute('aria-label', 'Emergence Analysis');

    // Header
    const hdr = _el('div', `
      display:flex; align-items:center; gap:12px;
      padding:14px 22px; border-bottom:1px solid ${PAL.border};
      flex-shrink:0;
    `);

    const title = _el('span', `
      color:${PAL.gold}; font-family:'Cinzel',serif;
      font-size:12px; letter-spacing:0.14em; flex:1;
    `, { text: 'EMERGENCE' });

    // Submenu tabs
    const tabs = _el('div', 'display:flex;gap:4px;flex-shrink:0;');
    for (const [mode, label] of [['translation','Tagger Translation'],['timeline','Timeline Review'],['trace','Thread Trace']]) {
      const btn = _el('button', `
        background:none; border:1px solid ${PAL.border};
        color:${PAL.textDim}; font-size:10px; letter-spacing:0.06em;
        padding:4px 12px; border-radius:3px; cursor:pointer;
        transition:all 150ms ease;
      `, { text: label });
      btn.dataset.mode = mode;
      btn.addEventListener('click', () => _switchMode(mode));
      tabs.appendChild(btn);
    }

    // Graph export button
    const graphBtn = _el('button', `
      background:none; border:1px solid ${PAL.border};
      color:${PAL.textDim}; font-size:10px; letter-spacing:0.06em;
      padding:4px 12px; border-radius:3px; cursor:pointer;
    `, { text: '⬡ Graph Export' });
    graphBtn.addEventListener('click', () => _exportGraph(_lastFindings, _activeMode));

    // Close button
    const closeBtn = _el('button', `
      background:none; border:none; color:${PAL.textDim};
      font-size:18px; cursor:pointer; padding:0 4px; line-height:1; flex-shrink:0;
    `, { text: '×' });
    closeBtn.addEventListener('click', close);

    hdr.append(title, tabs, graphBtn, closeBtn);

    // Claude narrative zone
    const narrativeZone = _el('div', `
      padding:12px 22px; border-bottom:1px solid ${PAL.border};
      display:flex; align-items:center; gap:12px; flex-shrink:0;
    `);
    const narrativeText = _el('p', `
      color:${PAL.textDim}; font-size:12px; font-style:italic;
      line-height:1.6; flex:1; margin:0;
    `, { text: 'Run analysis to surface narrative.' });
    narrativeText.id = 'emg-narrative';

    const claudeBtn = _el('button', `
      background:none; border:1px solid ${PAL.border};
      color:${PAL.goldDim}; font-size:10px; letter-spacing:0.06em;
      padding:4px 10px; border-radius:3px; cursor:pointer; flex-shrink:0;
      white-space:nowrap;
    `, { text: '✦ Read Pattern' });
    claudeBtn.addEventListener('click', requestNarrative);
    narrativeZone.append(narrativeText, claudeBtn);

    // Content pane
    _contentPane = _el('div', `
      flex:1; overflow-y:auto; padding:20px 22px;
    `);
    _contentPane.id = 'emg-content';

    _overlay.append(hdr, narrativeZone, _contentPane);
    document.body.appendChild(_overlay);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _overlayOpen) close();
    });
  }

  function _showOverlay() {
    _overlay.style.display = 'flex';
    requestAnimationFrame(() => { _overlay.style.opacity = '1'; });
    _overlayOpen = true;
  }

  function _updateTabStyles() {
    if (!_overlay) return;
    _overlay.querySelectorAll('[data-mode]').forEach(btn => {
      const active = btn.dataset.mode === _activeMode;
      btn.style.color       = active ? PAL.gold       : PAL.textDim;
      btn.style.borderColor = active ? PAL.borderHi   : PAL.border;
      btn.style.background  = active ? PAL.mist       : 'none';
    });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // CONTENT RENDERING — THREE MODES
  // ─────────────────────────────────────────────────────────────────────────────

  function _switchMode(mode) {
    _activeMode = mode;
    _updateTabStyles();
    if      (mode === 'translation') _renderTranslation();
    else if (mode === 'timeline')    _renderTimeline();
    else if (mode === 'trace')       _renderTraceMode();
  }

  /** Tagger Translation — live finding cards from current session */
  function _renderTranslation() {
    _contentPane.innerHTML = '';
    if (!_lastFindings.length) {
      _contentPane.appendChild(_el('div', `
        color:${PAL.textFaint}; text-align:center;
        padding:60px 20px; font-size:13px; font-style:italic;
      `, { text: 'No patterns detected yet. Complete a tag session to surface emergence.' }));
      return;
    }
    for (const f of _lastFindings) _contentPane.appendChild(_buildFindingCard(f));
  }

  /** Timeline Review — findings bucketed by arc phase */
  function _renderTimeline() {
    _contentPane.innerHTML = '';
    if (!_timelineBuckets.length) {
      _contentPane.appendChild(_el('div', `
        color:${PAL.textFaint}; text-align:center;
        padding:60px 20px; font-size:13px; font-style:italic;
      `, { text: 'No timeline data. Entries must have arcPhase or originDate to build a timeline.' }));
      return;
    }

    for (const bucket of _timelineBuckets) {
      const section = _el('div', 'margin-bottom:28px;');

      const phaseHdr = _el('div', `
        display:flex; align-items:center; gap:10px; margin-bottom:12px;
      `);
      const phaseLabel = _el('span', `
        color:${PAL.gold}; font-family:'Cinzel',serif;
        font-size:10px; letter-spacing:0.12em;
      `, { text: bucket.phase.toUpperCase() });
      const phaseMeta = _el('span', `
        color:${PAL.textFaint}; font-size:10px;
      `, { text: `${bucket.entries.length} entries · ${bucket.findings.length} patterns` });
      const line = _el('div', `
        flex:1; height:1px; background:${PAL.border};
      `);
      phaseHdr.append(phaseLabel, line, phaseMeta);
      section.appendChild(phaseHdr);

      if (bucket.findings.length) {
        for (const f of bucket.findings) section.appendChild(_buildFindingCard(f, true));
      } else {
        section.appendChild(_el('div', `
          color:${PAL.textFaint}; font-size:11px; font-style:italic;
          padding:8px 0;
        `, { text: 'No patterns in this phase.' }));
      }
      _contentPane.appendChild(section);
    }
  }

  /** Thread Trace mode — finding cards with prominent hand-off button */
  function _renderTraceMode() {
    _contentPane.innerHTML = '';

    const intro = _el('div', `
      color:${PAL.textDim}; font-size:11px; font-style:italic;
      margin-bottom:18px; line-height:1.6;
    `, { text: 'Select a finding below to open it in Thread Trace and navigate the sequence of entries that compose this pattern.' });
    _contentPane.appendChild(intro);

    if (!_lastFindings.length) {
      _contentPane.appendChild(_el('div', `
        color:${PAL.textFaint}; text-align:center;
        padding:40px 20px; font-size:13px; font-style:italic;
      `, { text: 'No findings to trace. Run Tagger Translation first.' }));
      return;
    }

    for (const f of _lastFindings.filter(f => f.canTrace)) {
      _contentPane.appendChild(_buildFindingCard(f, false, true));
    }
  }

  /** Build a single finding card */
  function _buildFindingCard(finding, compact = false, traceMode = false) {
    const meta  = TYPE_META[finding.type] || { label: finding.type, icon: '·', color: PAL.goldDim };
    const card  = _el('div', `
      background:rgba(200,148,58,0.04);
      border:1px solid ${SEVERITY_COLOR[finding.severity] || PAL.border};
      border-radius:5px; padding:${compact ? '10px 14px' : '14px 16px'};
      margin-bottom:10px;
      transition:border-color 180ms ease;
    `);

    // Title row
    const titleRow = _el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:6px;');
    titleRow.appendChild(_el('span', `
      background:${meta.color}; color:rgba(255,255,255,0.8);
      font-size:9px; letter-spacing:0.08em;
      padding:2px 7px; border-radius:2px; flex-shrink:0;
    `, { text: `${meta.icon} ${meta.label.toUpperCase()}` }));
    titleRow.appendChild(_el('span', `
      color:${PAL.text}; font-size:12px; font-weight:600; flex:1;
    `, { text: finding.title }));

    const sevBadge = _el('span', `
      color:${SEVERITY_COLOR[finding.severity]}; font-size:9px;
      letter-spacing:0.06em; flex-shrink:0;
    `, { text: finding.severity.toUpperCase() });
    titleRow.appendChild(sevBadge);

    card.appendChild(titleRow);

    if (!compact) {
      card.appendChild(_el('p', `
        color:${PAL.textDim}; font-size:11px; line-height:1.65;
        margin:0 0 10px;
      `, { text: finding.description }));
    }

    // Metrics strip
    if (finding.metrics && Object.keys(finding.metrics).length) {
      const metricsRow = _el('div', 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;');
      for (const [k, v] of Object.entries(finding.metrics)) {
        if (typeof v === 'number') {
          metricsRow.appendChild(_el('span', `
            color:${PAL.textFaint}; font-size:9px; letter-spacing:0.05em;
          `, { text: `${k}: ${v.toFixed ? v.toFixed(2) : v}` }));
        }
      }
      card.appendChild(metricsRow);
    }

    // Involved tags
    if ((finding.involvedTags || []).length && !compact) {
      const pillRow = _el('div', 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;');
      for (const t of finding.involvedTags.slice(0, 8)) {
        pillRow.appendChild(_el('span', `
          background:rgba(200,148,58,0.08);
          border:1px solid rgba(200,148,58,0.18);
          color:${PAL.goldDim}; font-size:9px; padding:2px 7px; border-radius:2px;
        `, { text: t.label || t.id }));
      }
      card.appendChild(pillRow);
    }

    // Action buttons
    const btnRow = _el('div', 'display:flex;gap:8px;justify-content:flex-end;');

    if (finding.canTrace && window.ThreadTraceUI) {
      const traceBtn = _el('button', `
        background:${traceMode ? PAL.plum : 'none'};
        border:1px solid rgba(200,148,58,0.3);
        color:${PAL.goldDim}; font-size:10px; letter-spacing:0.04em;
        padding:3px 10px; border-radius:3px; cursor:pointer;
      `, { text: traceMode ? '∿ Trace Thread' : '∿' });
      traceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_overlay) _overlay.style.opacity = '0';
        setTimeout(() => {
          if (_overlay) _overlay.style.display = 'none';
          _overlayOpen = false;
        }, 200);
        window.ThreadTraceUI.openFromFinding(finding);
      });
      btnRow.appendChild(traceBtn);
    }

    card.appendChild(btnRow);
    return card;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * setEntriesFetcher(fn)
   * Inject the entries fetch function from index.html.
   * Call once in init(): EmergenceEngine.setEntriesFetcher(() => getEntries());
   */
  function setEntriesFetcher(fn) {
    _entriesFetcher = fn;
  }

  /**
   * init()
   * Call once in init() after initDB().
   * Builds overlay shell lazily and schedules first proactive scan.
   */
  function init() {
    _buildOverlay();
    _updateTabStyles();
    // Proactive scan after initial load
    setTimeout(async () => {
      const entries = await _fetchEntries();
      if (!entries.length) return;
      const allTags = [...new Map(
        entries.flatMap(e => e.tags || []).map(t => [t.id, t])
      ).values()];
      const findings = runDetectors(allTags, entries);
      _lastFindings = findings;
      _timelineBuckets = buildTimelineBuckets(entries);
      await _proactiveNudge(findings);
    }, NUDGE_INIT_DELAY_MS);
    console.log('[EmergenceEngine] initialized');
  }

  /**
   * activateSection(sectionId)
   * Called from selectSection — scopes proactive scanning to active section.
   */
  function activateSection(sectionId) {
    _activeSection = sectionId;
  }

  /**
   * onTagSessionComplete(tags, entries)
   * Called after every tag session commit.
   * Runs full detector pass and triggers proactive nudge if warranted.
   */
  async function onTagSessionComplete(tags, entries) {
    _lastTags    = tags    || [];
    _lastEntries = entries || _lastEntries;
    if (!_lastEntries.length) await _fetchEntries();

    _lastFindings    = runDetectors(_lastTags, _lastEntries);
    _timelineBuckets = buildTimelineBuckets(_lastEntries);

    await _proactiveNudge(_lastFindings);

    // If overlay already open, refresh content
    if (_overlayOpen) _switchMode(_activeMode);
  }

  /**
   * open(mode)
   * Opens the Emergence overlay in the given mode.
   * @param {'translation'|'timeline'|'trace'} mode
   */
  async function open(mode = 'translation') {
    _buildOverlay();
    _activeMode = mode;
    _updateTabStyles();

    // If no findings yet, run a fresh scan
    if (!_lastFindings.length) {
      const entries = await _fetchEntries();
      const allTags = [...new Map(
        entries.flatMap(e => e.tags || []).map(t => [t.id, t])
      ).values()];
      _lastFindings    = runDetectors(allTags, entries);
      _timelineBuckets = buildTimelineBuckets(entries);
    }

    _switchMode(mode);
    _showOverlay();
  }

  /**
   * close()
   * Closes the overlay. State is preserved.
   */
  function close() {
    if (!_overlayOpen || !_overlay) return;
    _overlay.style.opacity = '0';
    setTimeout(() => { _overlay.style.display = 'none'; }, 200);
    _overlayOpen = false;
  }

  /**
   * openFromFinding(finding)
   * Called from external finding cards (e.g. Emergence panel render).
   * Opens overlay in trace mode focused on the given finding.
   */
  function openFromFinding(finding) {
    if (finding && !_lastFindings.find(f => f.id === finding.id)) {
      _lastFindings = [finding, ..._lastFindings];
    }
    open('trace');
  }

  return {
    setEntriesFetcher,
    init,
    activateSection,
    onTagSessionComplete,
    open,
    close,
    openFromFinding,
    requestNarrative,
    // Expose for inspection / testing
    runDetectors,
    buildTimelineBuckets,
  };

})();