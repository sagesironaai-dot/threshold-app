## Task

VOID standalone promotion: restructured VOID (page 51, VOI) from Nexus group 9
membership to standalone status across all files declaring group membership.
Fixed 6 bugs in entropy_scan.py (VOI and LQL missing from page codes, sections/
domains counts wrong at 50 instead of 51, VOI falsely flagged as phantom, stale
count detector messages referencing 50). Closed TRIA rot item (all expansions
confirmed correct). Added resolution note to ROT_REGISTRY.md.

## Files examined

**Modified (9 files):**
- DESIGN/Systems/SECTION MAP.md — lines 11, 66
- DESIGN/Domains/11_Void/Manifest_51_Void.txt — line 1 (moved from 10_Nexus/)
- DESIGN/Domains/11_Void/Domain_Void.txt — line 2 (moved from 10_Nexus/)
- DESIGN/Systems/Frontend/SYSTEM_ Frontend.md — lines 240, 241
- .claude/plans/design-session-plan.md — lines 1332-1338, 1402, 1404, 6271
- api/prompts/_Global_Identity.txt — line 20
- api/prompts/GLOBAL_KNOWLEDGE_BASE.txt — lines 120, 142-144
- hooks/entropy_scan.py — lines 78, 107, 108, 212-213 (removed), 288-291, 602, 613
- ROT_REGISTRY.md — line 906 (resolution note)
- ROT_OPEN.md — TRIA entry removed

**Verified unchanged (functional Nexus references, not group membership):**
- DESIGN/Systems/Void_Engine/VOID ENGINE SCHEMA.md — lines 46, 226 ("Nexus outputs", "Nexus-level")
- DESIGN/Systems/Void_Engine/SYSTEM_ Void.md — lines 15, 40 ("Nexus outputs")
- DESIGN/Systems/Daily_Nexus_Routine/DAILY NEXUS ROUTINE SCHEMA.md — line 23 (pulse check)
- DESIGN/Systems/Frontend/SYSTEM_ Frontend.md — lines 251, 296 (engine stale dot, compact card)
- .claude/plans/design-session-plan.md — lines 1469, 1487, 1507 (UI layout specs)

**Folder structure verified:**
- DESIGN/Domains/11_Void/ — 2 files (Domain_Void.txt, Manifest_51_Void.txt)
- DESIGN/Domains/10_Nexus/ — 10 files (5 Domain + 5 Manifest for WSC/LNV/DTX/SGR/PCV)

## Findings

**Group membership grep (VOI + Nexus in same line):**
- 2 results, both expected:
  - SYSTEM_ Integration DB.md:160 — functional ("Nexus state timestamp"), not group claim
  - design-session-plan.md:2056 — historical strikethrough resolved question

**Nexus member list grep (WSC...PCV...VOI sequence):**
- 2 results, both expected:
  - entropy_scan.py:78 — canonical page codes set (all 51 codes), not a group listing
  - SESSION_LOG.md:8067 — historical session entry

**Standalone grep:** SECTION MAP lines 16 (INT) and 66 (VOI) both show standalone.
API prompts reference both Integration and Void as standalone.

**entropy_scan.py validation:** Full scan ran. Zero VOI phantom findings. Zero
"50 sections/domains" false positives. 386 total findings (pre-existing baseline,
all domain file contamination markers from prior sessions).

**CANONICAL_PAGE_CODES count:** 51 (verified programmatically).

**Discovery during scan:** LQL (Liquid Lattice, page 42) was also missing from
CANONICAL_PAGE_CODES. Pre-existing bug, not related to VOID promotion. Fixed
alongside VOI addition.

**Flagged for Sage:** Domain_Void.txt line 9 says "Each Nexus system has its own
record type and provenance chain." Functionally true regardless of group. Left
unchanged per plan — Sage's call if it needs rewording.

## Conclusion

VOID standalone promotion complete across all 9 target files. All group membership
claims updated. All functional Nexus references preserved. entropy_scan.py bugs
fixed (6 total including LQL discovery). TRIA rot closed (zero open rot items).
Folder structure reorganized (11_Void created). No downstream impact — core files
phase not started, no code reads group membership. Scanner validation passed.
