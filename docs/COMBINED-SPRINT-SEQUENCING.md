# Combined Execution Sequencing — S262–S278

**Created:** 2026-08-26. Combines `docs/AI-INTELLIGENCE-AUDIT-ROADMAP.md` (S262–S273) and `docs/SOUTHERN-AFRICA-HOSPITAL-READINESS-ROADMAP.md` (S274–S278) into one execution order. S279 (Multi-Scheme Medical Aid Framework) and S280 (POPIA Compliance Layer) are explicitly **dropped from active planning** — expansion-contingent, not scheduled, revisit only if/when South African market entry becomes a real plan.

Full finding detail and per-sprint scope live in the two source docs; this doc is the single source of truth for **what order to execute in and why**. Update the status column as sprints complete.

## Rationale

Phase 1 fixes active bugs producing wrong or missing output right now — that outranks new feature-building. Phase 2 (hospital-ops infrastructure) shares zero files with Phase 1, so it's a safe place to slot in parallel-safe, high-value new work rather than making everything wait behind all of Phase 3. Phase 3 depends contextually on Phase 1 being settled (e.g. S269's sweep touches the same services S264 just fixed — doing it first would mean re-touching those files twice). S278 goes last because it opens with a read-only verification step that could shrink the whole sprint to "already fine, no work needed" — no point front-loading it.

Within each phase, sprints are additionally ordered to respect **file overlap**: S262→S263 both touch `services/cdss-service/main.py`; S264→S265 both touch the PostVisit escalation services. Sequencing these back-to-back avoids merge friction. Everything else in a phase is file-independent and could, in principle, be parallelized across engineers/agents — the numbers below are execution order for a single working thread, not a hard dependency chain, except where explicitly noted.

## Sequencing

| Order | Sprint | Title | Source doc | Depends on | Status |
|---|---|---|---|---|---|
| **Phase 1 — Critical AI/safety fixes** | | | | | |
| 1 | S262 | CDSS safety governor universal enforcement | AI-INTELLIGENCE | — | **Done (2026-08-26)** |
| 2 | S263 | Real LLM SOAP note generation | AI-INTELLIGENCE | S262 (same file) | **Done (2026-08-26)** |
| 3 | S264 | PostVisit escalation delivery reliability | AI-INTELLIGENCE | — | **Done (2026-08-27)** |
| 4 | S265 | PostVisit escalation schema consolidation | AI-INTELLIGENCE | S264 (same files) | Not started |
| 5 | S266 | PostVisit ingestion cron hardening | AI-INTELLIGENCE | — | Not started |
| 6 | S267 | AI surface contract audit wiring | AI-INTELLIGENCE | — | Not started |
| **Phase 2 — Hospital-ops infrastructure** | | | | | |
| 7 | S274 | Patient safety incident reporting & RCA | SOUTHERN-AFRICA | — | Not started |
| 8 | S275 | Clinical staff credentialing & privileging | SOUTHERN-AFRICA | — | Not started |
| 9 | S276 | Staff duty rostering | SOUTHERN-AFRICA | — | Not started |
| 10 | S277 | Biomedical equipment register | SOUTHERN-AFRICA | — | Not started |
| **Phase 3 — AI hardening** | | | | | |
| 11 | S268 | CDSS RAG & guidelines hardening | AI-INTELLIGENCE | Phase 1 settled | Not started |
| 12 | S269 | Backend silent-catch sweep — workflow/order pipelines | AI-INTELLIGENCE | Phase 1 settled | Not started |
| 13 | S270 | AI governance dashboard honesty | AI-INTELLIGENCE | S267 | Not started |
| 14 | S271 | Escalation classifier LLM wiring | AI-INTELLIGENCE | S264/S265 | Not started |
| 15 | S272 | Knowledge ingestion reliability | AI-INTELLIGENCE | — | Not started |
| 16 | S273 | Voice ID + remaining hygiene | AI-INTELLIGENCE | — | Not started |
| **Phase 4 — Verification-first** | | | | | |
| 17 | S278 | ICU predictive deterioration — verify, then close gap if real | SOUTHERN-AFRICA | — | Not started |

**Dropped / deferred (not in this sequence):** S279 (Multi-Scheme Medical Aid Framework), S280 (POPIA Compliance Layer) — see `docs/SOUTHERN-AFRICA-HOSPITAL-READINESS-ROADMAP.md` Part 2 for why.

## Execution discipline (carried over from both source roadmaps)

1. Any DB schema change goes through `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts` — never a raw migration file. Read `docs/PROVISIONING_GUIDE.md` first.
2. `services/tenant-service/src/generated/tenant-entity-alignment.statements.ts` is a live, executed provisioning bundle — regenerate it (`npm run generate:tenant-provisioning-alignment`, bump `BUNDLE_VERSION`), never `git checkout --` it to discard a diff.
3. Verify every fix against real callers, not just in isolation — confirm reachability before and after.
4. `tsc --noEmit` clean in **every** workspace touched, not just the one nominally targeted (the `version: 1` bug earlier in this engagement was missed exactly because of this).
5. Add or update a test for the specific failure mode being fixed, not just the happy path.
6. Update the Status column in this doc as each sprint completes.
