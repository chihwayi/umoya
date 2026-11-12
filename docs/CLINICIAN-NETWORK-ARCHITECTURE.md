# Clinician Network — Architecture & Sprint Plan (S285–S289)

**Created:** 2026-11-12. Triggered by an Avalon Health marketing email ("Have you tried the Clinician Network yet?") describing a cross-practice, specialty-organized peer-discussion feature for doctors. Evaluated as a genuine gap — Umoya has no cross-tenant doctor-to-doctor discussion surface today — and scoped into a full architecture rather than a quick bolt-on, because it is the first Umoya feature that deliberately crosses tenant boundaries.

## Method

1. Read Avalon's own description of the feature closely (panels = specialty-based private groups, anonymous-to-panel posting, join-by-link, printable "participation record, not CPD", leave-anytime, filtered-before-posting).
2. Checked Umoya's existing code for anything overlapping before designing new: `ProviderMessagingController` (`services/ehr-service/src/controllers/provider-messaging.controller.ts`) is 1:1 threaded messaging **within** a tenant — not a match, confirms this is a real gap, not a duplicate build.
3. Checked for reusable infrastructure before inventing new mechanisms — found four pieces of real, working infrastructure this design builds directly on top of (see "Already covered" below). This matters more than usual here because the single biggest risk in this feature is re-inventing PHI safety badly.

## Already covered — reusable infrastructure (do not rebuild)

| Need | Existing code | How it's reused |
|---|---|---|
| PHI redaction/detection | `services/cdss-service/privacy_guard.py` — `redact_text()`, `contains_phi()`, `assert_no_outbound_phi()`, `redact_value()`. Regex-based, catches emails/phones/IDs/MRNs/DOBs/explicit "name:" labels, plus a sensitive-key denylist for structured payloads. Already gated by `CDSS_PHI_REDACTION_ENABLED`/`CDSS_BLOCK_OUTBOUND_PHI` env vars already wired into `docker-compose.prod.yml`. | Ported (not re-implemented — same reasoning as porting Aurelia's WhatsApp code in S281) into a TypeScript equivalent inside `ehr-service`, since Clinician Network lives there (see below) and a free-text field needs synchronous, same-process redaction, not a network hop to Python for every keystroke/submit. |
| Semantic similarity / embeddings | `services/cdss-service/main.py` — `_get_embedding_model()` (SentenceTransformer) + pgvector cosine search: `1 - (c.embedding <=> %s::vector) > 0.6` (line ~13033). Already proven at production scale for CDSS guideline RAG. | Reused directly for duplicate-topic detection: same embedding model, same pgvector operator, new table instead of the guideline-chunks table. |
| Cross-tenant-identity anchor | `services/ehr-service/src/services/clinical-staff-credentialing.service.ts` (S275) — `clinical_staff_credentials` table already captures `license_number` + `license_body` per staff member, per tenant. | This is the exact "council registration number" Avalon's email asks for — reused as the canonical real-world doctor identity anchor instead of inventing a new credential-capture flow. |
| Non-tenant-scoped database + migration path | `services/tenant-service/src/scripts/repairMasterDatabase.ts` already applies `getProvisioningBundles()` bundles to the **master** database (not a tenant DB) — e.g. `sprint114_clinical_rag`. `TerminologyService`/`TerminologyImportService` already connect `ehr-service` to this same master DB in production (confirmed in live logs: `✅ Master database connected for Terminology Import`). | Clinician Network's schema lives in this same master DB, provisioned via a new bundle through the exact same mechanism — no new service, no new database, no new deployment unit. |

## Why this needs a real architecture doc, not a quick feature

Every other sprint this project has shipped recently (S281 WhatsApp, S282 command palette, S283 education content) stayed inside one tenant's isolated database. This is the first feature where content is **meant** to be seen by doctors across different clinics/tenants. That one property changes everything:

- It cannot live in a per-tenant database (the whole point is cross-tenant visibility).
- It cannot reuse per-tenant user accounts as the identity (a doctor's `users.id` in Smart Clinic's DB means nothing in Horizon Clinic's DB).
- PHI leakage risk is categorically different from every other feature: a bug in a per-tenant feature leaks data within one clinic's own staff; a bug here leaks a patient's details to doctors at a *different, unrelated clinic* — a much harder-to-contain and harder-to-notice failure mode.

Treating this as "add a few endpoints" would be the wrong level of care. The design below is built around containing that one risk first, and only then building the Reddit/Discord-like UX on top.

## Core architecture

### Where it lives (no new service, no new database)

- **Data**: new `clinician_network` schema in the existing **master database** (same Postgres instance `TerminologyService` already connects to — confirmed live in production). Provisioned via a new bundle (`clinician_network_platform`) added to `getProvisioningBundles()` in `database-provisioning.service.ts`, applied via the existing `repairMasterDatabase.ts` script (`MASTER_PROVISION_BUNDLES=...,clinician_network_platform`) — **not** the per-tenant golden-rule path, since this schema is intentionally not tenant-scoped. This is the one place in the whole project where "every tenant gets this bundle" does not apply; flag this distinction clearly in the bundle's own `description` field so a future reader doesn't assume it's per-tenant.
- **Backend**: new `ClinicianNetworkModule` inside `ehr-service` (reuses its existing master-DB `DataSource`, JWT auth guards, and request pipeline — no new deployment unit, no new Docker service, no new Caddy route).
- **Frontend**: new pages in `ehr-frontend` under `/ehr/:tenantSlug/clinician-network/*` (doctor-only route guard, same `JwtAuthGuard` pattern as everywhere else).

### Identity model: real doctor → pseudonymous network identity

```
tenant A's clinical_staff_credentials (license_body, license_number)  ─┐
tenant B's clinical_staff_credentials (license_body, license_number)  ─┼─► clinician_network.clinicians (master DB)
                                                                        │     id, license_body, license_number_hash,
                                                                        │     display_handle, created_at
                                                                        │
tenant A's clinician_network_identity_links (per-tenant DB, NOT master)┘
  tenant_id, user_id, clinician_id  ← only place the real↔pseudonym mapping exists
```

- `clinician_network.clinicians` (master DB) is keyed by `sha256(license_body || license_number)`, never the raw number. A doctor's first Clinician Network action, from *any* tenant, upserts this row — so a locum doctor working at two clinics still maps to exactly one network identity, matching Avalon's own single-identity model.
- `display_handle` is auto-generated (`"GPDoctor482"` style, matching Avalon's anonymity bar), never derived from the real name.
- The real-identity↔pseudonym link is stored **per-tenant** (`clinician_network_identity_links` table, added via the normal per-tenant golden-rule bundle — this one *is* tenant-scoped, deliberately, so resolving "who posted this" always requires access to the *specific originating tenant's* database, not just platform-level access). This mirrors the deliberate extra-friction Avalon describes ("the doctor who posts a case is not named to the panel").
- Verification: reuses the existing `clinical_staff_credentials` record if one exists for that user (most staff already have one from S275 credentialing); if not, prompts for license body + number once, same UX Avalon describes ("Avalon asks for it once"). No new government-registry API integration in v1 — flag license/number as `unverified` until a human (practice admin or Umoya staff) confirms it, rather than building a fake verification step against a registry Umoya doesn't have API access to.

### Panels (the "subreddit"/Discord-server layer)

`clinician_network.panels`: `id, name, specialty, description, visibility ('open'|'invite'), invite_token, created_by_clinician_id, created_at`.
`clinician_network.panel_memberships`: `panel_id, clinician_id, joined_at, left_at` (nullable `left_at` — "leave anytime, your old posts stay" is just a non-null `left_at` filter on panel *listing*, not a delete).

Six panels pre-seeded at provisioning time, matching Avalon's own starting taxonomy (a reasonable, already-validated starting split): General Practice, Internal Medicine, Paediatrics, Obstetrics & Gynaecology, General Surgery, Dermatology. New panels can be created by any verified clinician (`visibility: 'invite'` by default for anything beyond the six seeded specialties, to avoid an uncurated sprawl of near-duplicate panels on day one).

### Topics & replies (the Reddit/Discord layer) — this is the "avoid repetition" mechanism

`clinician_network.topics`: `id, panel_id, author_clinician_id (never returned to non-author/non-moderator API callers), title, body_redacted, structured_fields (jsonb), tags (text[]), embedding (vector), status ('open'|'resolved'|'flagged'), created_at`.
`clinician_network.replies`: `id, topic_id, parent_reply_id (nullable — nested/threaded, Discord-style, better suited to clinical back-and-forth than flat Reddit comments), author_clinician_id, body_redacted, created_at`.

**Duplicate-avoidance flow** (the specific thing asked for): before a draft topic is submitted, the backend embeds `title + body` using the same `_get_embedding_model()`/pgvector pattern CDSS already uses, and searches existing **open** topics in the *same panel* for cosine similarity. Above a tunable threshold (start at `0.80`, stricter than CDSS's `0.6` guideline-match threshold since false-positive cost here is just "please check this first," not a missed citation), the compose screen shows the top 3 matches *before* allowing submission — "This looks similar to: ..." — with one-click "reply there instead." The author can still proceed with a new topic if it's genuinely different. This is checked again server-side at submit time (not just client-side), so it can't be bypassed by skipping the UI step.

**Resolution marking**: the original author can mark their own topic `resolved` and pin which reply answered it — more useful for a clinical Q&A pattern than pure upvote-ranking, and read-first when the topic is later found via the duplicate-detection search (so a doctor hitting "this looks similar" sees the *answered* version preferentially).

### PHI safety pipeline (two layers, mandatory — not configurable off for this feature regardless of the general `CDSS_PHI_REDACTION_ENABLED` flag's value)

1. **Structured composer, not free narrative.** The "Create Topic" form captures age *band* ("30–39", never exact age or DOB), sex, presenting complaint, relevant history, and the actual question as separate structured fields — removing the two highest-risk free-text identifier vectors (exact dates, names) at the point of entry rather than relying only on after-the-fact redaction. This is a stronger design than regex-only redaction and is almost certainly close to what Avalon itself means by "details are filtered before anything is posted."
2. **Automated redaction + block on every free-text field**, using the ported `privacy_guard.ts` (TypeScript port of `privacy_guard.py`, same patterns/behavior, living in `ehr-service` since this needs to run synchronously in the same request as the post, not over a network call to `cdss-service` for every submission). Any field that still trips `containsPHI()` after structured-field extraction does **not** silently redact-and-post — it's returned to the author with the exact flagged span highlighted, for a fix-and-resubmit (self-service, not a silent moderation queue, which would be a confusing UX for something this routine).
3. Enforced in the **service layer**, not just the controller — `ClinicianNetworkService.createTopic()`/`createReply()` call the redaction guard directly, so there is no code path that writes to `clinician_network.topics`/`replies` without passing through it, including any future internal/admin tooling.

### Moderation & governance

- `clinician_network.reports`: any member can flag a topic/reply (abuse, suspected PHI leak, off-topic).
- A small, manually-assigned "network moderator" flag on `clinician_network.clinicians` (not a new RBAC tier — a handful of trusted senior clinicians/Umoya staff for v1, not an open elected/community-mod system).
- Resolving "who posted this" (for a genuine safety escalation) requires a moderator to go `clinician_network.topics.author_clinician_id` → that clinician's `identity_links` row → **the specific originating tenant's own database** — i.e., even a Clinician Network moderator cannot casually deanonymize a post without separately being granted access to that tenant's data, matching the deliberate extra-friction Avalon's email describes.

### Participation record

A doctor-facing page (`/ehr/:tenantSlug/clinician-network/my-participation`) listing all of *their own* topics/replies (resolvable because they know their own `clinician_id` from their own session), exportable as PDF, with explicit copy matching Avalon's own honest framing: **"Record of participation only — this is not an accredited CPD activity."** Copying that honesty rather than overclaiming CPD value is deliberate — it's both legally safer and consistent with how CDSS already positions itself (grounded and honest about limits) as a point of actual differentiation from competitors that overclaim.

## Part 2 — Sprint Plan (S285–S289)

Each row below is summarized here; **`docs/CLINICIAN-NETWORK-SPRINT-BRIEFS.md`** has the full, standalone, copy-pasteable implementation brief for each sprint — exact file paths, exact schema, exact existing code to copy patterns from — written so any sprint can be handed to another AI assistant with zero other context.

| Sprint | Title | What It Delivers | DB provisioning touch? |
|---|---|---|---|
| **S285** | Clinician Network — Platform Identity & Data Model | `clinician_network` schema in the master DB (`clinicians`, `panels`, `panel_memberships`, `topics`, `replies`, `reports`) via a new `clinician_network_platform` bundle applied through `repairMasterDatabase.ts` — explicitly documented as non-tenant-scoped, the one exception to the golden rule. Per-tenant `clinician_network_identity_links` table added via the normal golden-rule per-tenant bundle. Credential-reuse logic wired to existing `clinical_staff_credentials`. No UI yet — this sprint is foundation only, verified via direct DB/API calls. | Yes — one master-DB bundle (exception to golden rule, documented as such) + one normal per-tenant golden-rule bundle |
| **S286** | Clinician Network — PHI-Safe Case Composer & Duplicate Detection | Port `privacy_guard.py` to TypeScript in `ehr-service`. Structured case-composer DTO/validation (age band, sex, presenting complaint, history, question). Embedding + pgvector similarity search for duplicate-topic detection, server-side-enforced. Fix-and-resubmit flow for flagged content. This is the highest-risk sprint — the one that must be right before any real content exists. | No — reuses S285's schema |
| **S287** | Clinician Network — Panels, Topics & Threaded Discussion UI | Frontend: panel directory/browse, panel feed (sort by Recent/Most Discussed/Unresolved), topic thread view with nested replies, "mark resolved," create-topic flow wired to the S286 composer + duplicate-detection prompt, join-via-invite-link flow for non-open panels. | No |
| **S288** | Clinician Network — Moderation, Reporting & Participation Record | Report queue for moderators, moderator-only de-anonymization flow (requires originating-tenant access, per the architecture above), participation-record page + PDF export with the honest "not CPD-accredited" disclaimer. | No |
| **S289** *(stretch — only if S285–288 show real doctor adoption)* | Clinician Network — Smart Suggestions | Auto-suggested tags/specialty via existing CDSS clinical-NLP patterns; "related panels" cross-suggestions; optionally surface a *relevant* open Clinician Network topic from within the CDSS command-palette clinical-search mode (S282) when a doctor's live query closely matches one — the single most genuinely differentiating integration available here, since Avalon's panels and Avalon's AI don't talk to each other, and Umoya's could. Don't build until the core product has real usage to justify it. | No |

## Definition of Done

Same discipline as every other roadmap in this folder: verify against real callers before claiming a fix, `tsc --noEmit` clean in every workspace touched, and the PHI pipeline (S286) gets manual adversarial testing — deliberately try to post a name/DOB/MRN/phone number before considering that sprint done, not just unit tests against the patterns already known to be caught. For S285 specifically: the master-DB bundle is a deliberate, documented exception to the per-tenant golden rule — don't let a future sprint quietly copy that exception pattern for something that *should* be tenant-scoped; this doc exists partly so that distinction stays visible. Don't build S289 speculatively — confirm real doctor adoption of S285–288 first.
