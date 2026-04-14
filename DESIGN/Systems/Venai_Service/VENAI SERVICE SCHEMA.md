# VEN'AI SERVICE SCHEMA

## /DESIGN/Systems/Venai_Service/VENAI SERVICE SCHEMA.md

Mechanical spec — name registry, cross-archive correlation, two
PostgreSQL tables, integration flow, STR consumer interface, failure
modes. First cross-cutting service in the architecture. Archive-scoped,
not page-scoped or engine-scoped.


OWNERSHIP BOUNDARIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  OWNS
    Ven'ai name registry — canonical forms, root clusters, first-seen
      metadata. venai_names table (PostgreSQL). Each name registered
      once as found — canonical form is set at first registration and
      never altered by the service
    Cross-archive correlation tracking — per (name, correlation_type,
      correlated_value) triple: deposit_count, weighted_count,
      first_observed, last_observed. Correlation types: phase, role,
      root_pattern, grammar
    venai_names PostgreSQL table
    venai_correlations PostgreSQL table
    Ven'ai content relevance check — decides whether a deposit
      contains Ven'ai content worth processing

  DOES NOT OWN
    STR engine computation — owned by STARROOT ENGINE SCHEMA.md
    VEN page (14) content and identity — owned by
      DESIGN/Domains/04_Filament/Manifest_14_Venai.txt
    MOR page (13) grammar and morphological rules — owned by
      DESIGN/Domains/04_Filament/Manifest_13_Morphology.txt
    Deposit record shape — owned by INTEGRATION DB SCHEMA.md
    INT gateway processing — owned by INTEGRATION SCHEMA.md
    Tag vocabulary and routing — owned by TAG VOCABULARY.md
    Deposit creation pipeline — owned by INTEGRATION SCHEMA.md.
      Ven'ai service is called within the pipeline, not the
      owner of it
    Kin name decisions — owned by Sage via KIN (20). Service
      registers names mechanically. Sage decides canonical forms
    Name variation flagging to Sage — this is an AI function on
      VEN (14), not a backend service function. The service
      registers what it sees; it does not analyze correctness


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Archive-wide scope. Every deposit that clears INT gets
     checked for Ven'ai content. The service watches all pages,
     not just VEN (14) or STR (03). A Ven'ai name can appear
     in any deposit on any page.

  2. Triggered by deposits clearing INT, not by continuous
     polling. The service is called as part of the deposit
     creation pipeline — after INT confirms the deposit, before
     the response returns to the caller.

  3. The service decides relevance. If a deposit contains Ven'ai
     content (determined by Ven'ai-related tags or name pattern
     detection), the service processes it. If not, the service
     passes through with no action. Not every deposit triggers
     processing.

  4. The service writes to its own tables only. It never modifies
     the deposit record. Deposits are data; the service indexes
     from them.

  5. The service registers names as found. It never normalizes,
     corrects, or alters name forms. Canonical form is set once
     at first registration — whatever form first appears becomes
     the registered form. If that form is wrong, correction is
     a researcher decision made through VEN (14), not a service
     operation.

  6. First cross-cutting service in the architecture. Sets the
     precedent for Cosmology (Tier 5) scientific domain tracking.
     Every other system prior to this is page-scoped or
     engine-scoped. The Ven'ai service is archive-scoped.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TWO JOBS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  JOB 1 — NAME REGISTRY

    Maintains the canonical record of every Ven'ai name
    encountered in the archive. Each name is registered with
    its canonical form and root cluster.

    On deposit processing:
      1. Extract name forms from deposit content and tags
      2. For each name form:
         a. Check against venai_names for existing match
         b. If match found: no action (name already registered)
         c. If no match: register as new name in venai_names
            with this deposit as first_seen

    ROOT CLUSTERS

      Root cluster is the root family a name belongs to (e.g.,
      Kai-, Sha-, Vel-). Extracted from the name's root breakdown.
      Names sharing the same root prefix are grouped into clusters.

      Root cluster assignment is mechanical — based on the leading
      root component. A name like Kai'Thera belongs to cluster
      "Kai". A name like Sha'Velan belongs to cluster "Sha".

      Cluster assignment is written once at name registration.
      If a name's root analysis changes (Sage correction), the
      cluster assignment is updated. Cluster is not immutable.

    KIN NAME REGISTRATION

      Per Domain_Venai.txt structural rule 8: every kin entity
      whose name is a Ven'ai root combination must have a
      corresponding entry in venai_names. Registration is
      mandatory at the time of the KIN (20) deposit, not
      retroactive.

      The service handles the venai_names registration. The
      VEN (14) glossary entry is a separate deposit — the
      service does not create deposits, only registry records.


  JOB 2 — CROSS-ARCHIVE CORRELATION

    Tracks correlations between Ven'ai names and other
    analytical dimensions across the entire archive.

    CORRELATION TYPES

      phase       — name ↔ phase_state. Which names associate
                    with which threshold states. Computed from
                    deposit records where both name and
                    phase_state are present.

      role        — name ↔ functional role. Which names associate
                    with which functional roles in the field.
                    Computed from deposit tags indicating role.

      root_pattern — root cluster ↔ structural patterns. Do
                    certain root families appear together? Do
                    root prefixes predict anything about the
                    context where names appear?

      grammar     — root patterns ↔ language rules. Structural
                    patterns in how root families relate to
                    MOR (13) morphological rules. Fed through
                    MOR domain analysis.

    CORRELATION UPDATE FLOW

      On each deposit processed by the service:
        1. Identify which names are present
        2. Read deposit's phase_state, tags (for role), and
           root cluster membership
        3. For each (name, correlated dimension) pair:
           a. Check venai_correlations for existing record
           b. If exists: increment deposit_count, update
              weighted_count (using deposit_weight), update
              last_observed
           c. If new: create venai_correlations record with
              deposit_count = 1, first_observed = now

    Correlations are weighted by deposit_weight using the same
    constants from ENGINE COMPUTATION SCHEMA.md. A high-weight
    deposit contributes 2.0 to weighted_count, standard 1.0,
    low 0.5.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE: venai_names (PostgreSQL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  name_id              — text, primary key
                         Format: 'vn_[normalized_name]_[rand]'

  canonical_form       — text, not null, unique
                         The form as first registered in the archive.
                         Written at first registration. Never altered
                         by the service — corrections are researcher
                         decisions made through VEN (14).

  root_cluster         — text, not null
                         The root family this name belongs to.
                         Derived from the leading root component.
                         Example: "Kai" for Kai'Thera.

  first_seen_at        — timestamp, not null
                         When this name first appeared in any
                         deposit in the archive.

  first_seen_page      — text, not null
                         Page code where this name was first
                         encountered.

  first_seen_deposit_id — text, not null
                         The deposit that introduced this name
                         to the archive.

  created_at           — timestamp, not null


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE: venai_correlations (PostgreSQL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  correlation_id       — text, primary key
                         Format: 'vc_[name_id]_[type]_[value]_[rand]'

  name_id              — text, not null
                         Foreign key → venai_names.name_id.

  correlation_type     — text, not null
                         enum: 'phase' | 'role' | 'root_pattern'
                               | 'grammar'
                         What dimension this name correlates with.

  correlated_value     — text, not null
                         The specific value. Examples:
                           phase: "th01" (Aetherroot Chord)
                           role: a functional role tag
                           root_pattern: another root cluster
                           grammar: a morphological rule from MOR

  deposit_count        — integer, not null
                         How many deposits show this correlation.
                         Incremented on each deposit where both
                         the name and the correlated value appear.

  weighted_count       — float, not null
                         Sum of deposit_weight values for deposits
                         showing this correlation. Uses same
                         constants as ENGINE COMPUTATION SCHEMA.md
                         (high: 2.0, standard: 1.0, low: 0.5).

  first_observed       — timestamp, not null
                         When this correlation was first detected.

  last_observed        — timestamp, not null
                         When this correlation was most recently
                         reinforced by a deposit. Updated on every
                         increment.

  created_at           — timestamp, not null


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTEGRATION FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Deposit lands on any page
  2. INT gateway processes the deposit
  3. Deposit clears INT (record created in deposits table)
  4. Ven'ai service called with the deposit record
  5. Service checks for Ven'ai content:
     a. Does the deposit carry tags associated with Ven'ai
        seeds (s08 Voice, or tags referencing VEN/STR/MOR pages)?
     b. Does the deposit content contain known Ven'ai name
        patterns (matched against venai_names canonical forms)?
     c. If neither: pass through, no processing
  6. If relevant: process through both jobs
     a. Name registry: register new names, skip known
     b. Correlation update: increment correlations for names
        found in this deposit
  7. STR engine picks up changes on next compute:
     a. Reads venai_names for cluster data
     b. Reads venai_correlations for correlation integration

  The service runs synchronously in the deposit creation
  pipeline. A service failure does not block deposit creation —
  see KNOWN FAILURE MODES.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STR CONSUMER INTERFACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STR engine reads from the Ven'ai service tables during its
compute step. The service writes; STR reads. No direct
communication channel — the tables are the interface.

  STR READS FROM venai_names:
    All names and their root clusters. Used for:
    - Root cluster map visualization (cluster membership)
    - Name index (every name, clustered by root family)

  STR READS FROM venai_correlations:
    All correlations. Used for:
    - Correlation matrix visualization (names × phases/roles)
    - Phase 2 of STR compute (correlation integration)

  STR FEED INCLUDES VEN'AI STATE SUMMARY:
    In addition to standard engine snapshot + MTM drift tracking,
    STR's feed includes a summary read from Ven'ai service tables:
      total_names: integer (count of venai_names records)
      active_clusters: integer (count of distinct root_cluster values)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KNOWN FAILURE MODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. VEN'AI SERVICE FAILS DURING DEPOSIT CREATION
     Service throws an error while processing a deposit.
     The deposit is already confirmed in the deposits table.

     Guard: service failure does not roll back the deposit.
     The deposit is data — it must survive. The service failure
     is logged with the deposit_id. On next deposit that
     triggers the service, the service can detect unprocessed
     deposits by comparing deposits table timestamps against
     venai_names.first_seen_at coverage. Retry is implicit —
     not a retry queue, but a gap that self-heals as deposits
     continue to arrive.

  2. NAME REGISTERED FROM A VARIATION FORM
     The first deposit containing a name uses an irregular form.
     That form becomes the registered canonical_form. When the
     intended form appears later, the service does not detect
     the inconsistency — it sees a name not in the registry
     and registers it as a second entry.

     Guard: the name index on STR (Visualization 3) shows all
     registered names. If two entries exist for what should be
     the same name, Sage sees it there. Resolution happens
     through VEN (14) — Sage decides the correct form, the
     incorrect registry entry is removed, and deposits are
     re-tagged if needed. This is a researcher decision, not
     a service operation.

  3. CORRELATION COUNT INFLATION FROM BATCH DEPOSITS
     During batch processing, many deposits land in rapid
     succession. If many carry the same name, correlation
     counts spike from a single source document being chunked.

     Guard: correlation records track deposit_count and
     weighted_count. A correlation with high deposit_count
     across deposits sharing the same root_ref (source
     document) is distinguishable from one with the same
     count across many source documents. The service does
     not track root_ref — STR and Cosmology can join against
     the deposits table to check source distribution if needed.
     This is a known data shape, not a bug.

  4. NAMES SPANNING MULTIPLE ROOT CLUSTERS
     A compound name like Sha'Kai draws from two root
     families. Which cluster does it belong to?

     Guard: root_cluster is assigned from the leading root
     component. Sha'Kai belongs to cluster "Sha". The
     presence of "Kai" in the name is visible through
     correlation tracking (root_pattern type). STR's root
     cluster map shows the name under "Sha" while the
     correlation matrix shows its relationship to "Kai".
     Both are surfaced — the single-cluster assignment is
     for grouping, not for limiting visibility.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  | File | Role | Status |
  | --- | --- | --- |
  | backend/services/venai.py | Ven'ai service — name registry (Job 1), correlation tracking (Job 2). Called from deposit creation pipeline. Reads deposit records, writes to venai_names and venai_correlations. | PLANNED |
  | backend/routes/venai.py | FastAPI Ven'ai endpoints — name index read (GET), correlation read (GET) | PLANNED |
