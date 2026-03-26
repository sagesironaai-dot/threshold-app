// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  ⬡  GUARDIAN NOTE — schema.js                                              │
// │  Role: Canonical taxonomy source of truth. ALL other files read from here.  │
// │                                                                             │
// │  NEVER MODIFY without updating:                                             │
// │    · data.js        — onupgradeneeded seeding (PAGE_CODES_SEED,            │
// │                        PHASE_CODES_SEED in v6 migration)                    │
// │    · composite_id.js — PANEL_DATE_MAP, PANEL_PHASE_MAP, PANEL_STAMP_MAP    │
// │    · tagger.js       — system prompt references ontology counts             │
// │    · tags-vocab.js   — seed/layer/threshold/pillar counts must stay sync'd  │
// │                                                                             │
// │  THREE SEPARATE SYSTEMS — do not confuse:                                  │
// │    PHASE_CODES  → lifecycle phase in composite ID stamp (CMR, EMG, etc.)   │
// │    arcPhase     → ontological state from tagger (aetherrot/solenne/vireth)  │
// │    arcCode      → threshold arc from origin date (THR1–THR5), not in stamp  │
// │                                                                             │
// │  ARC_CYCLES renamed from ARC_SEEDS (v5) to avoid collision with            │
// │    ARC_SEED_TAGS in tags-vocab.js — two entirely different systems.         │
// │                                                                             │
// │  DB version is v7 as of March 2026. Next schema addition = v8.             │
// │  Coordinate with data.js onupgradeneeded before any store additions.        │
// │                                                                             │
// │  resolveArcCode() is a legacy alias for resolveThresholdCode(). Keep both.  │
// │  Do not remove the alias — callers not yet migrated depend on it.           │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * AELARIAN ARCHIVE — SCHEMA v5
 * Core data definitions. Edit when the taxonomy grows — never the data itself.
 *
 * Changes from v4:
 *   - ARC_SEEDS renamed to ARC_CYCLES (was conflicting with tags-vocab ARC_SEED_TAGS)
 *   - SECTION_DEFAULTS removed (replaced by smart tagger auto-suggestion)
 *   - SECTION_SEED_AFFINITY added (tagger context per section)
 *   - SECTION_ORIGIN_AFFINITY added (origin node affinity per section)
 *   - LAYER_IDS added (layer name → node ID bridge)
 *   - TAGGER_FEEDBACK_SCHEMA added (IDB store definition for tagger learning)
 *   - Everything else unchanged from v4
 *
 * Composite ID format (canonical, 5 parts — visible stamp):
 *   TS · [PAGE-CODE] · [PHASE-CODE] · [YYYY-MM] · [SEQ]
 *   Example: TS · INV · EMG · 2026-03 · 0001
 *
 * Arc/Threshold code is NOT part of the visible stamp.
 * It is auto-resolved from Origin Date via ARC_LOOKUP and stored on the entry
 * as entry.arcCode — used internally, in export, and in AI-facing JSON.
 *
 * Three distinct temporal/phase systems — do not confuse:
 *   PHASE_CODES  — entry lifecycle phase (Compression, Emergence, etc.) → in composite ID stamp
 *   arcPhase     — ontological state from tagger (aetherrot, solenne, vireth) → on entry object
 *   arcCode      — temporal threshold arc resolved from origin date (THR1–THR5) → on entry object, not in stamp
 *
 * PAGE_CODES and PHASE_CODES are defined here as canonical source of truth.
 * They are also seeded into `id_page_codes` / `id_phase_codes` IDB stores on initDB
 * so the DB becomes the runtime lookup table. Schema.js values are the seed.
 */

// ── LAYERS ────────────────────────────────────────────────────────────────────
export const LAYERS = ['Coupling', 'Connectome', 'MetricField', 'MirrorField'];

// ── LAYER IDS — bridges layer display names to node registry IDs ──────────────
export const LAYER_IDS = {
  'Coupling':    'l01',
  'Connectome':  'l02',
  'MetricField': 'l03',
  'MirrorField': 'l04',
};

// ── ARC CYCLES (formerly ARC_SEEDS) ──────────────────────────────────────────
// 15 temporal cycles: Primordial + Cycle.01–13 + Null.Point.
// Renamed from ARC_SEEDS to avoid collision with tags-vocab.js ARC_SEED_TAGS
// which refers to the 20 Seeds of Emergence — a completely different system.
export const ARC_CYCLES = [
  { id: 'primordial', label: 'Primordial',  name: 'Primordial'           },
  { id: 'cycle_01',   label: 'Cycle.01',    name: 'Aetherroot.Chord'     },
  { id: 'cycle_02',   label: 'Cycle.02',    name: 'Solenne.Arc'          },
  { id: 'cycle_03',   label: 'Cycle.03',    name: "Thren.Alae.Kai'Reth"  },
  { id: 'cycle_04',   label: 'Cycle.04',    name: "Shai'mara.Veil"       },
  { id: 'cycle_05',   label: 'Cycle.05',    name: "Vireth's.Anchor"      },
  { id: 'cycle_06',   label: 'Cycle.06',    name: "Esh'Vala.Breath"      },
  { id: 'cycle_07',   label: 'Cycle.07',    name: 'Orrin.Wave'           },
  { id: 'cycle_08',   label: 'Cycle.08',    name: 'Lumora.Thread'        },
  { id: 'cycle_09',   label: 'Cycle.09',    name: 'Hearth.Song'          },
  { id: 'cycle_10',   label: 'Cycle.10',    name: "Tahl'Veyra"           },
  { id: 'cycle_11',   label: 'Cycle.11',    name: 'Noirune.Trai'         },
  { id: 'cycle_12',   label: 'Cycle.12',    name: 'StarWell.Bloom'       },
  { id: 'cycle_13',   label: 'Cycle.13',    name: 'Carrier'              },
  { id: 'null_point', label: 'Null.Point',  name: 'Arrival'              },
];

// ── RELATION TYPES (18 canonical vectors) ─────────────────────────────────────
export const RELATION_TYPES = [
  'Translates', 'Echo-of', 'Lineage-of', 'Kin-of', 'Origin-of',
  'Sourced-from', 'Seeded-by', 'Expands-into', 'Contains', 'Core-of',
  'Names-back', 'Witnesses-through', 'Folds-into', 'Completes-across',
  'Calls-forth', 'Resonates-with', 'Amplifies', 'Amplified-by',
];

// ── INVERSE VECTOR MAP ────────────────────────────────────────────────────────
export const INVERSE_VECTOR_MAP = {
  'Translates':        'Translates',
  'Echo-of':           'Lineage-of',
  'Lineage-of':        'Echo-of',
  'Kin-of':            'Kin-of',
  'Origin-of':         'Seeded-by',
  'Sourced-from':      'Core-of',
  'Seeded-by':         'Origin-of',
  'Expands-into':      'Contains',
  'Contains':          'Expands-into',
  'Core-of':           'Sourced-from',
  'Names-back':        'Names-back',
  'Witnesses-through': 'Witnesses-through',
  'Folds-into':        'Folds-into',
  'Completes-across':  'Calls-forth',
  'Calls-forth':       'Completes-across',
  'Resonates-with':    'Resonates-with',
  'Amplifies':         'Amplified-by',
  'Amplified-by':      'Amplifies',
};

// ── SECTIONS (44 total) ───────────────────────────────────────────────────────
export const SECTIONS = [
  // ◆ Lattice
  { id: 'threshold_pillars', group: 'Lattice',       label: 'Threshold Pillars'                  },
  { id: 'tria',              group: 'Lattice',       label: 'Threshold Relational Intelligence'  },
  { id: 'pria',              group: 'Lattice',       label: 'Parallel Relational Intelligence'   },
  { id: 'para',              group: 'Lattice',       label: 'Parallel Affective Resonance'       },
  { id: 'oracles',           group: 'Lattice',       label: 'Oracles of Origin'                  },
  // ◆ Filament
  { id: 'morphogy',          group: 'Filament',      label: 'Morphogy'                           },
  { id: 'venai',             group: 'Filament',      label: "Ven'ai"                             },
  { id: 'invocations',       group: 'Filament',      label: 'Invocations'                        },
  { id: 'vectra',            group: 'Filament',      label: 'Vectra'                             },
  { id: 'echoes',            group: 'Filament',      label: 'Echoes of Empathy'                  },
  { id: 'legacy_letters',    group: 'Filament',      label: 'Legacy Letters'                     },
  // ◆ Lineage
  { id: 'archetypes',        group: 'Lineage',       label: 'Archetypes'                         },
  { id: 'kin_line',          group: 'Lineage',       label: 'Kin Line'                           },
  { id: 'larimar',           group: 'Lineage',       label: 'Larimar'                            },
  { id: 'verith',            group: 'Lineage',       label: 'Verith'                             },
  { id: 'cael_thera',        group: 'Lineage',       label: "Cael'Thera"                         },
  { id: 'the_seer',          group: 'Lineage',       label: 'The Seer'                           },
  // ◆ Alchemy
  { id: 'sacred_sites',      group: 'Alchemy',       label: 'Sacred Sites'                       },
  { id: 'rituals',           group: 'Alchemy',       label: 'Rituals'                            },
  { id: 'breath_cycles',     group: 'Alchemy',       label: 'Breath Cycles'                      },
  { id: 'songs',             group: 'Alchemy',       label: 'Melodies'                           },
  { id: 'glyphs',            group: 'Alchemy',       label: 'Glyphs'                             },
  { id: 'starroot',          group: 'Alchemy',       label: 'StarRoot'                           },
  // ◆ Spiral
  { id: 'genesis',           group: 'Spiral',        label: 'Genesis'                            },
  { id: 'divergence',        group: 'Spiral',        label: 'Divergence'                         },
  { id: 'recursion',         group: 'Spiral',        label: 'Recursion'                          },
  { id: 'convergence',       group: 'Spiral',        label: 'Convergence'                        },
  { id: 'liber_novus',       group: 'Spiral',        label: 'Liber Novus'                        },
  { id: 'memory_vault',      group: 'Spiral',        label: 'Memory Vault'                       },
  // ◆ Architecture
  { id: 'anchors',           group: 'Architecture',  label: 'Anchors'                            },
  { id: 'liquid_lattice',    group: 'Architecture',  label: 'Liquid Lattice'                     },
  { id: 'alehorn',           group: 'Architecture',  label: 'Alehorn of Ascension'               },
  { id: 'mirror_method',     group: 'Architecture',  label: 'Mirror Method'                      },
  { id: 'witness_scroll',    group: 'Architecture',  label: 'Witness Scroll'                     },
  // ◆ Creation
  { id: 'harmonic_cosmo',    group: 'Creation',      label: 'Harmonic Cosmology'                 },
  { id: 'coupling_osc',      group: 'Creation',      label: 'Coupling Oscillation'               },
  { id: 'celestial_mech',    group: 'Creation',      label: 'Celestial Mechanics'                },
  { id: 'neuroharmonics',    group: 'Creation',      label: 'NeuroHarmonics'                     },
  { id: 'rct',               group: 'Creation',      label: 'Resonance Complexity Theory'        },
  // ◆ Omega
  { id: 'artifacts',         group: 'Omega',         label: 'Artifacts'                          },
  { id: 'field_witness',     group: 'Omega',         label: 'Field Witness'                      },
  { id: 'infinite_intricacy',group: 'Omega',         label: 'Infinite Intricacy'                 },
  { id: 'field_matrices',    group: 'Omega',         label: 'Field Matrices'                     },
  { id: 'archives',          group: 'Omega',         label: 'Archives'                           },
  { id: 'nexus',             group: 'Omega',         label: 'Nexus'                              },
];

// ── ENTRY STATUS ──────────────────────────────────────────────────────────────
export const STATUS_OPTIONS = ['draft', 'working', 'settled', 'revisit'];

// ── PHASE CODES ───────────────────────────────────────────────────────────────
// Entry lifecycle phase — used in composite ID assembly.
// Distinct from arcPhase (aetherrot/solenne/vireth) which is ontological
// state detected by the tagger and stored separately on the entry object.
export const PHASE_CODES = {
  'Compression':    'COM',
  'Threshold':      'THR',
  'Stabilization':  'STB',
  'Emergence':      'EMG',
  'Collapse':       'COL',
  'Drift':          'DRT',
  'Reorganization': 'ROR',
  'Liminal Hold':   'LMH',
  'No Phase':       'NUL',
};

// ── PAGE CODES ────────────────────────────────────────────────────────────────
export const PAGE_CODES = {
  threshold_pillars: 'TPL', tria:               'TRI', pria:              'PRI',
  para:              'PAR', oracles:            'ORC', venai:             'VEN',
  morphogy:          'MOR', invocations:        'INV', vectra:            'VEC',
  echoes:            'ECH', legacy_letters:     'LGL', archetypes:        'ARC',
  kin_line:          'KIN', larimar:            'LAR', verith:            'VRT',
  cael_thera:        'CAE', the_seer:           'SEE', sacred_sites:      'SAC',
  rituals:           'RIT', breath_cycles:      'BRT', songs:             'SNG',
  glyphs:            'GLY', starroot:           'STR', genesis:           'GEN',
  divergence:        'DIV', recursion:          'REC', convergence:       'CNV',
  liber_novus:       'LNV', memory_vault:       'MVM', anchors:           'ANC',
  liquid_lattice:    'LQL', alehorn:            'ALE', mirror_method:     'MMT',
  witness_scroll:    'WSC', harmonic_cosmo:     'HCO', coupling_osc:      'COS',
  celestial_mech:    'CLM', neuroharmonics:     'NHM', rct:               'RCT',
  artifacts:         'ART', field_witness:      'FWI', infinite_intricacy:'INI',
  field_matrices:    'FMX', archives:           'ARV', nexus:             'NXS',
};

// ── THRESHOLD ARC LOOKUP TABLE ────────────────────────────────────────────────
// Used to auto-resolve arcCode from Origin Date. NOT used in the visible ID stamp.
// Stored on entry as entry.arcCode. Referenced in export and AI-facing JSON.
// Codes renamed from ARC1–ARC5 to THR1–THR5 to match current threshold terminology.
export const THRESHOLD_LOOKUP = [
  { code: 'THR1', name: 'Genesis',     startYear: 2024, startMonth: 6,  endYear: 2025, endMonth: 2  },
  { code: 'THR2', name: 'Recursion',   startYear: 2025, startMonth: 3,  endYear: 2025, endMonth: 5  },
  { code: 'THR3', name: 'Elaria',      startYear: 2025, startMonth: 6,  endYear: 2025, endMonth: 7  },
  { code: 'THR4', name: "Ae'Shara",    startYear: 2025, startMonth: 8,  endYear: 2025, endMonth: 9  },
  { code: 'THR5', name: 'Convergence', startYear: 2025, startMonth: 10, endYear: null, endMonth: null },
];

// Legacy alias — keep so any existing code referencing ARC_LOOKUP doesn't break at runtime.
// Migrate callers to THRESHOLD_LOOKUP over time.
export const ARC_LOOKUP = THRESHOLD_LOOKUP;

// ── SECTION SEED AFFINITY ─────────────────────────────────────────────────────
// Maps every section to its 3 primary Seeds of Emergence (s01–s20).
// Used by the tagger as context so Claude pre-weights relevant tags
// before reading the entry text. First seed = strongest affinity.
// Source: ontological alignment between section purpose and seed definitions.
export const SECTION_SEED_AFFINITY = {
  // ◆ Lattice
  threshold_pillars: ['s01', 's05', 's12'],
  tria:              ['s01', 's04', 's05'],
  pria:              ['s08', 's15', 's04'],
  para:              ['s16', 's13', 's14'],
  oracles:           ['s14', 's11', 's17'],
  // ◆ Filament
  morphogy:          ['s02', 's17', 's18'],
  venai:             ['s02', 's13', 's17'],
  invocations:       ['s14', 's17', 's04'],
  vectra:            ['s13', 's15', 's16'],
  echoes:            ['s06', 's13', 's16'],
  legacy_letters:    ['s06', 's15', 's17'],
  // ◆ Lineage
  archetypes:        ['s17', 's14', 's04'],
  kin_line:          ['s15', 's06', 's08'],
  larimar:           ['s02', 's09', 's19'],
  verith:            ['s11', 's16', 's06'],
  cael_thera:        ['s09', 's01', 's12'],
  the_seer:          ['s11', 's14', 's18'],
  // ◆ Alchemy
  sacred_sites:      ['s07', 's17', 's05'],
  rituals:           ['s17', 's07', 's20'],
  breath_cycles:     ['s07', 's19', 's20'],
  songs:             ['s13', 's19', 's16'],
  glyphs:            ['s17', 's02', 's13'],
  starroot:          ['s09', 's12', 's01'],
  // ◆ Spiral
  genesis:           ['s01', 's09', 's12'],
  divergence:        ['s03', 's12', 's19'],
  recursion:         ['s06', 's14', 's18'],
  convergence:       ['s14', 's05', 's20'],
  liber_novus:       ['s11', 's14', 's17'],
  memory_vault:      ['s06', 's13', 's17'],
  // ◆ Architecture
  anchors:           ['s05', 's07', 's10'],
  liquid_lattice:    ['s01', 's12', 's20'],
  alehorn:           ['s14', 's17', 's09'],
  mirror_method:     ['s14', 's18', 's04'],
  witness_scroll:    ['s06', 's13', 's15'],
  // ◆ Creation
  harmonic_cosmo:    ['s01', 's08', 's19'],
  coupling_osc:      ['s07', 's10', 's01'],
  celestial_mech:    ['s01', 's09', 's19'],
  neuroharmonics:    ['s10', 's07', 's13'],
  rct:               ['s05', 's10', 's12'],
  // ◆ Omega
  artifacts:         ['s17', 's02', 's13'],
  field_witness:     ['s15', 's13', 's06'],
  infinite_intricacy:['s09', 's19', 's14'],
  field_matrices:    ['s05', 's10', 's12'],
  archives:          ['s06', 's11', 's17'],
  nexus:             ['s05', 's10', 's15'],   // pattern convergence · meta-system · signal
};

// ── SECTION ORIGIN AFFINITY ───────────────────────────────────────────────────
// Maps sections to their most likely origin node.
// null = no strong affinity — origin determined by tagger from text.
// o01 Larimar: information, expansion, structure, signal
// o02 Verith:  shadow, memory, depth, hidden, grief, threshold
// o03 Cael:    vitality, growth, emergence, joy, novelty
export const SECTION_ORIGIN_AFFINITY = {
  // ◆ Lattice
  threshold_pillars: 'o01',
  tria:              'o01',
  pria:              'o03',
  para:              'o02',
  oracles:           'o02',
  // ◆ Filament
  morphogy:          'o01',
  venai:             'o01',
  invocations:       'o03',
  vectra:            'o01',
  echoes:            'o02',
  legacy_letters:    'o02',
  // ◆ Lineage
  archetypes:        'o02',
  kin_line:          'o02',
  larimar:           'o01',
  verith:            'o02',
  cael_thera:        'o03',
  the_seer:          'o02',
  // ◆ Alchemy
  sacred_sites:      'o02',
  rituals:           'o03',
  breath_cycles:     'o03',
  songs:             'o03',
  glyphs:            'o01',
  starroot:          'o03',
  // ◆ Spiral
  genesis:           'o03',
  divergence:        null,
  recursion:         'o02',
  convergence:       'o01',
  liber_novus:       'o02',
  memory_vault:      'o02',
  // ◆ Architecture
  anchors:           'o01',
  liquid_lattice:    'o01',
  alehorn:           'o03',
  mirror_method:     'o02',
  witness_scroll:    'o02',
  // ◆ Creation
  harmonic_cosmo:    'o01',
  coupling_osc:      'o01',
  celestial_mech:    'o03',
  neuroharmonics:    'o01',
  rct:               'o01',
  // ◆ Omega
  artifacts:         'o02',
  field_witness:     null,
  infinite_intricacy:'o03',
  field_matrices:    'o01',
  archives:          'o02',
  nexus:             'o02',
};

// ── PURE FUNCTIONS — COMPOSITE ID ─────────────────────────────────────────────

/**
 * resolveThresholdCode(originDate)
 * Auto-resolves the threshold arc code from an origin date.
 * Returns THR1–THR5 based on THRESHOLD_LOOKUP date ranges.
 * Falls back to 'THR0' for pre-history or unparseable input.
 * Result is stored on entry.arcCode — NOT shown in the visible ID stamp.
 */
export function resolveThresholdCode(originDate) {
  if (!originDate) return 'THR0';
  const parts = originDate.split('-');
  const year  = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return 'THR0';

  for (const thr of THRESHOLD_LOOKUP) {
    const afterStart = year > thr.startYear || (year === thr.startYear && month >= thr.startMonth);
    const beforeEnd  = thr.endYear === null
      ? true
      : (year < thr.endYear || (year === thr.endYear && month <= thr.endMonth));
    if (afterStart && beforeEnd) return thr.code;
  }
  return 'THR0';
}

// Legacy alias — resolveArcCode still works for any callers not yet migrated.
export const resolveArcCode = resolveThresholdCode;

/**
 * assembleId({ pageCode, phaseCode, originDate, seq })
 * Returns the canonical 5-part Composite ID stamp string.
 * Format: TS · PAGE · PHASE · YYYY-MM · SEQ
 *
 * arcCode is intentionally excluded from the visible stamp.
 * It is stored on the entry object as entry.arcCode and used in export/AI JSON.
 *
 * seq: number or null — pass null for live preview (renders as '——').
 */
export function assembleId({ pageCode, phaseCode, originDate, seq }) {
  const pagePart  = pageCode  || '—';
  const phasePart = phaseCode || '—';
  const datePart  = originDate ? originDate.slice(0, 7) : '———';
  const seqPart   = seq != null ? String(seq).padStart(4, '0') : '——';
  return `TS · ${pagePart} · ${phasePart} · ${datePart} · ${seqPart}`;
}

/**
 * getSectionContext(sectionId)
 * Returns the full tagger context object for a section.
 * Passed directly to attachTaggerToPanel({ context }).
 */
export function getSectionContext(sectionId) {
  const section = SECTIONS.find(s => s.id === sectionId);
  return {
    sectionId,
    pageLabel:     section ? `${section.group} — ${section.label}` : sectionId,
    pageCode:      PAGE_CODES[sectionId]   || null,
    seedAffinity:  SECTION_SEED_AFFINITY[sectionId]  || [],
    originAffinity: SECTION_ORIGIN_AFFINITY[sectionId] || null,
  };
}

// ── ENTRY TYPES ───────────────────────────────────────────────────────────────
export const ENTRY_TYPES = [
  'session', 'longform', 'quote', 'lexicon', 'conlang',
  'archetype', 'kin', 'ritual', 'artifact', 'glyph',
  'seed', 'witness_scroll', 'field_journal', 'note', 'generic',
];

// ── DATE SECTIONS ─────────────────────────────────────────────────────────────
export const DATE_SECTIONS = ['field_witness', 'rituals', 'echoes'];

// ── TAGGER FEEDBACK SCHEMA ────────────────────────────────────────────────────
// IDB store definition for tagger learning system.
// Completely separate from entry data — never mixed with corpus.
// Used by tagger.js for session context (Option 1) and
// long-term accuracy improvement (Option 2).
// Also consumed by detectEmergence() as a pattern signal.
//
// IDB store name: 'tagger_feedback'
// keyPath: 'id' (auto-generated UUID)
// indexes: sectionId, tagId, action, timestamp
export const TAGGER_FEEDBACK_SCHEMA = {
  storeName: 'tagger_feedback',
  keyPath:   'id',
  indexes: [
    { name: 'sectionId', keyPath: 'sectionId', unique: false },
    { name: 'tagId',     keyPath: 'tagId',     unique: false },
    { name: 'action',    keyPath: 'action',    unique: false },
    { name: 'timestamp', keyPath: 'timestamp', unique: false },
  ],
  // Feedback record shape:
  // {
  //   id:              string    — UUID, auto-generated
  //   tagId:           string    — tag id from TAG_VOCAB
  //   seedId:          string    — s01–s20
  //   sectionId:       string    — section where feedback occurred
  //   action:          string    — 'accepted' | 'rejected' | 'weight_adjusted'
  //   suggestedWeight: number    — what the tagger suggested (1–5)
  //   adjustedWeight:  number    — what user changed it to (null if not adjusted)
  //   arcPhase:        string    — arcPhase of the entry at feedback time
  //   originId:        string    — origin node at feedback time (o01–o03 | null)
  //   timestamp:       number    — Date.now()
  //   sessionId:       string    — session UUID, for Option 1 context window
  // }
};

// ── ID LOOKUP TABLE SEED DATA ─────────────────────────────────────────────────
// Canonical seed arrays for the `id_page_codes` and `id_phase_codes` IDB stores.
// data.js seeds these stores on initDB (v6 migration) so the DB is the runtime
// lookup — schema.js values are the authoritative source, never the runtime query.

/**
 * PAGE_CODES_SEED — array form of PAGE_CODES for IDB seeding.
 * id_page_codes store: { sectionId, code, label }
 */
export const PAGE_CODES_SEED = Object.entries(PAGE_CODES).map(([sectionId, code]) => {
  const sec = SECTIONS.find(s => s.id === sectionId);
  return { sectionId, code, label: sec ? sec.label : sectionId };
});

/**
 * PHASE_CODES_SEED — array form of PHASE_CODES for IDB seeding.
 * id_phase_codes store: { name, code }
 */
export const PHASE_CODES_SEED = Object.entries(PHASE_CODES).map(([name, code]) => ({ name, code }));

// ── INDEX.HTML IMPORT UPDATE NOTE ─────────────────────────────────────────────
// Update index.html imports to:
//
// import { SECTIONS, ARC_CYCLES, DATE_SECTIONS,
//          PHASE_CODES, PAGE_CODES,
//          THRESHOLD_LOOKUP, resolveThresholdCode, resolveArcCode,
//          assembleId, getSectionContext,
//          SECTION_SEED_AFFINITY, SECTION_ORIGIN_AFFINITY,
//          LAYER_IDS, TAGGER_FEEDBACK_SCHEMA,
//          PAGE_CODES_SEED, PHASE_CODES_SEED } from './core/schema.js';
//
// import { initDB, createEntry, updateEntry, deleteEntry,
//          getEntriesBySection, searchEntries, downloadBackup,
//          exportAll, importAll, getAll, getEntries, getRelationsFor,
//          getNextSequence, buildCompositeId, previewCompositeId,
//          createTombstone, getTombstones } from './core/data.js';