## Task
Full audit of all files referencing Black Pearl or the pearls table.
Goal: identify gaps (missing files, missing fields, missing entries),
conflicts (files that disagree), and stale content.
Triggered by Sage's question about whether Black Pearl needs a schema
page, a manifest, and a domain entry.

## Files examined

- DESIGN/Systems/Operational_DB/OPERATIONAL DB SCHEMA.md
- DESIGN/Systems/Integration/INTEGRATION SCHEMA.md
- DESIGN/Systems/Frontend/SYSTEM_ Frontend.md
- DESIGN/Systems/SECTION MAP.md
- .claude/plans/design-build-spec.md (sections 2.1, 2.7)
- DESIGN/Domains/ — full directory listing (11 folders)
- DESIGN/Systems/ — full directory listing (34 entries)
- .claude/plans/design-session-plan.md (BLACK PEARL sections)

## Findings

### CONFLICTS

C1 — Pearl record: INTEGRATION SCHEMA.md stale after session 47 update
  OPERATIONAL DB SCHEMA.md (updated session 47) has:
    pearl_id, content, label (required), created_at, page_context,
    status, promoted_deposit_id, promoted_via
  INTEGRATION SCHEMA.md (line 1141–1147) lists:
    pearl_id, content, created_at, page_context, status,
    promoted_deposit_id, promoted_via
  Missing from INTEGRATION SCHEMA.md: label field.
  Severity: HIGH — two sources of truth disagree.

C2 — POST /pearls/ endpoint missing label in request body
  INTEGRATION SCHEMA.md line 1478–1480:
    POST /pearls/ — Receives: content, page_context.
  label is required at capture but absent from the endpoint contract.
  Severity: HIGH — endpoint will reject or silently drop a required field.

C3 — "Tier 2 (per-page capture)" and "Tier 7 (dashboard)" both wrong
  INTEGRATION SCHEMA.md line 1163:
    "UI surfaces: Tier 2 (per-page capture) and Tier 7 (dashboard)."
  Black Pearl is not per-page — it is global, page nav, all pages.
  Black Pearl has no Observatory/Tier 7 surface (confirmed session 47).
  "Dashboard" was renamed Observatory session 31 — moot since no
  Tier 7 surface exists for Black Pearl.
  Severity: MEDIUM — misleading description, stale reference.

### GAPS

G1 — Missing GET /pearls/ endpoint
  POST /pearls/ (create) and POST /pearls/{id}/promote exist.
  No list or search endpoint defined. Keyword search on Pearl content
  (confirmed session 47) requires a GET with search param.
  Severity: HIGH — build cannot implement search without endpoint contract.

G2 — Missing archive Pearl endpoint
  Pearl lifecycle includes archived status (Sage explicitly dismisses).
  No PATCH or endpoint defined for archiving.
  Severity: HIGH — lifecycle state unreachable from API as written.

G3 — No SYSTEM_ Black Pearl.md
  DESIGN/Systems/ has no Black_Pearl folder.
  Per CLAUDE.md: every planned module gets both a SYSTEM_ overview doc
  and a full SCHEMA. Black Pearl has its own SQLite table, API endpoints,
  and frontend panel — qualifies as a module.
  Severity: MEDIUM — system ownership boundaries undocumented.

G4 — No BLACK PEARL SCHEMA.md
  Pearl specs split across three files:
    OPERATIONAL DB SCHEMA.md (pearls table)
    INTEGRATION SCHEMA.md (promotion flow, partial endpoints)
    SYSTEM_ Frontend.md (panel behavior, stores)
  No unified schema or complete endpoint set exists anywhere.
  Severity: MEDIUM — fragmented spec is a build hazard.

G5 — No domain folder or manifest for Black Pearl
  DESIGN/Domains/ has 11 folders (01_Integration through 11_Void).
  No Black Pearl folder. Sage identified this as missing.
  RESOLUTION (confirmed with Sage): Black Pearl is a system, not a
  section. Standard domain manifest does not apply. System docs
  (SYSTEM_ + SCHEMA files in DESIGN/Systems/Black_Pearl/) are the
  correct form. DESIGN/Domains/ and SECTION MAP.md: no change needed.
  Severity: RESOLVED by design decision.

### CLEAN

- SECTION MAP.md: Black Pearl correctly absent (not a section page).
- DESIGN/Systems/Frontend/SYSTEM_ Frontend.md: updated session 47.
- OPERATIONAL DB SCHEMA.md: updated session 47.
- design-build-spec.md sections 2.1 and 2.7: consistent with locked
  decisions (spec authority needs update once new files are created).

## Conclusion

2 HIGH conflicts fixed in INTEGRATION SCHEMA.md (C1, C2).
1 MEDIUM description corrected in INTEGRATION SCHEMA.md (C3).
2 HIGH gaps filled in INTEGRATION SCHEMA.md (G1, G2).
2 MEDIUM gaps resolved by creating SYSTEM_ Black Pearl.md and
  BLACK PEARL SCHEMA.md in DESIGN/Systems/Black_Pearl/.
1 gap (G5) resolved by design decision — system docs, not domain manifest.

Black Pearl fully documented after this session's corrections.
