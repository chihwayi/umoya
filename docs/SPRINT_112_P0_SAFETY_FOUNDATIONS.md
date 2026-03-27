# Sprint 112 — P0 Safety Foundations
### Fix Everything That Makes the System Unsafe Before Adding Any New AI

**Master Guide:** [AI_FIRST_MASTER_GUIDE.md](./AI_FIRST_MASTER_GUIDE.md) — Read first.
**Sprint type:** Hardening / Safety
**Blocks:** All other sprints. Nothing in Sprint 113–116 is trustworthy until this is done.

---

## Objective

Five critical issues make the current system unsafe for production AI use. This sprint fixes all five in order. No new features. No refactors. Only these five items.

---

## P0 Items (in execution order)

| # | Item | Risk if not fixed |
|---|------|-------------------|
| P0-1 | Migrate CDSS feedback SQLite → PostgreSQL | All self-learning data lost on restart |
| P0-2 | Consent guard middleware on CDSS PHI calls | HIPAA §164.506 violation |
| P0-3 | Encrypt sensitive columns at rest | HIPAA §164.312 violation |
| P0-4 | Hard-stop drug contraindication | Patient safety — CONTRAINDICATED drugs not blocked |
| P0-5 | Fix inbox triage fallback from "routine" to "pending_review" | Critical results silently downgraded |

---

## P0-1 — Migrate CDSS Feedback SQLite → PostgreSQL

### What is wrong
`services/cdss-service/main.py` lines 70–78:
```python
path = pathlib.Path(configured).expanduser() if configured else pathlib.Path(tempfile.gettempdir()) / "medicore_cdss_feedback.sqlite3"
```
If `CDSS_FEEDBACK_DB_PATH` is unset (current production state), feedback writes to `/tmp/medicore_cdss_feedback.sqlite3`. Docker restarts delete `/tmp`. Every restart loses all outcome feedback. The self-learning loop has no durable data.

### Fix

**Step 1 — Add provisioning bundle**

File: `services/tenant-service/src/services/database-provisioning.service.ts`

In `getSchemaVersionBundles()` array, add after the last sprint111 bundle:
```typescript
{
  id: 'sprint112_feedback_persistence',
  label: 'Sprint 112 - CDSS Feedback Persistence',
  version: '2026.03.27.2',
  description: 'cdss_feedback_batches and cdss_feedback_entries tables — durable outcome feedback replacing SQLite /tmp storage',
  statements: () => this.getSprint112FeedbackPersistenceStatements(),
},
```

Add private method at end of class:
```typescript
private getSprint112FeedbackPersistenceStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS cdss_feedback_batches (
      batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(100) NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      feedback_count INT NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cdss_fb_batch_tenant ON cdss_feedback_batches (tenant_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_cdss_fb_batch_status ON cdss_feedback_batches (status, submitted_at DESC)`,
    `CREATE TABLE IF NOT EXISTS cdss_feedback_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL REFERENCES cdss_feedback_batches(batch_id) ON DELETE CASCADE,
      tenant_id VARCHAR(100) NOT NULL,
      log_id VARCHAR(255),
      patient_id UUID,
      decision_type VARCHAR(60) NOT NULL,
      top_recommendation TEXT,
      confidence_score NUMERIC(5,4),
      clinician_action VARCHAR(20),
      override_reason TEXT,
      outcome_at_30_days JSONB,
      outcome_at_90_days JSONB,
      feedback_status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
      review_notes TEXT,
      claimed_for_learning BOOLEAN NOT NULL DEFAULT FALSE,
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_batch ON cdss_feedback_entries (batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_tenant ON cdss_feedback_entries (tenant_id, feedback_status)`,
    `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_decision ON cdss_feedback_entries (decision_type, clinician_action)`,
    `CREATE INDEX IF NOT EXISTS idx_cdss_fb_entry_claim ON cdss_feedback_entries (claimed_for_learning, feedback_status)`,
  ];
}
```

**Step 2 — Create TypeORM entities**

File: `services/ehr-service/src/entities/cdss-feedback-batch.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cdss_feedback_batches')
export class CdssFeedbackBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'feedback_count', type: 'int', default: 0 })
  feedbackCount: number;

  @Column({ type: 'varchar', length: 30, default: 'pending_review' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

File: `services/ehr-service/src/entities/cdss-feedback-entry.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('cdss_feedback_entries')
export class CdssFeedbackEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'log_id', type: 'varchar', length: 255, nullable: true })
  logId?: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string;

  @Column({ name: 'decision_type', type: 'varchar', length: 60 })
  decisionType: string;

  @Column({ name: 'top_recommendation', type: 'text', nullable: true })
  topRecommendation?: string;

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidenceScore?: number;

  @Column({ name: 'clinician_action', type: 'varchar', length: 20, nullable: true })
  clinicianAction?: string;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason?: string;

  @Column({ name: 'outcome_at_30_days', type: 'jsonb', nullable: true })
  outcomeAt30Days?: Record<string, any>;

  @Column({ name: 'outcome_at_90_days', type: 'jsonb', nullable: true })
  outcomeAt90Days?: Record<string, any>;

  @Column({ name: 'feedback_status', type: 'varchar', length: 30, default: 'pending_review' })
  feedbackStatus: string;

  @Column({ name: 'claimed_for_learning', type: 'boolean', default: false })
  claimedForLearning: boolean;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**Step 3 — Register entities**

File: `services/ehr-service/src/services/tenant.service.ts`
Add to the `entities: []` array:
```typescript
import { CdssFeedbackBatch } from '../entities/cdss-feedback-batch.entity';
import { CdssFeedbackEntry } from '../entities/cdss-feedback-entry.entity';
// ... in entities array:
CdssFeedbackBatch,
CdssFeedbackEntry,
```

**Step 4 — Add PostgreSQL writer to CDSS service**

File: `services/cdss-service/main.py`

Add new environment variable support and PostgreSQL feedback writer. Add near the top of the file after imports:

```python
import asyncpg
import json as _json

# ── Feedback store ────────────────────────────────────────────────────────────
# Sprint 112: migrated from SQLite /tmp to PostgreSQL
# Env vars required: FEEDBACK_PG_DSN or individual FEEDBACK_PG_* vars

def _feedback_pg_dsn() -> str:
    dsn = os.getenv("FEEDBACK_PG_DSN", "").strip()
    if dsn:
        return dsn
    host = os.getenv("SERVICE_POSTGRES_HOST", "postgres-master")
    port = os.getenv("PORT_POSTGRES", "5432")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    # Feedback writes to the master DB — tenant_id column differentiates tenants
    db = os.getenv("POSTGRES_DB", "medicore")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"

async def _write_feedback_to_pg(tenant_id: str, entries: list[dict]) -> str:
    """Write outcome feedback entries to PostgreSQL cdss_feedback_entries table.
    Returns batch_id UUID."""
    conn = await asyncpg.connect(_feedback_pg_dsn())
    try:
        async with conn.transaction():
            batch_id = await conn.fetchval(
                """INSERT INTO cdss_feedback_batches (tenant_id, feedback_count, status)
                   VALUES ($1, $2, 'pending_review') RETURNING batch_id""",
                tenant_id, len(entries)
            )
            for entry in entries:
                await conn.execute(
                    """INSERT INTO cdss_feedback_entries
                       (batch_id, tenant_id, log_id, patient_id, decision_type,
                        top_recommendation, confidence_score, clinician_action,
                        override_reason, outcome_at_30_days, outcome_at_90_days)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)""",
                    str(batch_id),
                    tenant_id,
                    entry.get("log_id"),
                    entry.get("patient_id"),
                    entry.get("decision_type", "unknown"),
                    entry.get("top_recommendation"),
                    entry.get("confidence_score"),
                    entry.get("clinician_action"),
                    entry.get("override_reason"),
                    _json.dumps(entry.get("outcome_at_30_days")) if entry.get("outcome_at_30_days") else None,
                    _json.dumps(entry.get("outcome_at_90_days")) if entry.get("outcome_at_90_days") else None,
                )
        return str(batch_id)
    finally:
        await conn.close()
```

Then update the `/feedback/outcome` POST endpoint to call `_write_feedback_to_pg` instead of the SQLite `_feedback_db()`. Remove all SQLite imports and `_feedback_db()` function. Keep the existing Pydantic request models.

**Step 5 — Add env vars**

File: `.env`
```bash
FEEDBACK_PG_DSN=postgresql://postgres:postgres@postgres-master:5432/medicore
```

File: `.env.example`
```bash
FEEDBACK_PG_DSN=postgresql://USER:PASSWORD@HOST:5432/medicore
```

**Step 6 — Add `asyncpg` to requirements**

File: `services/cdss-service/requirements.txt`
```
asyncpg>=0.29.0
```

**Step 7 — Run provisioning**
```bash
./scripts/provision-repair-all.sh
```

### Verification
```bash
# Restart CDSS service, then submit a test feedback entry
curl -X POST http://localhost:8000/feedback/outcome \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test","entries":[{"decision_type":"diagnosis","clinician_action":"accepted","confidence_score":0.85}]}'

# Verify it landed in PostgreSQL (not /tmp)
docker exec medicore-postgres-master psql -U postgres -d medicore \
  -c "SELECT COUNT(*) FROM cdss_feedback_entries;"
# Should return > 0
```

---

## P0-2 — Consent Guard Middleware on CDSS PHI Calls

### What is wrong
`patient_consents` table exists. `consent_templates` table exists. But no code checks consent before running an AI inference on a patient's clinical data. This is HIPAA §164.506.

### Fix

**Step 1 — Add consent check method to ConsentService**

File: `services/ehr-service/src/services/consent.service.ts`

Locate the class and add:
```typescript
async checkAiConsent(patientId: string, consentType: string): Promise<boolean> {
  const consent = await this.patientConsentRepository.findOne({
    where: {
      patientId,
      consentType,
      status: 'active',
    },
  });
  // If no specific consent record exists, default to true for TPO (Treatment, Payment, Operations)
  // This follows HIPAA: consent is not required for TPO, only for non-TPO uses
  if (!consent) return true;
  return consent.consentGiven === true;
}

async requireAiConsent(patientId: string, consentType: string): Promise<void> {
  const allowed = await this.checkAiConsent(patientId, consentType);
  if (!allowed) {
    throw new ForbiddenException(
      `Patient ${patientId} has not consented to AI processing type: ${consentType}`
    );
  }
}
```

**Step 2 — Add consent guard to CdssService.callGovernedJson()**

File: `services/ehr-service/src/services/cdss.service.ts`

Find the `callGovernedJson` method. Before the CDSS HTTP call, add:
```typescript
// Consent check — only for direct patient-context calls
if (payload.patientId) {
  await this.consentService.requireAiConsent(payload.patientId, 'cdss_ai_processing');
}
```

Ensure `ConsentService` is injected:
```typescript
constructor(
  // ... existing injections ...
  private readonly consentService: ConsentService,
) {}
```

**Step 3 — Add provisioning for consent_ai_processing type**

File: `services/tenant-service/src/services/database-provisioning.service.ts`

Add to the sprint112_p0_safety bundle (see Step 4 below for the full bundle):
```sql
INSERT INTO consent_templates (id, consent_type, title, description, version, is_active)
VALUES (
  gen_random_uuid(),
  'cdss_ai_processing',
  'AI-Assisted Clinical Decision Support',
  'I consent to the use of AI-assisted clinical decision support tools to analyze my health information for the purpose of improving my care. AI recommendations are always reviewed by a qualified clinician before affecting my treatment.',
  '1.0',
  true
) ON CONFLICT (consent_type) DO NOTHING;
```

This is a seed INSERT, not a CREATE TABLE — it adds the consent template if it doesn't exist.

---

## P0-3 — Encrypt Sensitive Columns at Rest

### What is wrong
`post_visit_draft_artifacts.content`, `ambient_sessions.transcript_raw`, and related SOAP/clinical note columns store PHI as plaintext JSON in PostgreSQL. HIPAA §164.312(a)(2)(iv) requires encryption of PHI at rest.

### Fix

**Step 1 — Create encryption transformer**

File: `services/ehr-service/src/transformers/encryption.transformer.ts`

Check if this file exists first. If not, create:
```typescript
import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
const KEY_LENGTH = 32; // 256-bit

if (KEY.length !== KEY_LENGTH && process.env.NODE_ENV === 'production') {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
}

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!text || !text.includes(':')) return text;
  const [ivHex, authTagHex, encrypted] = text.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export const encryptionTransformer: ValueTransformer = {
  to: (value: string | null) => (value ? encrypt(value) : value),
  from: (value: string | null) => (value ? decrypt(value) : value),
};
```

**Step 2 — Apply transformer to sensitive entity columns**

File: `services/ehr-service/src/entities/post-visit-draft-artifact.entity.ts`

Find the `content` column and add transformer:
```typescript
@Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
content: string | null;
```

File: `services/ehr-service/src/entities/ambient-session.entity.ts`

Find transcript/raw text columns and add transformer:
```typescript
@Column({ name: 'transcript_raw', type: 'text', nullable: true, transformer: encryptionTransformer })
transcriptRaw: string | null;
```

**Note:** Only apply to columns that store free-text clinical content (SOAP notes, transcripts, diagnoses text). Do NOT apply to UUIDs, dates, codes, or structured JSON — those are not the PHI risk.

**Step 3 — Add ENCRYPTION_KEY to environment**

File: `.env`
```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<generate a 64-character hex string>
```

File: `.env.example`
```bash
ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

**Step 4 — Add provisioning bundle for Sprint 112 P0**

This is the combined P0 provisioning bundle. Add to `getSchemaVersionBundles()`:
```typescript
{
  id: 'sprint112_p0_safety',
  label: 'Sprint 112 - P0 Safety Foundations',
  version: '2026.03.27.1',
  description: 'consent_type index + encryption_key_versions tracking + audit enhancements',
  statements: () => this.getSprint112P0SafetyStatements(),
},
```

Add method:
```typescript
private getSprint112P0SafetyStatements(): string[] {
  return [
    // Track encryption key versions for rotation
    `CREATE TABLE IF NOT EXISTS encryption_key_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_version VARCHAR(20) NOT NULL UNIQUE,
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deprecated_at TIMESTAMPTZ,
      is_current BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_enc_key_current ON encryption_key_versions (is_current)`,
    // Add consent_type index for fast consent checks
    `CREATE INDEX IF NOT EXISTS idx_patient_consents_type ON patient_consents (patient_id, consent_type, status)`,
    // Seed the cdss_ai_processing consent template
    `INSERT INTO consent_templates (consent_type, title, description, version, is_active, created_at, updated_at)
     VALUES (
       'cdss_ai_processing',
       'AI-Assisted Clinical Decision Support Consent',
       'Consent for use of AI/CDSS tools to analyze health information for care improvement. All AI recommendations are reviewed by a qualified clinician.',
       '1.0',
       true,
       NOW(),
       NOW()
     ) ON CONFLICT DO NOTHING`,
  ];
}
```

---

## P0-4 — Hard-Stop Drug Contraindication

### What is wrong
Drug interaction checks run and fire alerts, but nothing prevents a CONTRAINDICATED drug from being prescribed. A clinician can click through a warning. CONTRAINDICATED (severity = 5 or "contraindicated") must be a hard block.

### Fix

**Step 1 — Add contraindication check to PrescriptionService or PharmacyController**

File: `services/ehr-service/src/services/pharmacy.service.ts` (or prescription service if separate)

Find the prescription creation method. Before saving, add:
```typescript
// Hard-stop contraindication check
const interactions = await this.cdssService.checkDrugInteractionsAdvanced({
  patientId,
  newDrug: prescriptionDto.drugName,
  currentMedications: patientMedications.map(m => m.drugName),
  allergies: patientAllergies.map(a => a.allergen),
});

const hardStop = interactions.interactions?.find(
  i => i.severity === 'contraindicated' || i.severity_score >= 5
);

if (hardStop) {
  // Log the blocked prescription attempt
  await this.hipaaAuditService.logPhiAccess({
    userId: requestingUserId,
    action: 'prescription_contraindication_blocked',
    resourceType: 'prescription',
    patientId,
    dataAccessed: ['drug_name', 'contraindication'],
    riskLevel: 'high',
  });
  throw new BadRequestException({
    code: 'CONTRAINDICATION_HARD_STOP',
    message: `Cannot prescribe ${prescriptionDto.drugName}: CONTRAINDICATED interaction with ${hardStop.interactingDrug}. ${hardStop.clinical_significance}`,
    interaction: hardStop,
    requiresOverride: true,
    overrideEndpoint: '/pharmacy/prescriptions/override-contraindication',
  });
}
```

**Step 2 — Add override endpoint (for documented exceptions)**

File: `services/ehr-service/src/controllers/pharmacy.controller.ts`

Add a new endpoint that requires:
- Senior clinician role (not a pharmacist or nurse)
- Mandatory override reason (minimum 20 characters)
- Documented in `cdss_decision_log` with `clinician_action: 'overridden'`

```typescript
@Post('prescriptions/override-contraindication')
@Roles('doctor', 'senior_clinician')
async overrideContraindication(
  @Body() dto: ContraindicationOverrideDto,
  @CurrentUser() user: User,
) {
  if (!dto.overrideReason || dto.overrideReason.length < 20) {
    throw new BadRequestException('Override reason must be at least 20 characters');
  }
  // Log to cdss_decision_log with action 'overridden'
  await this.pharmacyService.createPrescriptionWithContraindicationOverride(dto, user);
}
```

**Step 3 — Add DTO**

File: `services/ehr-service/src/dto/pharmacy.dto.ts`

Add:
```typescript
export class ContraindicationOverrideDto {
  @IsUUID()
  patientId: string;

  @IsString()
  @MinLength(20, { message: 'Override reason must be at least 20 characters for audit purposes' })
  overrideReason: string;

  @IsString()
  drugName: string;

  @IsString()
  interactingDrug: string;

  // Include all normal prescription fields
}
```

---

## P0-5 — Fix Inbox Triage Fallback

### What is wrong
File: `services/ehr-service/src/services/inbox-triage.service.ts` (find the CDSS call)

When CDSS is unavailable, the service falls back to:
```typescript
// WRONG — current code
aiPriority: 'routine',
triageScore: 30,
```

A critical lab result that arrives when CDSS is down gets silently classified as "routine". A clinician may not see it for hours.

### Fix

File: `services/ehr-service/src/services/inbox-triage.service.ts`

Find the catch block or fallback assignment. Change to:
```typescript
// CORRECT — Sprint 112 fix
aiPriority: 'pending_review',
triageScore: null,        // null = not scored, not routine
aiPriorityReason: 'CDSS unavailable — manual review required',
requiresManualTriage: true,
dueBy: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
```

Also create a `pending_review` inbox item that shows a distinct amber "Needs Manual Triage" badge in the UI (Sprint 113 renders this — for now just ensure the data is set correctly).

Additionally, fire a staff notification when items are in `pending_review` for > 15 minutes:
```typescript
// In InboxTriageService, after saving the item:
if (savedItem.aiPriority === 'pending_review') {
  await this.notificationService.notifyStaff({
    type: 'manual_triage_required',
    message: `Inbox item requires manual triage: ${savedItem.title}`,
    severity: 'urgent',
    dueBy: savedItem.dueBy,
  });
}
```

---

## Sprint 112 — Acceptance Criteria

All five items must be verified before this sprint is closed:

- [ ] **P0-1:** `docker exec medicore-postgres-master psql -U postgres -d medicore -c "SELECT COUNT(*) FROM cdss_feedback_entries;"` returns rows after submitting feedback
- [ ] **P0-1:** `/tmp/medicore_cdss_feedback.sqlite3` is NOT created after CDSS restart
- [ ] **P0-2:** Calling a CDSS endpoint for a patient with `consent_given=false` throws 403
- [ ] **P0-2:** Calling a CDSS endpoint for a patient with no consent record succeeds (TPO default)
- [ ] **P0-3:** `ENCRYPTION_KEY` set in `.env`, TypeScript compiles without error
- [ ] **P0-3:** `post_visit_draft_artifacts.content` stored as encrypted string in DB (visible via `psql`)
- [ ] **P0-4:** Attempting to prescribe a CONTRAINDICATED drug returns 400 with `code: CONTRAINDICATION_HARD_STOP`
- [ ] **P0-4:** Override endpoint requires role `doctor` or `senior_clinician`
- [ ] **P0-5:** When CDSS is down (stop cdss-service container), inbox items get `aiPriority: pending_review` not `routine`
- [ ] **Provisioning:** `./scripts/provision-repair-all.sh` completes without error
- [ ] **TypeScript:** `npx tsc --noEmit` in `services/ehr-service` — zero errors
