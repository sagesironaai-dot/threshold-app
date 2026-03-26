// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  ⬡  GUARDIAN NOTE — thread_trace.js                                        │
// │  Role: Pure logic engine for thread building. No DOM. No IDB. No Claude.   │
// │  All four thread builders live here and nowhere else.                       │
// │                                                                             │
// │  FOUR THREAD TYPES:                                                         │
// │    TEMPORAL   — entries ordered by originDate; scoped by arc/phase/section  │
// │    RELATIONAL — BFS from seed entry via linkedEntries + shared tag routing   │
// │                  (MAX_DEPTH = 4, MAX_ENTRIES = 30)                          │
// │    CLUSTER    — entries sharing a dominant tag cluster                       │
// │    EMERGENCE  — entries linked by Emergence findings + co-occurrence        │
// │                                                                             │
// │  resolveSeed() NORMALISATION RULES:                                         │
// │    tv_ prefix or short-code pattern → 'tag' type                           │
// │    finding object (involvedTags or findingType) → 'finding' type           │
// │    plain string (non-tag pattern) → 'entry' type                           │
// │    All other objects with threadTypes → type guessed from seed.id          │
// │                                                                             │
// │  getActiveFilterState() reads from window.TaggerBus.getResult().           │
// │    Returns null silently if TaggerBus is not loaded.                       │
// │                                                                             │
// │  TEMPORAL FALLBACK:                                                          │
// │    If scoped pool < 3 entries, falls back to full corpus automatically.    │
// │    If RELATIONAL seed is not type 'entry', falls back to TEMPORAL.         │
// │                                                                             │
// │  EDGE LABELS (generateEdgeLabel):                                           │
// │    Pure function. Depends only on entry data. No external calls.           │
// │    Called per-edge in all four builders.                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * thread_trace.js
 * Thread Trace Core Engine — Aelarian Archive
 *
 * Responsibilities:
 *   · THREAD_TYPES constant — the four thread modes
 *   · resolveSeed(rawSeed) — normalises any entry point into a seed object
 *   · buildThread(seed, entries, threadType, opts) — main thread builder
 *   · generateEdgeLabel(entryA, entryB, threadType) — edge label generator
 *   · getTagRoutingSummary(entries) — dominant routing dimensions
 *   · getActiveFilterState() — reads TaggerBus filter state
 *   · buildRoutingSnapshot(threadResult) — payload-ready routing summary
 *
 * Does NOT own:
 *   · UI rendering (thread_trace_ui.js)
 *   · IDB persistence (thread_trace_db.js)
 *   · Tag vocabulary (tags-vocab.js)
 *
 * Thread types:
 *   TEMPORAL   — entries ordered by originDate along a shared arc/phase
 *   RELATIONAL — entries connected by explicit links or shared tag routing
 *   CLUSTER    — entries sharing a dominant tag cluster
 *   EMERGENCE  — entries linked by co-occurrence patterns (Emergence findings)
 *
 * Revision: March 2026
 */


// ─────────────────────────────────────────────────────────────────────────────
// THREAD TYPES
// ─────────────────────────────────────────────────────────────────────────────

export const THREAD_TYPES = {
  TEMPORAL:   'temporal',
  RELATIONAL: 'relational',
  CLUSTER:    'cluster',
  EMERGENCE:  'emergence',
};


// ─────────────────────────────────────────────────────────────────────────────
// SEED RESOLUTION
// Normalises any raw entry point into a typed seed object.
// Seed types: 'entry' | 'tag' | 'finding' | 'query'
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolveSeed
 * @param {*} rawSeed — string (entryId or tagId), object (finding), or seed object
 * @returns {Seed|null} — { type, id, threadTypes[] } or null if unresolvable
 */
export function resolveSeed(rawSeed) {
  if (!rawSeed) return null;

  // Already a resolved seed object
  if (rawSeed.type && rawSeed.id !== undefined) return rawSeed;

  // Finding object (from Emergence)
  if (rawSeed.seed && typeof rawSeed.seed === 'object') return rawSeed;
  if (rawSeed.findingType || rawSeed.involvedTags) {
    return {
      type:        'finding',
      id:          rawSeed,
      threadTypes: [THREAD_TYPES.EMERGENCE, THREAD_TYPES.CLUSTER],
    };
  }

  // Raw seed object with threadTypes
  if (rawSeed.threadTypes) {
    const id   = rawSeed.seed || rawSeed.id || null;
    const type = typeof id === 'string'
      ? (id.startsWith('thr_') || id.startsWith('emg_') ? 'finding' : _guessIdType(id))
      : 'query';
    return { type, id, threadTypes: rawSeed.threadTypes };
  }

  // Plain string — guess whether it's an entry ID or tag ID
  if (typeof rawSeed === 'string') {
    const type = _guessIdType(rawSeed);
    return {
      type,
      id:          rawSeed,
      threadTypes: type === 'tag'
        ? [THREAD_TYPES.CLUSTER, THREAD_TYPES.TEMPORAL]
        : [THREAD_TYPES.RELATIONAL, THREAD_TYPES.TEMPORAL],
    };
  }

  return null;
}

function _guessIdType(id) {
  if (!id) return 'query';
  // Tag IDs typically start with tv_ or are short codes
  if (String(id).startsWith('tv_') || String(id).match(/^[a-z]{1,3}\d{2,4}$/)) return 'tag';
  return 'entry';
}


// ─────────────────────────────────────────────────────────────────────────────
// THREAD BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildThread
 * Main entry point. Routes to the appropriate builder by threadType.
 *
 * @param {Seed}     seed        — resolved seed from resolveSeed()
 * @param {Entry[]}  entries     — full corpus (pre-fetched by UI layer)
 * @param {string}   threadType  — one of THREAD_TYPES
 * @param {Object}   opts        — { filters: {} }
 * @returns {Promise<ThreadResult>}
 */
export async function buildThread(seed, entries, threadType, opts = {}) {
  if (!seed || !entries || !entries.length) {
    return _emptyResult(seed, threadType);
  }

  const filtered = _applyFilters(entries, opts.filters || {});

  let result;
  switch (threadType) {
    case THREAD_TYPES.TEMPORAL:
      result = _buildTemporalThread(seed, filtered);
      break;
    case THREAD_TYPES.RELATIONAL:
      result = _buildRelationalThread(seed, filtered);
      break;
    case THREAD_TYPES.CLUSTER:
      result = _buildClusterThread(seed, filtered);
      break;
    case THREAD_TYPES.EMERGENCE:
      result = _buildEmergenceThread(seed, filtered);
      break;
    default:
      result = _buildTemporalThread(seed, filtered);
  }

  result.threadType = threadType;
  result.seed       = seed;
  return result;
}


// ── TEMPORAL THREAD ─────────────────────────────────────────────────────────
// Orders entries by originDate along a shared arc/phase trajectory.
// If seed is an entry, scopes to entries sharing the same arcPhase or arc.
// If seed is a tag, scopes to entries carrying that tag.

function _buildTemporalThread(seed, entries) {
  let pool = entries;

  if (seed.type === 'entry') {
    const anchor = entries.find(e => String(e.id) === String(seed.id));
    if (anchor) {
      // Scope to same arc phase or section
      const phase   = anchor.arcPhase || (anchor.metadata || {}).phaseId;
      const section = anchor.section;
      pool = entries.filter(e =>
        (phase   && (e.arcPhase === phase || (e.metadata || {}).phaseId === phase)) ||
        (section && e.section === section)
      );
      if (pool.length < 3) pool = entries; // fallback to full corpus
    }
  } else if (seed.type === 'tag') {
    pool = entries.filter(e =>
      (e.tags || []).some(t => String(t.id) === String(seed.id))
    );
  } else if (seed.type === 'finding') {
    const involvedIds = new Set(
      ((seed.id && seed.id.involvedEntries) || []).map(e => String(e.id))
    );
    if (involvedIds.size) pool = entries.filter(e => involvedIds.has(String(e.id)));
  }

  // Sort by originDate ascending, fallback to createdAt
  const sorted = pool.slice().sort((a, b) => {
    const da = _dateVal(a);
    const db = _dateVal(b);
    return da - db;
  });

  const edges = _buildTemporalEdges(sorted);
  return { entries: sorted, edges };
}

function _buildTemporalEdges(entries) {
  const edges = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const a = entries[i], b = entries[i + 1];
    edges.push({
      from:  a.id,
      to:    b.id,
      label: generateEdgeLabel(a, b, THREAD_TYPES.TEMPORAL),
      weight: 1,
      sharedDimension: _sharedDimension(a, b),
    });
  }
  return edges;
}


// ── RELATIONAL THREAD ───────────────────────────────────────────────────────
// Follows explicit links (linkedEntries metadata) and shared tag routing.
// BFS from seed entry, up to depth 4.

function _buildRelationalThread(seed, entries) {
  if (seed.type !== 'entry') {
    // Fallback to temporal for non-entry seeds
    return _buildTemporalThread(seed, entries);
  }

  const entryMap = new Map(entries.map(e => [String(e.id), e]));
  const anchor   = entryMap.get(String(seed.id));
  if (!anchor) return _emptyResult(seed, THREAD_TYPES.RELATIONAL);

  const visited  = new Set();
  const queue    = [{ entry: anchor, depth: 0 }];
  const sequence = [];
  const edges    = [];
  const MAX_DEPTH = 4;
  const MAX_ENTRIES = 30;

  while (queue.length && sequence.length < MAX_ENTRIES) {
    const { entry, depth } = queue.shift();
    const key = String(entry.id);
    if (visited.has(key)) continue;
    visited.add(key);
    sequence.push(entry);

    if (depth >= MAX_DEPTH) continue;

    // Explicit linked entries in metadata
    const linked = _getLinkedIds(entry);
    for (const lid of linked) {
      const target = entryMap.get(String(lid));
      if (target && !visited.has(String(target.id))) {
        edges.push({
          from:            entry.id,
          to:              target.id,
          label:           'linked',
          weight:          2,
          sharedDimension: 'explicit_link',
        });
        queue.push({ entry: target, depth: depth + 1 });
      }
    }

    // Tag-based relational proximity
    const neighbors = _findTagNeighbors(entry, entries, visited, 3);
    for (const nb of neighbors) {
      const shared = _sharedDimension(entry, nb);
      edges.push({
        from:            entry.id,
        to:              nb.id,
        label:           generateEdgeLabel(entry, nb, THREAD_TYPES.RELATIONAL),
        weight:          1,
        sharedDimension: shared,
      });
      queue.push({ entry: nb, depth: depth + 1 });
    }
  }

  return { entries: sequence, edges };
}


// ── CLUSTER THREAD ──────────────────────────────────────────────────────────
// Finds all entries sharing a dominant tag or tag cluster.
// If seed is a tag, gathers entries carrying that tag, orders by date.
// If seed is a finding, uses the finding's involvedTags.

function _buildClusterThread(seed, entries) {
  let pool   = entries;
  let tagIds = [];

  if (seed.type === 'tag') {
    tagIds = [String(seed.id)];
    pool   = entries.filter(e =>
      (e.tags || []).some(t => String(t.id) === tagIds[0])
    );
  } else if (seed.type === 'finding' && seed.id && seed.id.involvedTags) {
    tagIds = seed.id.involvedTags.map(t => String(t.id));
    pool   = entries.filter(e =>
      (e.tags || []).some(t => tagIds.includes(String(t.id)))
    );
  } else if (seed.type === 'entry') {
    const anchor = entries.find(e => String(e.id) === String(seed.id));
    if (anchor) {
      const anchorTagIds = (anchor.tags || []).map(t => String(t.id));
      if (anchorTagIds.length) {
        tagIds = anchorTagIds;
        pool = entries.filter(e =>
          String(e.id) === String(anchor.id) ||
          (e.tags || []).some(t => anchorTagIds.includes(String(t.id)))
        );
      }
    }
  }

  // Sort by tag overlap (descending), then date
  const scored = pool.map(e => ({
    entry: e,
    overlap: tagIds.length
      ? (e.tags || []).filter(t => tagIds.includes(String(t.id))).length
      : 0,
  }));
  scored.sort((a, b) =>
    b.overlap - a.overlap || _dateVal(a.entry) - _dateVal(b.entry)
  );

  const sorted = scored.map(s => s.entry);
  const edges  = _buildClusterEdges(sorted, tagIds);
  return { entries: sorted, edges };
}

function _buildClusterEdges(entries, tagIds) {
  const edges = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const a = entries[i], b = entries[i + 1];
    const sharedTags = (a.tags || []).filter(t =>
      (b.tags || []).some(bt => bt.id === t.id)
    );
    if (sharedTags.length) {
      edges.push({
        from:            a.id,
        to:              b.id,
        label:           sharedTags.slice(0, 2).map(t => t.label || t.id).join(' · '),
        weight:          sharedTags.length,
        sharedDimension: 'tag_cluster',
        dimensionId:     sharedTags[0]?.id,
      });
    }
  }
  return edges;
}


// ── EMERGENCE THREAD ────────────────────────────────────────────────────────
// Uses Emergence finding metadata to sequence entries by pattern significance.
// Falls back to cluster thread if finding has involvedTags.

function _buildEmergenceThread(seed, entries) {
  if (!seed.id || typeof seed.id !== 'object') {
    return _buildTemporalThread(seed, entries);
  }

  const finding = seed.id;

  // If finding has directly involved entries, use them ordered by date
  if (finding.involvedEntries && finding.involvedEntries.length) {
    const idSet = new Set(finding.involvedEntries.map(e => String(e.id)));
    const pool  = entries
      .filter(e => idSet.has(String(e.id)))
      .sort((a, b) => _dateVal(a) - _dateVal(b));

    const edges = _buildTemporalEdges(pool);
    edges.forEach(e => {
      e.label        = generateEdgeLabel(
        entries.find(x => x.id === e.from),
        entries.find(x => x.id === e.to),
        THREAD_TYPES.EMERGENCE
      );
      e.isDriftPoint = finding.type === 'drift';
    });
    return { entries: pool, edges };
  }

  // Fallback to cluster if we have involvedTags
  if (finding.involvedTags && finding.involvedTags.length) {
    return _buildClusterThread(seed, entries);
  }

  return _buildTemporalThread(seed, entries);
}


// ─────────────────────────────────────────────────────────────────────────────
// EDGE LABELS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateEdgeLabel
 * Produces a short human-readable label for the connection between two entries.
 */
export function generateEdgeLabel(a, b, threadType) {
  if (!a || !b) return '';

  const sharedTags = _sharedTagLabels(a, b);
  const phaseA = a.arcPhase || (a.metadata || {}).phaseId || '';
  const phaseB = b.arcPhase || (b.metadata || {}).phaseId || '';

  switch (threadType) {
    case THREAD_TYPES.TEMPORAL: {
      if (phaseA && phaseB && phaseA !== phaseB) return `${phaseA} → ${phaseB}`;
      const da = _dateVal(a), db = _dateVal(b);
      const dayDiff = Math.round(Math.abs(db - da) / 86400000);
      if (dayDiff === 0) return 'same day';
      if (dayDiff < 8)   return `${dayDiff}d apart`;
      if (dayDiff < 32)  return `${Math.round(dayDiff / 7)}w apart`;
      return `${Math.round(dayDiff / 30)}mo apart`;
    }

    case THREAD_TYPES.RELATIONAL: {
      if (_getLinkedIds(a).includes(String(b.id)) ||
          _getLinkedIds(b).includes(String(a.id))) return 'explicit link';
      if (sharedTags.length) return sharedTags.slice(0, 2).join(' · ');
      return 'routing proximity';
    }

    case THREAD_TYPES.CLUSTER: {
      if (sharedTags.length) return sharedTags[0];
      return 'co-cluster';
    }

    case THREAD_TYPES.EMERGENCE: {
      if (sharedTags.length) return `↑ ${sharedTags[0]}`;
      return 'pattern link';
    }

    default:
      return sharedTags[0] || '';
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// ROUTING SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getTagRoutingSummary
 * Returns the dominant routing dimensions across a set of entries.
 * Used by the UI to render the routing strip in the overlay header.
 *
 * @param {Entry[]} entries
 * @returns {RoutingSummary}
 */
export function getTagRoutingSummary(entries) {
  const pillars    = {};
  const seeds      = {};
  const layers     = {};
  const thresholds = {};

  for (const e of entries) {
    for (const t of (e.tags || [])) {
      if (t.pillar_id)    pillars[t.pillar_id]       = (pillars[t.pillar_id]    || 0) + 1;
      if (t.seed_id)      seeds[t.seed_id]            = (seeds[t.seed_id]        || 0) + 1;
      if (t.layer_id)     layers[t.layer_id]          = (layers[t.layer_id]      || 0) + 1;
      if (t.threshold_id) thresholds[t.threshold_id]  = (thresholds[t.threshold_id] || 0) + 1;
    }
  }

  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    dominantPillarId:    top(pillars),
    dominantSeedId:      top(seeds),
    dominantLayerId:     top(layers),
    dominantThresholdId: top(thresholds),
    pillarDistribution:    pillars,
    seedDistribution:      seeds,
    layerDistribution:     layers,
    thresholdDistribution: thresholds,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// FILTER STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getActiveFilterState
 * Reads the current TaggerBus filter state if available.
 * Returns null if TaggerBus is not loaded.
 */
export function getActiveFilterState() {
  if (!window.TaggerBus) return null;
  try {
    const result = window.TaggerBus.getResult ? window.TaggerBus.getResult() : null;
    if (!result) return null;
    return {
      arcPhase:     result.arcPhase     || null,
      pillar_id:    result.pillar_id    || null,
      seed_id:      result.seed_id      || null,
      layer_id:     result.layer_id     || null,
      threshold_id: result.threshold_id || null,
    };
  } catch(e) {
    return null;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// ROUTING SNAPSHOT
// Payload-ready summary of routing dimensions across a thread.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildRoutingSnapshot
 * @param {ThreadResult} threadResult
 * @returns {RoutingSnapshot}
 */
export function buildRoutingSnapshot(threadResult) {
  if (!threadResult || !threadResult.entries) return null;
  const summary = getTagRoutingSummary(threadResult.entries);
  return {
    dominantPillarId:    summary.dominantPillarId,
    dominantSeedId:      summary.dominantSeedId,
    dominantLayerId:     summary.dominantLayerId,
    dominantThresholdId: summary.dominantThresholdId,
    entryCount:          threadResult.entries.length,
    edgeCount:           (threadResult.edges || []).length,
    threadType:          threadResult.threadType,
    distributions: {
      pillars:    summary.pillarDistribution,
      seeds:      summary.seedDistribution,
      layers:     summary.layerDistribution,
      thresholds: summary.thresholdDistribution,
    },
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _emptyResult(seed, threadType) {
  return { entries: [], edges: [], threadType, seed };
}

function _dateVal(entry) {
  const d = (entry.metadata || {}).originDate || entry.originDate || entry.createdAt || '';
  if (!d) return 0;
  return new Date(d).getTime() || 0;
}

function _getLinkedIds(entry) {
  const linked = (entry.metadata || {}).linkedEntries || entry.linkedEntries || [];
  return Array.isArray(linked) ? linked.map(String) : [];
}

function _sharedTagLabels(a, b) {
  const bTagIds = new Set((b.tags || []).map(t => t.id));
  return (a.tags || [])
    .filter(t => bTagIds.has(t.id))
    .map(t => t.label || t.id)
    .filter(Boolean);
}

function _sharedDimension(a, b) {
  // Check for shared pillar, seed, layer, threshold in order of specificity
  for (const dim of ['threshold_id', 'seed_id', 'layer_id', 'pillar_id']) {
    const aTags = (a.tags || []).map(t => t[dim]).filter(Boolean);
    const bTags = new Set((b.tags || []).map(t => t[dim]).filter(Boolean));
    const shared = aTags.find(v => bTags.has(v));
    if (shared) return shared;
  }
  // Same section
  if (a.section && a.section === b.section) return 'section:' + a.section;
  return null;
}

function _findTagNeighbors(entry, allEntries, visited, maxNeighbors) {
  const entryTagIds = new Set((entry.tags || []).map(t => String(t.id)));
  if (!entryTagIds.size) return [];

  return allEntries
    .filter(e =>
      !visited.has(String(e.id)) &&
      String(e.id) !== String(entry.id) &&
      (e.tags || []).some(t => entryTagIds.has(String(t.id)))
    )
    .map(e => ({
      entry: e,
      overlap: (e.tags || []).filter(t => entryTagIds.has(String(t.id))).length,
    }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, maxNeighbors)
    .map(x => x.entry);
}

function _applyFilters(entries, filters) {
  if (!filters || !Object.keys(filters).length) return entries;
  return entries.filter(entry => {
    for (const [key, val] of Object.entries(filters)) {
      if (!val) continue;
      if (key === 'arcPhase') {
        if (entry.arcPhase !== val && (entry.metadata || {}).phaseId !== val) return false;
        continue;
      }
      const match = (entry.tags || []).some(t => t[key] === val);
      if (!match) return false;
    }
    return true;
  });
}