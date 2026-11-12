# Clinician Network — Delegable Sprint Briefs (S285–S289)

Companion to `docs/CLINICIAN-NETWORK-ARCHITECTURE.md` (read that first for the "why"). This document is five **standalone, implementation-ready briefs** — one per sprint. Each section below is self-contained: copy *only that section* to hand a sprint to another AI assistant/agent with zero other context required. Every brief states repo location, exact existing code to copy patterns from (with file paths and line references valid as of 2026-11-12), and a concrete Definition of Done.

General rules that apply to every sprint below (restate these to whichever assistant implements them):
- Repo: `/Users/devoop/Dev/personal/umoya` (monorepo, npm workspaces). Run `tsc --noEmit` in every workspace you touch before declaring a sprint done — don't just claim it compiles.
- Never add `Co-Authored-By: Claude` or any AI co-author line to commit messages.
- Follow the **golden rule** for any per-tenant schema change: add it as a new bundle entry inside `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts` — never a one-off migration script. S285 has one deliberate, explicitly-documented exception (a master-DB-only bundle) — do not use that as a precedent for anything that should actually be tenant-scoped.
- PHI/patient-identifying data must never be written into the `clinician_network` schema outside the pipeline S286 builds. If a later sprint needs a new free-text field in that schema, it must pass through the same redaction guard — no exceptions, no "just this once."

---

## SPRINT S285 — Platform Identity & Data Model (foundation, no UI)

### What this sprint is and isn't
This sprint lays the data foundation for "Clinician Network" — a cross-practice (cross-tenant) doctor discussion feature, inspired by a competitor's "Clinician Network" feature description (private specialty panels, anonymous-to-panel posting, join-by-link). **This sprint delivers no user-facing UI** — it is schema + identity-resolution logic only, verified via direct service calls / a test script, not a browser. Sprints S286–S289 build on top of this.

### The one fact that shapes this entire sprint
Umoya's architecture isolates every tenant (clinic)'s clinical data in its own Postgres database. This feature is the first one that needs doctors from *different* tenants to see each other's (de-identified) posts. That means:
- It cannot live in a per-tenant database.
- A tenant's `users.id` (UUID) means nothing outside that tenant's own database — there is no existing cross-tenant user identity.
- There IS an existing **master** (shared, non-tenant-scoped) Postgres database already in production use — `services/ehr-service/src/services/terminology.service.ts` already connects to it for SNOMED CT data, and `services/tenant-service/src/scripts/repairMasterDatabase.ts` already applies schema bundles to it using the exact same bundle mechanism used for every tenant. Confirm this for yourself by reading both files before starting.

### Task 1 — Master-DB schema bundle

Open `services/tenant-service/src/services/database-provisioning.service.ts`. Find the `getProvisioningBundles()` method (search for `private getProvisioningBundles(): ProvisioningBundle[]`) and its returned array. Study the shape of an existing bundle entry, e.g. search for `id: 'clinical_staff_credentialing'` to see the `{ id, label, version, description, statements: () => [...] }` shape used throughout this file (there are 300+ examples in this one file — pick any recent one, e.g. search for `id: 'workflow_wait_durability'`).

Add a **new bundle** to that same array with:
```ts
{
  id: 'clinician_network_platform',
  label: 'Clinician Network — Cross-Tenant Platform Schema',
  version: '2026.11.12.1',
  description:
    'NON-TENANT-SCOPED EXCEPTION to the golden rule: this bundle is applied ONCE to the shared ' +
    'master database (via repairMasterDatabase.ts with MASTER_PROVISION_BUNDLES=clinician_network_platform), ' +
    'never to a tenant database. It backs the cross-tenant doctor discussion feature — see ' +
    'docs/CLINICIAN-NETWORK-ARCHITECTURE.md. Do not copy this pattern for anything that should ' +
    'actually be tenant-scoped.',
  statements: () => [
    `CREATE SCHEMA IF NOT EXISTS clinician_network`,

    `CREATE TABLE IF NOT EXISTS clinician_network.clinicians (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      license_body TEXT NOT NULL,
      license_number_hash TEXT NOT NULL,
      display_handle TEXT NOT NULL UNIQUE,
      is_moderator BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (license_body, license_number_hash)
    )`,

    `CREATE TABLE IF NOT EXISTS clinician_network.panels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'invite' CHECK (visibility IN ('open', 'invite')),
      invite_token TEXT UNIQUE,
      created_by_clinician_id UUID REFERENCES clinician_network.clinicians(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS clinician_network.panel_memberships (
      panel_id UUID NOT NULL REFERENCES clinician_network.panels(id) ON DELETE CASCADE,
      clinician_id UUID NOT NULL REFERENCES clinician_network.clinicians(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      left_at TIMESTAMPTZ,
      PRIMARY KEY (panel_id, clinician_id)
    )`,

    `CREATE EXTENSION IF NOT EXISTS vector`,

    `CREATE TABLE IF NOT EXISTS clinician_network.topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      panel_id UUID NOT NULL REFERENCES clinician_network.panels(id) ON DELETE CASCADE,
      author_clinician_id UUID NOT NULL REFERENCES clinician_network.clinicians(id),
      title TEXT NOT NULL,
      body_redacted TEXT NOT NULL,
      structured_fields JSONB NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      embedding vector(384),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'flagged')),
      resolved_reply_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cn_topics_panel ON clinician_network.topics(panel_id, created_at DESC)`,

    `CREATE TABLE IF NOT EXISTS clinician_network.replies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_id UUID NOT NULL REFERENCES clinician_network.topics(id) ON DELETE CASCADE,
      parent_reply_id UUID REFERENCES clinician_network.replies(id) ON DELETE CASCADE,
      author_clinician_id UUID NOT NULL REFERENCES clinician_network.clinicians(id),
      body_redacted TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cn_replies_topic ON clinician_network.replies(topic_id, created_at ASC)`,

    `CREATE TABLE IF NOT EXISTS clinician_network.reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_id UUID REFERENCES clinician_network.topics(id) ON DELETE CASCADE,
      reply_id UUID REFERENCES clinician_network.replies(id) ON DELETE CASCADE,
      reported_by_clinician_id UUID NOT NULL REFERENCES clinician_network.clinicians(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  ],
}
```
Add `resolved_reply_id` as a plain column (no FK — `replies` isn't created yet at that point in the array if you place topics before replies; either reorder the `ALTER TABLE ... ADD CONSTRAINT` into a second statement after `replies` is created, or simply leave it as an unconstrained UUID column, which is fine and simpler — do the latter).

**Apply it**: this bundle must be applied to the **master** database, not any tenant database. The command is:
```
MASTER_PROVISION_BUNDLES=clinician_network_platform npx ts-node --project services/tenant-service/tsconfig.json services/tenant-service/src/scripts/repairMasterDatabase.ts
```
(`DATABASE_URL` env var must point at the master DB connection string — check `.env` for how other master-DB scripts are invoked in this repo, e.g. `npm run provision:master-db`, for the exact existing convention.)

### Task 2 — Per-tenant identity-link bundle (normal golden rule, no exception)

Add a **second**, separate bundle to the same array — this one IS a normal per-tenant bundle (applies to every tenant via the usual tenant-provisioning path, no special invocation needed):
```ts
{
  id: 'clinician_network_identity_links',
  label: 'Clinician Network — Per-Tenant Identity Link',
  version: '2026.11.12.1',
  description:
    'Maps this tenant\'s own user_id to a clinician_network.clinicians.id in the master DB. ' +
    'Deliberately stored per-tenant (not in the master DB) so that resolving a pseudonymous ' +
    'Clinician Network post back to a real staff member always requires access to this specific ' +
    'tenant\'s own database — see docs/CLINICIAN-NETWORK-ARCHITECTURE.md.',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS clinician_network_identity_links (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      clinician_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cnil_clinician ON clinician_network_identity_links(clinician_id)`,
  ],
}
```
This one gets applied automatically to every tenant the normal way (confirm by checking how any other recent per-tenant bundle, e.g. `whatsapp_engagement`, gets picked up — no special script needed, it's the default per-tenant provisioning path).

### Task 3 — ehr-service: master-DB connection for Clinician Network

Create `services/ehr-service/src/clinician-network/clinician-network-master-db.service.ts`. Copy the connection pattern from `services/ehr-service/src/services/terminology.service.ts`'s `initializeMasterDb()`/`getMasterDb()` private methods (read that file's lines ~95–148 first) — same `getMasterDbConfig()` helper from `../services/../utils/runtime-env` (actual import path: `import { getMasterDbConfig } from '../utils/runtime-env';`), same `DataSource` lazy-init-with-retry pattern. Your new service's entities (TypeORM) should map to the `clinician_network.*` tables (note the Postgres schema prefix — set each `@Entity({ schema: 'clinician_network', name: 'clinicians' })` etc., or query via raw SQL like `TerminologyService` does if you prefer raw `DataSource.query()` — raw SQL is simpler here given there's no existing TypeORM-entity convention for this schema; recommend raw SQL via `masterDb.query(...)` to match `TerminologyPostgresService`'s own style, don't introduce a new ORM pattern just for this feature.

### Task 4 — Identity resolution + credential reuse

Create `services/ehr-service/src/clinician-network/clinician-identity.service.ts` with one core method:

```ts
async resolveOrCreateClinicianIdentity(tenantDb: DataSource, userId: string): Promise<{ clinicianId: string; isNew: boolean }>
```

Logic:
1. Check `clinician_network_identity_links` (tenant DB) for an existing row for this `user_id`. If found, return its `clinician_id`.
2. If not found, look up `clinical_staff_credentials` (tenant DB) for this `user_id` — exact columns are `license_number`, `license_body` (confirmed in `database-provisioning.service.ts`, search for `id: 'clinical_staff_credentialing'`). If no credential record exists, throw a clear error telling the caller the user must add license info first (don't silently invent a fake identity).
3. Compute `license_number_hash = sha256(license_body + '|' + license_number)` (normalize case/whitespace first).
4. Upsert into `clinician_network.clinicians` (master DB) on `(license_body, license_number_hash)` — if a row already exists (e.g., a locum who already joined from another tenant), reuse its `id`; otherwise insert a new row with a generated `display_handle` (e.g. `{specialty-agnostic-adjective}{SpecialtyAbbrev}Doctor{random 3-digit}` — keep it simple, uniqueness enforced by the `UNIQUE` constraint on `display_handle`, retry with a new random suffix on conflict).
5. Insert the link row into `clinician_network_identity_links` (tenant DB).
6. Return the `clinician_id`.

### Definition of Done
- Both bundles added, `tsc --noEmit` clean in `services/tenant-service`.
- Master-DB bundle successfully applied to a real local/staging master DB via the command above — verify with `\dt clinician_network.*` in psql.
- Per-tenant bundle verified applied to at least one tenant DB (e.g. `smart` or `horizon` test tenant) via the normal provisioning path.
- `resolveOrCreateClinicianIdentity` manually tested: call it twice for the same user → same `clinicianId` both times, `isNew: true` then `isNew: false`. Call it for a user with no `clinical_staff_credentials` row → clear error, not a silent fake identity.
- No UI, no controller endpoints yet — those start in S287. This sprint is backend-only and should be reviewable purely by reading the new files + running the manual test above.

---

## SPRINT S286 — PHI-Safe Case Composer & Duplicate Detection

**Depends on S285** (needs `clinician_network.topics` table and the master-DB connection service to exist).

### Why this is the highest-risk sprint
Every other Umoya feature keeps data inside one tenant's isolated database. This is the first one where a bug lets a patient's details leak to doctors at an *unrelated clinic*. Treat this sprint with the same seriousness as the production-incident debugging already documented elsewhere in this repo's history — manual adversarial testing is required before this is considered done, not just passing unit tests.

### Task 1 — Port the PHI redaction guard to TypeScript

Read `services/cdss-service/privacy_guard.py` in full (it's ~110 lines). Create `services/ehr-service/src/clinician-network/privacy-guard.ts` as a direct, behavior-equivalent TypeScript port:
- `isPHIRedactionEnabled()`, `redactText(text: string): string`, `containsPHI(text: string): boolean` — same regex patterns, translated to JS `RegExp` (note: Python's `\b` word-boundary and named groups translate directly to JS regex; the one pattern needing care is the 8–20 char alnum ID pattern — same regex, just written as a JS literal).
- Port **all** patterns from `_PATTERNS` in the Python file (emails, phones, SSN-style, national/passport IDs, MRN labels, DOB labels, explicit name labels) — do not drop any, and do not silently "improve" them without flagging the change, since they're a known, already-tuned baseline.
- This TS version does **not** need the `redact_value()` dict-walker from the Python version (Clinician Network's free-text fields are flat strings, not nested payloads) — keep the port scoped to what's actually used.

### Task 2 — Structured composer DTO (the first, stronger safety layer)

Define (e.g. in `services/ehr-service/src/clinician-network/dto/create-topic.dto.ts`):
```ts
export class CreateTopicDto {
  panelId: string;
  title: string;            // free text, goes through containsPHI() check
  ageBand: string;           // e.g. "30-39" — enum-validated, NOT a free date field
  sex: 'male' | 'female' | 'other';
  presentingComplaint: string;  // free text, goes through containsPHI() check
  relevantHistory: string;      // free text, goes through containsPHI() check
  question: string;             // free text, goes through containsPHI() check
  tags: string[];
}
```
No field for exact age, DOB, or name anywhere in this DTO — that is deliberate, not an oversight; don't add one later without re-reading `docs/CLINICIAN-NETWORK-ARCHITECTURE.md` first.

### Task 3 — cdss-service: new internal embedding endpoint

The duplicate-detection feature needs text embeddings, but the embedding model (`sentence-transformers/all-MiniLM-L6-v2`, 384 dimensions) only runs in Python inside `cdss-service` (see `_get_embedding_model()` in `services/cdss-service/main.py`, search for that function name) — `ehr-service` (Node/TypeScript) cannot run it in-process. Add a new endpoint to `services/cdss-service/main.py`:

```python
class EmbedRequest(BaseModel):
    text: str

@app.post("/internal/embed")
async def embed_text(request: EmbedRequest):
    model = _get_embedding_model()
    if model is None:
        raise HTTPException(status_code=503, detail="Embedding model unavailable")
    vector = model.encode([request.text])[0].tolist()
    return {"embedding": vector, "dimensions": len(vector)}
```
Place it near the other `@app.post(...)` routes (e.g. right after `/guidelines/search`, search for `@app.post("/guidelines/search")`). It's automatically covered by the existing global `service_to_service_auth_middleware` (search for that name in `main.py`) — you do not need to add any new auth code, just don't register it as a public/exempt path.

### Task 4 — ehr-service: call the embedding endpoint

`services/ehr-service/src/services/cdss.service.ts` already has a full, production-proven HTTP client with retries/circuit-breaker/dual auth (`postWithPolicy<T>(label, path, body, timeoutMs, tenantId)` — search for `searchGuidelines` in that file to see the exact calling convention to copy). Add one new method to that same class:
```ts
async getEmbedding(text: string): Promise<number[]> {
  const result = await this.postWithPolicy<{ embedding: number[] }>(
    'clinician_network_embed',
    '/internal/embed',
    { text },
    10000,
  );
  return result.embedding;
}
```
Inject the existing `CdssService` into your new Clinician Network service rather than building a second HTTP client.

### Task 5 — Duplicate-detection + topic creation flow

Create `services/ehr-service/src/clinician-network/clinician-network.service.ts` with:
```ts
async findSimilarTopics(panelId: string, title: string, body: string): Promise<Array<{ id: string; title: string; similarity: number }>>
```
Embed `title + ' ' + body` via `CdssService.getEmbedding()`, then run against the master DB:
```sql
SELECT id, title, 1 - (embedding <=> $1::vector) AS similarity
FROM clinician_network.topics
WHERE panel_id = $2 AND status = 'open'
ORDER BY embedding <=> $1::vector
LIMIT 3
```
(This mirrors the exact operator and pattern already used in `services/cdss-service/main.py` around line ~13033 — same `<=>` cosine-distance operator, same `1 - distance` similarity convention — don't invent a different convention.) Filter results to `similarity > 0.80` before returning (stricter than CDSS's own `0.6` guideline-match threshold, since the cost of a false positive here is just "please check this first," while the cost of a false negative is a literal duplicate thread).

```ts
async createTopic(tenantDb: DataSource, userId: string, dto: CreateTopicDto): Promise<Topic>
```
1. Resolve `clinicianId` via `ClinicianIdentityService.resolveOrCreateClinicianIdentity()` (from S285).
2. For each free-text field (`title`, `presentingComplaint`, `relevantHistory`, `question`): run `containsPHI()`. If any field trips it, throw a `BadRequestException` whose payload identifies *which field* and includes the matched span (so the frontend in S287 can highlight exactly what to fix) — do **not** silently redact-and-post.
3. If all fields pass, build `body_redacted` by concatenating the structured fields into one display string (still run `redactText()` over the final concatenation as a defense-in-depth second pass, even though individual fields already passed — cheap insurance against a field-boundary edge case).
4. Call `findSimilarTopics()`. If the caller hasn't already confirmed "post anyway" (add a `forcePost: boolean` param, default `false`), and similar topics exist above threshold, return them instead of creating the topic (the S287 frontend shows these and lets the user either jump to one or resubmit with `forcePost: true`).
5. Insert the topic row (master DB) including the computed `embedding`.

### Definition of Done
- `tsc --noEmit` clean in `services/ehr-service`.
- **Manual adversarial test, required, not optional**: attempt to post topics containing a real-looking name ("John Mukamuri"), a DOB ("12/03/1987"), a phone number, an MRN label ("Patient ID: ABC12345") — confirm every single one is rejected with a clear field-level error, not silently stripped and posted.
- Duplicate-detection manually verified: post one topic, then attempt a near-identical second topic in the same panel → confirm it surfaces as a similar match rather than creating a duplicate.
- No frontend yet (S287) — verify via direct API calls (curl/Postman) or a small test script.

---

## SPRINT S287 — Panels, Topics & Threaded Discussion UI

**Depends on S285 + S286.**

### Scope
Frontend only, in `ehr-frontend`. Reuse existing patterns rather than inventing new ones:
- API client methods: add to `ehr-frontend/src/services/api.ts`, following the exact calling convention already used throughout that file (`async methodName(..., token: string, tenantSlug: string) { const response = await ehrAxios.get/post(...); return { data: response.data }; }` — search for `getPatientById` in that file for a model to copy).
- New backend controller (companion to S285/S286's service layer, which had no controller yet): `services/ehr-service/src/clinician-network/clinician-network.controller.ts`, routes under `clinician-network/*`, guarded by the existing `JwtAuthGuard` (same pattern as every other controller in this codebase — copy the guard usage from `services/ehr-service/src/controllers/health-education.controller.ts`, which is a similarly-shaped CRUD controller).
- Routing: add routes under `/ehr/:tenantSlug/clinician-network/*` in `ehr-frontend/src/App.tsx` (search for how `/ehr/:tenantSlug/patients` is routed as a model — same nested-route pattern).

### Screens to build
1. **Panel directory** (`/ehr/:tenantSlug/clinician-network`) — list of panels the doctor has joined + a "browse all open panels" section, join button for open panels, "request to join" for invite-only ones (store the request, don't auto-approve — S288 handles moderator approval, but for v1 it's fine if joining an invite-only panel just requires the invite token/link, no separate approval workflow needed unless S288 adds one).
2. **Panel feed** (`/ehr/:tenantSlug/clinician-network/panels/:panelId`) — list of topics in that panel, sort control (Recent / Most Discussed / Unresolved), a prominent "Create Topic" button.
3. **Create Topic** (`/ehr/:tenantSlug/clinician-network/panels/:panelId/new`) — the structured composer from S286's DTO (age band as a `<select>`, sex as a `<select>`, three textareas). On submit, call the create-topic endpoint; if it returns similar-topics instead of creating, render those with a "this looks similar — view instead" list and a "no, post anyway" button that resubmits with `forcePost: true`. If it returns a PHI-field-rejection error, highlight the specific field and matched span inline (don't just show a generic toast — the doctor needs to see *what* to remove).
4. **Topic thread** (`/ehr/:tenantSlug/clinician-network/topics/:topicId`) — topic body, nested replies (render recursively by `parent_reply_id`, indent each level — a simple recursive React component is sufficient, no need for a virtualized-tree library at this scale), reply composer (same PHI-check flow as topic creation, reusing the same backend validation), and a "Mark Resolved" button visible only to the topic's own author (the frontend can't know the current user's `clinicianId` without a `GET /clinician-network/me` endpoint — add one, returning `{ clinicianId, displayHandle }` for the current tenant user, so the frontend can compare against `topic.authorClinicianId` — note this requires the API to actually return `authorClinicianId` only when it equals the requester's own, otherwise omit it; see S286's anonymity requirement — the simplest correct implementation is: the backend always includes an `isOwnPost: boolean` computed server-side, and never exposes `authorClinicianId` in any list/detail response at all).

### Definition of Done
- `tsc --noEmit` clean in `ehr-frontend` and `services/ehr-service`.
- Manually click through: join an open panel → create a topic → see the duplicate-detection prompt trigger on a near-duplicate → post a genuinely new topic → reply to it (nested) → mark it resolved.
- Confirm in the browser network tab that no API response anywhere includes another clinician's real `clinician_id` to a non-owner, non-moderator caller.

---

## SPRINT S288 — Moderation, Reporting & Participation Record

**Depends on S285–S287.**

### Task 1 — Reporting
- `POST /clinician-network/topics/:id/report` and `/replies/:id/report`, body `{ reason: string }`, inserts into `clinician_network.reports` (master DB).
- A simple moderator-only queue page (`/ehr/:tenantSlug/clinician-network/moderation`), visible only if the current user's `clinician_network.clinicians.is_moderator` is `true` (checked server-side on every moderation endpoint, not just hidden client-side) — list open reports, "dismiss" / "action" buttons.

### Task 2 — De-anonymization flow (moderator-only, deliberately high-friction)
Add a moderator-only endpoint `GET /clinician-network/moderation/resolve-author/:topicId`. Its implementation must:
1. Look up `author_clinician_id` for that topic (master DB).
2. Search **the calling moderator's own current tenant's** `clinician_network_identity_links` table for a row matching that `clinician_id`.
3. If found, return that tenant's real `user_id` (resolve to a name via the tenant's own `users` table). If not found (the real author is on a *different* tenant than the moderator happens to be logged into), return a clear "not resolvable from this tenant — the originating clinic must be identified separately" response — **do not** attempt to search across all tenants' databases from this endpoint; that would defeat the entire point of this architecture. This is deliberate friction, not a bug to "fix" later.

### Task 3 — Participation record
- `GET /clinician-network/me/participation` — returns all topics/replies where `author_clinician_id` equals the calling user's own resolved `clinicianId` (the one case where exposing `clinician_id`-linked content back to its own author is correct and intended).
- Frontend page `/ehr/:tenantSlug/clinician-network/my-participation` listing them, plus a "Export PDF" button. Reuse the existing `jspdf` + `jspdf-autotable` pattern already in this codebase — copy the structure from `ehr-frontend/src/utils/pdfExport.ts`'s `exportVisitToPDF` function (search for that function name) rather than learning jsPDF's API from scratch. The PDF **must** include the exact disclaimer text: *"Record of participation only — this is not an accredited CPD activity."* — non-negotiable copy, not a placeholder to be refined later (it's there for the same honesty-over-overclaiming reason CDSS's own grounded-citation design exists).

### Definition of Done
- `tsc --noEmit` clean in both workspaces touched.
- Manually file a report, confirm it appears in the moderation queue, confirm a non-moderator gets a 403 hitting any moderation endpoint directly.
- Manually export a participation-record PDF and visually confirm the disclaimer text is present and the listed topics/replies actually belong to the exporting user.

---

## SPRINT S289 (stretch — do not start until S285–288 show real doctor adoption)

Not a committed sprint — a deferred idea, written down so it isn't lost, not to be built speculatively:
- Auto-suggested tags/specialty for a new topic, using whatever clinical-NLP tooling CDSS already exposes (check `services/ehr-service/src/services/clinical-nlp.service.ts` — referenced as `ClinicalNlpService` in `cdss.service.ts`'s constructor injection list — before building anything new).
- Surface a relevant *open* Clinician Network topic from inside the existing "Ask Umoya" command palette's clinical-search mode (`ehr-frontend/src/components/CommandPalette.tsx`, the `searchClinicalGuidelines` function) when a doctor's live query closely matches one — this is the single most genuinely differentiating idea here (a competitor's panels and a competitor's AI don't talk to each other; Umoya's could), but only worth building once S285–288 prove doctors actually use the panels at all.

Confirm real adoption (active panels with ongoing threads, not just the six seeded ones sitting empty) before picking this up.
