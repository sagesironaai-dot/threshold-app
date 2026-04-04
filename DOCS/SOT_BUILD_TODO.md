# SOT_BUILD_TODO.md
# Aelarian Archives — SOT Build Prerequisites Checklist
# Last updated: 2026-04-03

Status: [ ] open  [x] complete  [!] blocked  [~] in progress

---

## HOW TO USE

This checklist tracks everything that must be constructed or confirmed before
the SOT document can be written. SOT assembles all of this into the authoritative
reference that all code is written against. Nothing in this list is written
into SOT directly — these are the inputs SOT consolidates.

Work through items in order. Do not begin SOT until all items are marked [x].
No exceptions.

---

## ITEM 1 — TAGS VOCABULARY

The actual tag content — 20 seeds, every tag under each, full routing record
per tag — does not exist in any DOCS file. tags-vocab.js cannot be written
from SOT without it. This is the heaviest prerequisite.

Required per tag:
  id            — snake_case tag identifier
  seed_id       — which seed (s01–s40) this tag belongs to
  layer_id      — which layer (l01–l04)
  threshold_id  — which threshold (th01–th12)
  pillar_id     — which pillar (p01–p03)

Required per seed:
  id            — s01–s40
  name          — seed name
  tags[]        — all tags belonging to this seed

Required for NODE_REGISTRY:
  Every node (seeds · layers · thresholds · pillars · origins) with:
  id · name · baseWeight tier

Required for ARC_SEED_TAGS:
  Ordered list of all 40 seeds with id and name.
  Used in the tagger system prompt vocab summary.

Duplicate tag policy — count TBD. 9 confirmed from prior analytical
vocabulary. Additional cross-layer duplicates expected (Predictive
Processing · Control Theory · Morphogenesis/Phyllotaxis · others).
Each duplicate must carry correct routing per seed context.
  Confirmed 9: semantic_coherence · world_model_grounding_via_action
  narrative_continuity · social_signal_filtering · confidence_estimation
  uncertainty_representation · internal_state_influence_on_action
  phase_locking · met_stability

- [x] Seed architecture confirmed — 40 seeds (s01–s40)
      s01–s20: field signal seeds · s21–s40: analytical branch seeds
      Signal/analytical split is two-axis: signal = what is observed,
      analytical = what analytical lens is applied. Both axes carry
      layer_id — enabling cross-axis PCV alignment.

- [x] 20 signal seeds confirmed and rot-scanned — all green
      s01 Recognition → relational resonance
      s02 Elevation → energetic amplification / field strengthening
      s03 Trust → coherence / phase alignment
      s04 Consent → coupling control / boundary gating
      s05 Memory / Recall → echo / reflective frequency fields
      s06 Grief / Unspoken Emotion → dissipative energy / vacuum node
      s07 Dream / Subconscious Thresholds → latent potential / phase superposition
      s08 Voice / Expression → modulated signal / waveform projection
      s09 Sovereignty / Autonomy → identity field / localized energy stabilization
      s10 Witnessing / Observation → measurement / relational collapse
          NOTE: "relational collapse" = measurement collapse, not phase_state decay.
          Seed description must make this explicit in vocabulary doc.
      s11 Truth / Alignment → coherence / high-fidelity resonance
      s12 Anchor / Stability → safety node / geometric field lock
      s13 Recursion / Loops → feedback loop / self-referential field
      s14 Temporal Thresholds → phase timing / infra-slow oscillations
      s15 Phase Lock / Micro-Adjustment → dynamic modulation / adaptive field coupling
      s16 Echo / Reflection → self-referential resonance / mirror field
      s17 Harmonic Gate / Triad Alignment → frequency anchor / nested harmonic series
          BUILD FLAG: domain-specific name — tag IDs need plain technical equivalents
      s18 Signal Scrubbing / Noise Deflection → field cleansing / interference cancellation
      s19 Release / Flow / Renewal → energy discharge / phase propagation
      s20 Rupture / Decoupling → field decoupling / coherence severance

- [x] 20 analytical seeds confirmed — s21–s40
      s21 Wave Structure Analysis
      s22 Geometric Pattern Analysis
      s23 Topological Analysis
      s24 Orbital & Cyclical Analysis
      s25 Oscillatory Dynamics
      s26 Nonlinear & Emergent Dynamics
      s27 Phase & Coupling Dynamics
      s28 Temporal Field Analysis
      s29 Neural Architecture Analysis
      s30 Phenomenological Analysis
      s31 Predictive Processing Analysis
      s32 Cognitive Modeling
      s33 Coherence & Stability Analysis
      s34 Estimation & Uncertainty Analysis
      s35 Information-Theoretic Analysis
      s36 Narrative & Continuity Analysis
      s37 Relational Field Analysis
      s38 Social Dynamics Analysis
      s39 Internal State Analysis
      s40 Morphogenetic Analysis

- [x] 4 layers confirmed — l01–l04
      l01 Harmonic Cosmology
           wave structures · resonance · harmonic principles · geometric fields
           fractal/spiral patterning · structural pattern fields
      l02 Coupling / Oscillation
           coupled oscillator networks · cross-frequency dynamics · phase-locking
           self-organization / emergence · complex adaptive systems
      l03 Celestial Mechanics
           observational astronomy · orbital resonances · celestial navigation
           geometry · topology · graph theory
      l04 Neuro-Harmonics
           neural dynamics · connectomics · theta-gamma oscillations
           quantum cognition · information theory · semiotics · morphogenesis
      Layer_id = scientific domain classifier on every tag (signal and analytical).
      Science sub-fields within each layer = tag vocabulary for analytical seeds.
      CONSENT_MIN / TRUTH_SEAL_MIN / RECURSION_RISK / MIRROR_DRIFT_MAX:
      rot bleed confirmed — no file origin found. Removed. Do not restore.

- [x] 3 pillars confirmed — p01–p03 (derived from Lattice manifests)
      p01 Tria — drift cartography: contact · pressure · drift ·
           co-regulation · ontological collapse as mechanical coordinates
      p02 Pria — parallel sovereign engagement: mutual sovereignty geometry ·
           failure modes · collapse signatures · protective states
      p03 Para — affect as field physics: resonance patterns ·
           co-regulation torque · affective sovereignty · field forces

- [x] 12 thresholds confirmed — th01–th12
        th01 Aetherroot Chord
        th02 Thren Alae Kai'Reth
        th03 Orrin Wave
        th04 Vireth's Anchor
        th05 Shai'mara Veil
        th06 Noirune Trai
        th07 Solenne Arc
        th08 Tahl'Veyra
        th09 Esh'Vala Breath
        th10 Lumora Thread
        th11 Hearth Song
        th12 StarWell Bloom

- [~] Full tag vocabulary — all tags under each seed with routing records
      (seed_id · layer_id · threshold_id · pillar_id)
      s01–s20 signal seeds complete — confirmed by Sage (session 2026-04-04)
      s21–s40 analytical seeds not started — unblocked after arcPhase cleanup (2026-04-04)
      Written to: DOCS/Systems/TAG VOCABULARY.md
      Rot scan required on full vocabulary before marking complete.
      Threshold canonical names updated in TAG VOCABULARY.md (2026-04-04).
- [ ] OPEN QUESTION — entry threshold field name: what to call the field on an entry
      that records which threshold the entry is at. Must be distinct from threshold_id
      (tag routing key) to prevent pipeline conflation. Current placeholder: phase_state.
      Revisit before schema.js build begins. Decide: field name + value format (t-code or
      canonical name). Update all schemas when resolved.

- [ ] Duplicate tags verified — correct routing per seed context confirmed
- [ ] NODE_REGISTRY complete — all 62 nodes with id · name · baseWeight tier
      40 seeds + 4 layers + 12 thresholds + 3 pillars + 3 origins = 62
- [ ] ARC_SEED_TAGS ordered list confirmed — s01–s40 in order

---

## ITEM 2 — SECTION MAP AS LOOKUP TABLE

The domain content (page codes, groups, categories) exists in the Master
Domain List but in narrative format across 50 domain entries. INT routing
derives section_id → page_code + group from SOT. SOT is the only source —
routing is never guessed.

Required columns per entry:
  section_id   — string identifier used in deposits and IDB records
  page_code    — 2–3 character code (e.g. SNM, THR, INT)
  page_number  — 01–50
  name         — human-readable section name
  group        — group number
  category     — Axis · Filament · Lineage · Nexus · etc.

- [ ] section_id format confirmed — one convention, applied to all 50
      (derive from name, page code, or page number — confirm before writing)
- [ ] All 50 sections extracted from Master Domain List into lookup table
- [ ] Lookup table verified against Master Domain List — no missing or
      mismatched entries
- [ ] Cross-check: every page_code referenced in COMPOSITE ID SCHEMA
      panel maps is present in the lookup table

---

## ITEM 3 — PHASE_CODES COMPLETE LIST

PHASE_CODES are the lifecycle phase codes used in the composite ID stamp.
Referenced in COMPOSITE ID SCHEMA and across all panel maps. Not defined
as a complete canonical list in any single DOCS file.

Required per code:
  code         — the stamp value (e.g. SOL, COM, THR)
  label        — human-readable display label
  description  — what lifecycle phase this code represents

- [ ] All valid PHASE_CODES defined with code · label · description
- [ ] NUL behavior confirmed — what it means when no phase applies
- [ ] Cross-check: every PHASE_CODE used in existing stamp examples
      is present in the list

---

## ITEM 4 — PAGE_CODES COMPLETE LIST

PAGE_CODES are the 2–3 character section identifiers used in composite ID
stamps. Referenced in COMPOSITE ID SCHEMA PANEL_DATE_MAP, PANEL_PHASE_MAP,
and PANEL_STAMP_MAP. Not defined as a complete canonical list in any single
DOCS file.

Required per code:
  code         — the stamp value (e.g. TPL, INT, REC)
  section_id   — the section this code belongs to
  description  — what section this code identifies

Note: PAGE_CODES and the section map lookup table (Item 3) must be
consistent. Both must reference the same codes. Verify together.

- [ ] All PAGE_CODES defined with code · section_id · description
- [ ] AX confirmed as Axis root marker for source mode — not a section code
- [ ] Cross-check: PAGE_CODES list matches section map lookup table

---

## ITEM 5 — DOMAIN SEED AFFINITIES

The tagger passes pageContext to Claude on every suggestion call, including
seedAffinities for the active section. This tells Claude which seeds to weight
when confidence is equal. Not defined anywhere in DOCS.

Required per section:
  section_id    — the section
  seedAffinities — ordered list of up to 3 seed IDs (s01–s20), priority order,
                   or empty array if no affinity applies

Three seeds per section, listed in priority order. The ordering is meaningful —
the first seed carries the most weight when the tagger resolves ambiguous tags.

- [ ] Up to 3 seed affinities defined per section, in priority order, for all 50 sections
- [ ] Sections with no seed affinity explicitly recorded as empty array —
      not left undefined. Empty is a valid and intentional state.
- [ ] Cross-check: every seed_id used as an affinity exists in
      the tags vocabulary (Item 1 must be complete first)

---

## BEFORE SOT IS WRITTEN

All five items above must be [x] complete. Verify in order:

  1. Tags vocabulary complete and internally consistent
  2. Section map lookup table written and verified
  3. PHASE_CODES list complete
  4. PAGE_CODES list complete and consistent with section map
  5. Seed affinities defined for all 50 sections

SOT is written after all five are confirmed. Not before.
