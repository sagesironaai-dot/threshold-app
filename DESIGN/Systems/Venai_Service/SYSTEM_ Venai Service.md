# SYSTEM: Ven'ai Service

## /DESIGN/Systems/Venai_Service/

### Name registry · cross-archive correlation · two synchronous jobs on deposit

---

## WHAT THIS SYSTEM OWNS

* Ven'ai name registry — canonical forms, root clusters, first-seen
  metadata. venai_names table (PostgreSQL). Each name registered once
  as found — canonical form set at first registration, never altered
  by the service
* Cross-archive correlation tracking — per (name, correlation_type,
  correlated_value) triple: deposit_count, weighted_count (using shared
  deposit_weight constants), first_observed, last_observed. Correlation
  types: phase, role, root_pattern, grammar
* Two PostgreSQL tables: venai_names, venai_correlations
* Two synchronous jobs executed on deposit creation:
  - Job 1 — Name Registry: extract names, check against existing,
    register new with first_seen metadata
  - Job 2 — Cross-Archive Correlation: identify names in deposit,
    extract phase_state/tags, increment or create correlation records
    with deposit_weight applied
* Ven'ai content relevance check — decides whether a deposit warrants
  Ven'ai processing. Not every deposit contains Ven'ai names
* Integration flow — called synchronously in deposit creation pipeline.
  Service failure does not roll back deposit (deposit is data)

## WHAT THIS SYSTEM DOES NOT OWN

* STR engine computation — STR is a consumer. STR reads venai_names
  (root clusters) and venai_correlations (phase/role analysis).
  STR never writes to Ven'ai tables
* Ven'ai source file content — language definitions, glossary,
  phonetics, and manual live in api/domains/venai/ as versioned
  reference. The service does not define them
* Name variation flagging to Sage — AI function on VEN (14), not a
  service function. The service registers what it sees; it does not
  analyze or flag correctness
* Database table definitions — owned by INTEGRATION DB SCHEMA.md.
  This service writes to its 2 tables; Integration DB owns the schema
* Deposit creation — INT is the gateway. Ven'ai Service is called
  during the deposit pipeline; it does not own the pipeline
* Tag vocabulary — owned by TAG VOCABULARY.md
* Entry data — owned by INTEGRATION DB SCHEMA.md

---

## PIPELINE

```
Deposit creation pipeline calls Ven'ai Service (synchronous)
  → Content relevance check (does this deposit contain Ven'ai names?)
  → If no: return early, no processing
  → If yes:
      Job 1: Name Registry — register new names, skip known
      Job 2: Cross-Archive Correlation — update correlation records
  → Return (service failure does not roll back deposit)
```

Archive-wide scope — not page-scoped. Any deposit on any page can
contain Ven'ai names. The service processes all of them.

---

## NEXUS FEED

**StarRoot Engine (STR · Page 03)**
STR reads venai_names for root cluster map and name index, venai_correlations
for phase/role analysis. STR feed includes venai_state_summary (total_names,
active_clusters).

---

## FILES

| File | Role | Status |
| --- | --- | --- |
| DESIGN/Systems/Venai_Service/VENAI SERVICE SCHEMA.md | Full mechanical spec — two jobs, table definitions, correlation computation, STR consumer interface, failure modes | COMPLETE |
| backend/services/venai.py | Name registry (Job 1), correlation tracking (Job 2) | PLANNED |
| backend/routes/venai.py | GET name index, GET correlations | PLANNED |
