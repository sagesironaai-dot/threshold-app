BLACK PEARL SCHEMA
/DESIGN/Systems/Black_Pearl/BLACK PEARL SCHEMA.md

Canonical Pearl record and full API endpoint set for the Black Pearl
system. Promotion mechanics (INT gateway handoff, pearl_captured_at
population) live in INTEGRATION SCHEMA.md BLACK PEARL PROMOTION FLOW.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PEARL RECORD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Authoritative field list. SQLite constraints in OPERATIONAL DB SCHEMA.md.

  pearl_id             — text, primary key
                         Format: 'prl_[timestamp]_[rand]'

  label                — text, not null
                         Journal entry title. Required at capture.
                         Sage-entered. Not AI-assigned. Not a tag.

  content              — text, not null
                         The reflection or noticing. Could be a few
                         words or several sentences. Pre-archive signal.

  created_at           — text (ISO timestamp), not null
                         When Sage captured the Pearl. Becomes
                         pearl_captured_at on the deposit record at
                         promotion. The gap between Pearl creation
                         and deposit creation is itself data.

  page_context         — text, nullable
                         Which page Sage was on when captured.
                         Informational only — does not constrain
                         routing at promotion.

  status               — text, not null
                         enum: 'active' | 'promoted' | 'archived'
                         active:   Pearl exists, not yet acted on.
                                   Stays indefinitely. No auto-expiry.
                         promoted: Pearl sent through INT gateway.
                                   Full deposit fields assigned.
                                   Entered PostgreSQL as archive entry.
                         archived: Explicitly dismissed by Sage.
                                   Record preserved, not deleted.

  promoted_deposit_id  — text, nullable
                         References the deposit ID created at promotion.
                         Null until promotion. Links Pearl to its
                         archive entry.

  promoted_via         — text, nullable
                         enum: 'panel' | null
                         Where promotion was triggered. Null until
                         promotion.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIFECYCLE STATE MACHINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  active ──→ promoted    Sage promotes a Pearl from the panel.
                          INT gateway called. Deposit created in
                          PostgreSQL. Pearl updated: status →
                          promoted, promoted_deposit_id → deposit ID,
                          promoted_via → 'panel'.

  active ──→ archived    Sage explicitly dismisses a Pearl.
                          Pearl updated: status → archived.
                          Record preserved in SQLite. Not deleted.

  promoted  ─╴           Terminal. No further transitions.
  archived  ─╴           Terminal. No further transitions.

Transitions not permitted:
  archived → promoted    An archived Pearl cannot be promoted.
  promoted → archived    A promoted Pearl has a deposit record in
                          PostgreSQL. Cannot be archived after the fact.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API ENDPOINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GET /pearls/
  List or search Pearls.

  Query params:
    q       — keyword search on content text (optional)
    status  — filter by status (optional, default: active)

  Response:
    {
      pearls: [
        {
          pearl_id:           string
          label:              string
          content:            string
          created_at:         string (ISO timestamp)
          page_context:       string | null
          status:             "active" | "promoted" | "archived"
          promoted_deposit_id: string | null
        }
      ]
    }

---

POST /pearls/
  Create a Pearl.

  Request:
    {
      label:        string (required)
      content:      string (required)
      page_context: string | null (optional)
    }

  Response:
    {
      pearl_id:   string
      created_at: string (ISO timestamp)
    }

---

PATCH /pearls/{pearl_id}/archive
  Archive a Pearl. Sage explicitly dismisses it.
  No request body.

  Response:
    {
      pearl_id: string
      status:   "archived"
    }

---

POST /pearls/{pearl_id}/promote
  Promote a Pearl to a deposit through INT gateway.
  No request body. Full mechanics in INTEGRATION SCHEMA.md.

  Response:
    {
      deposit_id: string
      stamp:      string
    }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR CASES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pearl not found
  Any operation on a pearl_id that does not exist.
  Return: 404.

Pearl already promoted
  PATCH /archive or POST /promote called on status: promoted.
  Return: 409. Pearl already promoted — no further transitions.

Pearl already archived
  POST /promote called on status: archived.
  Return: 409. Pearl archived — cannot promote a dismissed Pearl.

  PATCH /archive called on status: archived.
  Return: 409. Pearl already archived.
