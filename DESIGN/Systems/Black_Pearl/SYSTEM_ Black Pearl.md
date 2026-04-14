SYSTEM_ Black Pearl
/DESIGN/Systems/Black_Pearl/SYSTEM_ Black Pearl.md

Black Pearl is Sage's personal pre-archive capture surface. A global
quick-capture panel accessible from any page via the page nav (left
side). Named for the field term for null space: the infinite
possibility of not yet.

Pearls are personal reflections, noticings, and developing thoughts —
not yet named or framed enough for the archive. They live in the
operational DB (SQLite) as pre-archive records until Sage promotes
them through INT into the full archive. Black Pearl is not a section
page. It has no section_id, no page_code, no entry in SECTION MAP.md.
It receives no deposits. It is Sage's alone until she acts on it.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT BLACK PEARL OWNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Pearl record in SQLite (pearls table — OPERATIONAL DB SCHEMA.md)
- Capture panel UI — slide-in from page nav, all pages, global
- Keyword search on Pearl content
- Archive action — Sage explicitly dismisses a Pearl (status: archived,
  record preserved)
- Promote action — hands the Pearl to INT gateway. Black Pearl's
  responsibility ends at the handoff. INT owns everything after.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT BLACK PEARL DOES NOT OWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Tagging — INT owns all tagging. No tags assigned at Pearl capture.
- Deposit record — INT assigns doc_type, tags, routing, composite ID,
  pearl_captured_at. Black Pearl does not write to PostgreSQL.
- Routing — INT decides which page(s) the promoted deposit reaches.
- Composite ID — stamp constructed by INT at promotion.
- Any section page or archive surface. Black Pearl is not a page.
- Observatory or Tier 7 surface. No Black Pearl presence there.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTEGRATION POINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SQLite (operational DB)
  Pearls live here as pre-archive records. Managed entirely by Black
  Pearl. Never written to PostgreSQL directly.

INT gateway (promotion only)
  When Sage promotes a Pearl, Black Pearl calls the INT deposit
  creation endpoint with provenance.source: black_pearl_promoted.
  The Pearl's created_at becomes pearl_captured_at on the deposit
  record. After handoff, INT owns the record. Black Pearl marks the
  Pearl: status → promoted, promoted_deposit_id → deposit ID.
  Full mechanics: INTEGRATION SCHEMA.md BLACK PEARL PROMOTION FLOW.

SYSTEM_ Frontend.md
  BlackPearlPanel component and pearls store defined there.
  Panel behavior, store shape, and failure modes are Frontend's spec.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHEMA AUTHORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BLACK PEARL SCHEMA.md — canonical Pearl record and full endpoint set.
OPERATIONAL DB SCHEMA.md — pearls table with SQLite constraints.
INTEGRATION SCHEMA.md — promotion mechanics, pearl_captured_at
  population, INT gateway handoff.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

backend/routes/pearls.py
  FastAPI route handlers — list/search, create, archive, promote.
  Status: PLANNED

backend/models/pearls.py
  SQLAlchemy model — pearls table (SQLite). Pearl record with full
  field shape and status enum.
  Status: PLANNED

frontend/src/lib/components/BlackPearlPanel.svelte
  Slide-in panel — label input, expanding text area, Pearl list with
  keyword search, promote and archive actions per Pearl card.
  Status: PLANNED

frontend/src/lib/stores/pearls.ts
  Pearls store — recent Pearls cache, last 5 active Pearls,
  searchable by content keyword.
  Status: PLANNED
