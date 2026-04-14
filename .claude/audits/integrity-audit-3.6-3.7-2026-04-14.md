## Task

Integrity audit of design-build-spec sections 3.6 (Engine State Snapshots + MTM
Drift Tracking) and 3.7 (Engine Result Object). Verified that all specs are
present in every file that requires them, and that field names and descriptions
are consistent across the authoritative spec and all downstream consumers.

Session 50. Requested by Sage after sections 3.6 and 3.7 were locked in a prior
session, to confirm nothing was missed in the first pass.

---

## Files examined

- .claude/plans/design-build-spec.md (sections 3.6, 3.7)
- DESIGN/Systems/Engine_Computation/ENGINE COMPUTATION SCHEMA.md
- DESIGN/Systems/Engine_Computation/SYSTEM_ Engine Computation.md
- DESIGN/Systems/Integration/INTEGRATION DB SCHEMA.md (engine_snapshots, visualization_snapshots tables)
- DESIGN/Systems/Operational_DB/OPERATIONAL DB SCHEMA.md (engine_stale_flags table)
- DESIGN/Systems/Metamorphosis/METAMORPHOSIS SCHEMA.md
- DESIGN/Systems/Liber_Novus/LNV SCHEMA.md
- DESIGN/Systems/Threshold_Engine/THRESHOLD ENGINE SCHEMA.md
- DESIGN/Systems/Echo_Recall_Engine/ECHO RECALL ENGINE SCHEMA.md
- DESIGN/Systems/Infinite_Intricacy_Engine/INFINITE INTRICACY ENGINE SCHEMA.md
- DESIGN/Systems/StarRoot_Engine/STARROOT ENGINE SCHEMA.md
- DESIGN/Systems/Sat_Nam_Engine/SAT NAM ENGINE SCHEMA.md

---

## Findings

### Clean

- engine_snapshots table: all 8 fields match exactly between ENGINE COMPUTATION
  SCHEMA.md and INTEGRATION DB SCHEMA.md. No discrepancies.

- visualization_snapshots table: all 9 fields match exactly between ENGINE
  COMPUTATION SCHEMA.md and INTEGRATION DB SCHEMA.md. No discrepancies.

- engine_stale_flags table: OPERATIONAL DB SCHEMA.md correctly specifies
  integer (0|1) with all three recomputation triggers. Consistent with
  ENGINE COMPUTATION SCHEMA.md spec.

- MTM drift tracking logic: consistent across ENGINE COMPUTATION SCHEMA.md,
  METAMORPHOSIS SCHEMA.md, and design-build-spec section 3.6.

- All 5 engine schemas (THR, STR, INF, ECR, SNM): confirmed to carry
  insufficient_data, low_sample, weight_breakdown, null_contribution in their
  result shapes.

- stale_warning: correct in ENGINE COMPUTATION SCHEMA.md, METAMORPHOSIS
  SCHEMA.md, and SYSTEM_ Engine Computation.md.

- design-build-spec sections 3.6 and 3.7: accurate and complete. Auto-capture
  triggers match. MTM delta logic matches. All shared result fields present.

- LNV lnv_routed boolean and engine_snapshot entry_type: confirmed correct.

### Flags found and fixed

**Flag 1 — LNV content shape field naming inconsistency (FIXED)**
LNV SCHEMA.md engine_snapshot content shape used `computation_snapshot_id`
and `visualization_data` while the source visualization_snapshots table
uses `engine_snapshot_id` and `viz_data`. Two different names for the same
fields. A developer writing the LNV POST route would encounter both with no
indication they reference the same thing.
Fix: LNV SCHEMA.md updated to use `engine_snapshot_id` and `viz_data`.
Committed: d995957.

**Flag 2 — ENGINE COMPUTATION SCHEMA.md stale flag type imprecision (FIXED)**
Stale flag described as "One boolean per engine" — SQLite has no native boolean
type; the correct type is integer (0|1) as specified in OPERATIONAL DB SCHEMA.md.
Fix: ENGINE COMPUTATION SCHEMA.md updated to read "One row per engine in SQLite
operational DB. stale stored as integer (0|1) — SQLite has no native boolean type."
Committed: d995957.

---

## Conclusion

Sections 3.6 and 3.7 are structurally sound. All specs present in all files that
require them. Two naming/precision issues found and corrected. No blocking gaps
remain. Both sections confirmed locked.
