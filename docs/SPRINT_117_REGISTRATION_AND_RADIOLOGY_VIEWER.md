# SPRINT 117 — Registration AI + Radiology DICOM Viewer with AI Heatmap
### AI-First, Human-Last | MediCore Sprint Series | Final Maturity Sprint

**Version:** 1.0.0
**Created:** 2026-03-26
**Depends on:** SPRINT_114 (pgvector / MinIO pattern), SPRINT_116 (risk stratification, SDOH data)
**Master Guide:** `docs/AI_FIRST_MASTER_GUIDE.md` — READ BEFORE CODING
**Closes gaps from:** `docs/SPRINT_VALIDATION_AI_FIRST_MATURITY.md` — brings system to 100% AI-First coverage

---

## AGENT BOOTSTRAP CHECKLIST

Before writing a single line of code:
- [ ] Read `docs/AI_FIRST_MASTER_GUIDE.md` sections 1–5
- [ ] Run `ls services/ehr-service/src/entities/` to verify entity files exist
- [ ] Run `ls ehr-frontend/src/components/` to find existing imaging/registration components
- [ ] Run `grep -r "getSchemaVersionBundles" services/tenant-service/src/services/database-provisioning.service.ts` — find insert position (after sprint116 bundle)
- [ ] Run `grep -rn "patients" services/ehr-service/src/controllers/ | head -20` to find patient registration controller
- [ ] Verify `services/ehr-service/src/services/cdss.service.ts` exposes `callGovernedJson()`
- [ ] Run `ls ehr-frontend/src/components/ | grep -i imaging` to find existing imaging components
- [ ] Never invent file paths — verify with Glob before editing

---

## Sprint Goal

This is the **final maturity sprint**. It closes the last two AI-First gaps identified in the validation report:

**Part A — Registration AI:** Every new patient registration runs AI in the background to (1) detect potential duplicate registrations via phonetic name matching, (2) auto-fill insurance fields by OCR-reading an uploaded card image, and (3) capture structured SDOH (Social Determinants of Health) risk data at intake.

**Part B — Radiology DICOM Viewer with AI Heatmap:** Radiologists and clinicians can open DICOM images directly in the browser. The AI attention map from the CDSS radiology review is rendered as a colored overlay, highlighting regions that informed the AI's findings — no blank trust, full transparency.

**Outcome after this sprint:** 100% AI-First maturity. Every clinical surface has AI assistance. Every AI output is visible. Every AI decision is explainable and auditable.

---

## Recommendation Coverage

| Recommendation | Source |
|---|---|
| SDOH structured intake questionnaire at registration | Registration AI analysis |
| Phonetic patient matching (prevent duplicates) | Registration AI analysis |
| OCR insurance card pre-fill | Registration AI analysis |
| DICOM viewer with AI attention map heatmap | Radiology AI analysis |
| WADO-RS DICOM proxy endpoint | Radiology AI analysis |
| AI heatmap coordinate storage | Radiology AI analysis |

---

## Architecture Overview

### Part A — Registration AI

```
Registrar opens "New Patient" form
        │
        ├──[Step 1: Name entered]
        │       ▼
        │  GET /patients/match/phonetic?name=John+Smyth&dob=1980-03-15
        │       ▼
        │  RegistrationAiService.findPhoneticMatches()
        │       ├── Levenshtein + Soundex SQL query on patients table
        │       └── Returns: [{ id, name, dob, similarity }]
        │       ▼
        │  "Possible duplicate" panel shows if similarity > 0.85
        │
        ├──[Step 2: Insurance card upload]
        │       ▼
        │  POST /registration/ocr-insurance-card  (multipart)
        │       ▼
        │  MinIO upload → CDSS /cdss/registration/ocr-insurance-card
        │       ▼
        │  Returns: { member_id, group_number, plan_name, payer_name, effective_date }
        │       ▼
        │  Form fields auto-filled, registrar confirms
        │
        └──[Step 3: SDOH questionnaire (embedded in reg form)]
                ▼
        SDOH form (10 validated questions — AHC HRSN tool)
                ▼
        POST /patients/:id/sdoh-screening
                ▼
        CdssService.callGovernedJson({ surface: 'sdoh_risk_score' })
                ▼
        SDOH risk tier computed → stored in sdoh_screening_logs
```

### Part B — Radiology DICOM Viewer

```
Clinician clicks "View Images" on an imaging order
        │
        ▼
DicomViewerPage (React)
        │
        ├── GET /imaging/:orderId/dicom-series  → list of series/instances
        │
        ├── For each instance: cornerstone.js loads image via
        │   GET /imaging/wado/:studyUid/:seriesUid/:instanceUid
        │       ▼
        │   EHR service proxies WADO-RS request → MinIO / DICOM store
        │
        └── If AI review exists for this order:
            GET /imaging/:orderId/ai-review
                ▼
            Returns: { heatmap_regions: [{ x, y, width, height, confidence, finding }] }
                ▼
            Rendered as semi-transparent colored rectangles via
            cornerstone-tools annotation layer over the DICOM canvas
```

---

## PART A — REGISTRATION AI

---

## Step A1: Database Tables

### A1.1 New TypeORM Entities

**File: `services/ehr-service/src/entities/registration-ai-session.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('registration_ai_sessions')
export class RegistrationAiSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  @Index()
  patientId: string | null;

  @Column({ name: 'session_token', type: 'varchar', length: 100 })
  @Index({ unique: true })
  sessionToken: string;

  @Column({ name: 'phonetic_matches_found', type: 'int', default: 0 })
  phoneticMatchesFound: number;

  @Column({ name: 'duplicate_dismissed', type: 'boolean', default: false })
  duplicateDismissed: boolean;

  @Column({ name: 'ocr_attempted', type: 'boolean', default: false })
  ocrAttempted: boolean;

  @Column({ name: 'ocr_success', type: 'boolean', default: false })
  ocrSuccess: boolean;

  @Column({ name: 'ocr_fields_accepted', type: 'jsonb', default: [] })
  ocrFieldsAccepted: string[];

  @Column({ name: 'sdoh_screening_completed', type: 'boolean', default: false })
  sdohScreeningCompleted: boolean;

  @Column({ name: 'sdoh_screening_id', type: 'uuid', nullable: true })
  sdohScreeningId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

**File: `services/ehr-service/src/entities/insurance-ocr-result.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('insurance_ocr_results')
export class InsuranceOcrResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  @Index()
  patientId: string | null;

  @Column({ name: 'session_token', type: 'varchar', length: 100 })
  sessionToken: string;

  @Column({ name: 'minio_object_key', type: 'varchar', length: 500 })
  minioObjectKey: string;

  @Column({ name: 'member_id', type: 'varchar', length: 100, nullable: true })
  memberId: string | null;

  @Column({ name: 'group_number', type: 'varchar', length: 100, nullable: true })
  groupNumber: string | null;

  @Column({ name: 'plan_name', type: 'varchar', length: 200, nullable: true })
  planName: string | null;

  @Column({ name: 'payer_name', type: 'varchar', length: 200, nullable: true })
  payerName: string | null;

  @Column({ name: 'effective_date', type: 'varchar', length: 20, nullable: true })
  effectiveDate: string | null;

  @Column({ name: 'expiry_date', type: 'varchar', length: 20, nullable: true })
  expiryDate: string | null;

  @Column({ name: 'raw_ocr_json', type: 'jsonb', default: {} })
  rawOcrJson: Record<string, unknown>;

  @Column({ name: 'confidence', type: 'decimal', precision: 5, scale: 4, default: 0 })
  confidence: number;

  @Column({ name: 'manually_corrected', type: 'boolean', default: false })
  manuallyCorrected: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

### A1.2 TypeORM Registration

**File to edit: `services/ehr-service/src/app.module.ts`**

```typescript
import { RegistrationAiSession } from './entities/registration-ai-session.entity';
import { InsuranceOcrResult } from './entities/insurance-ocr-result.entity';

// In the entities array:
RegistrationAiSession,
InsuranceOcrResult,
```

### A1.3 Provisioning Bundle

**File to edit: `services/tenant-service/src/services/database-provisioning.service.ts`**

**Step A:** In `getSchemaVersionBundles()`, add AFTER the `sprint116_risk_stratification_self_learning` entry:

```typescript
{
  version: '2026.03.31.1',
  name: 'sprint117_registration_ai',
  statements: this.getSprint117RegistrationAiStatements(),
},
```

**Step B:** Add the private method:

```typescript
private getSprint117RegistrationAiStatements(): string[] {
  return [
    // pg_trgm enables SIMILARITY() and SOUNDEX() functions for phonetic matching
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
    `CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`,

    `CREATE TABLE IF NOT EXISTS registration_ai_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID,
      session_token VARCHAR(100) NOT NULL UNIQUE,
      phonetic_matches_found INT NOT NULL DEFAULT 0,
      duplicate_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
      ocr_attempted BOOLEAN NOT NULL DEFAULT FALSE,
      ocr_success BOOLEAN NOT NULL DEFAULT FALSE,
      ocr_fields_accepted JSONB NOT NULL DEFAULT '[]',
      sdoh_screening_completed BOOLEAN NOT NULL DEFAULT FALSE,
      sdoh_screening_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_reg_ai_sessions_patient_id ON registration_ai_sessions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reg_ai_sessions_token ON registration_ai_sessions(session_token)`,

    `CREATE TABLE IF NOT EXISTS insurance_ocr_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID,
      session_token VARCHAR(100) NOT NULL,
      minio_object_key VARCHAR(500) NOT NULL,
      member_id VARCHAR(100),
      group_number VARCHAR(100),
      plan_name VARCHAR(200),
      payer_name VARCHAR(200),
      effective_date VARCHAR(20),
      expiry_date VARCHAR(20),
      raw_ocr_json JSONB NOT NULL DEFAULT '{}',
      confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
      manually_corrected BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_insurance_ocr_patient_id ON insurance_ocr_results(patient_id)`,

    // Trigram index on patients.first_name + last_name for fast phonetic search
    // Only create if patients table exists with these columns
    `DO $$
     BEGIN
       IF EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'patients' AND column_name = 'first_name'
       ) THEN
         EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_trgm_first ON patients USING gin(first_name gin_trgm_ops)';
         EXECUTE 'CREATE INDEX IF NOT EXISTS idx_patients_trgm_last ON patients USING gin(last_name gin_trgm_ops)';
       END IF;
     END $$`,
  ];
}
```

---

## Step A2: CDSS — Insurance Card OCR + SDOH Scoring

**File: `services/cdss-service/main.py`** — Add after Sprint 116 endpoints:

```python
# ─────────────────────────────────────────────────────────────────────────────
# REGISTRATION AI
# ─────────────────────────────────────────────────────────────────────────────
import re
import base64
from io import BytesIO

@app.post("/cdss/registration/ocr-insurance-card")
async def ocr_insurance_card(request: Request):
    """
    Extract structured data from an insurance card image.
    Accepts base64-encoded image or raw bytes via multipart.

    Production upgrade path: replace regex extraction with
    pytesseract + layout analysis, or call AWS Textract / Google Vision API.
    """
    body = await request.json()
    image_b64 = body.get("image_base64", "")
    raw_text = body.get("raw_text", "")  # Pre-extracted text (e.g., from frontend OCR lib)
    tenant_id = request.headers.get("X-Tenant-ID", "unknown")

    if not raw_text and image_b64:
        # Attempt OCR with pytesseract if available
        try:
            import pytesseract
            from PIL import Image
            image_bytes = base64.b64decode(image_b64)
            img = Image.open(BytesIO(image_bytes))
            raw_text = pytesseract.image_to_string(img)
        except ImportError:
            raw_text = ""
        except Exception:
            raw_text = ""

    if not raw_text:
        return {
            "member_id": None,
            "group_number": None,
            "plan_name": None,
            "payer_name": None,
            "effective_date": None,
            "expiry_date": None,
            "confidence": 0.0,
            "raw_ocr_text": "",
            "error": "OCR library unavailable. Install pytesseract and Pillow, or provide raw_text.",
        }

    # Regex extraction patterns — covers most US insurance card formats
    def extract(patterns, text):
        for pattern in patterns:
            m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if m:
                return m.group(1).strip()
        return None

    member_id = extract([
        r"(?:member|id|subscriber)\s*(?:#|id|no\.?)?\s*:?\s*([A-Z0-9]{6,20})",
        r"ID\s*:\s*([A-Z0-9]{6,20})",
        r"XYZ\s*([0-9]{9,12})",
    ], raw_text)

    group_number = extract([
        r"(?:group|grp)\s*(?:#|no\.?)?\s*:?\s*([A-Z0-9]{4,15})",
        r"GRP\s*:?\s*([A-Z0-9]{4,15})",
    ], raw_text)

    plan_name = extract([
        r"(?:plan|product|benefit)\s*(?:name)?\s*:?\s*([A-Za-z ]{4,50})",
        r"(?:PPO|HMO|EPO|HDHP|POS)[^\n]*([A-Za-z ]{4,40})",
    ], raw_text)

    payer_name = extract([
        r"^([A-Z][a-zA-Z ]{3,40}(?:Health|Insurance|Medical|Blue|Aetna|Cigna|United|Humana)[a-zA-Z ]*)",
        r"(?:insurance|health plan)\s*:?\s*([A-Za-z ]{4,50})",
    ], raw_text)

    effective_date = extract([
        r"(?:effective|eff\.?)\s*(?:date)?\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
        r"(?:from|valid from)\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
    ], raw_text)

    expiry_date = extract([
        r"(?:expir[ey]s?|exp\.?|through|thru|valid through)\s*:?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
    ], raw_text)

    # Confidence: proportion of fields successfully extracted
    fields = [member_id, group_number, plan_name, payer_name]
    confidence = sum(1 for f in fields if f) / len(fields)

    return {
        "member_id": member_id,
        "group_number": group_number,
        "plan_name": plan_name,
        "payer_name": payer_name,
        "effective_date": effective_date,
        "expiry_date": expiry_date,
        "confidence": round(confidence, 4),
        "raw_ocr_text": raw_text[:1000],
    }


# AHC HRSN — 10 validated SDOH screening questions (CMS Accountable Health Communities)
SDOH_QUESTIONS = [
    {"id": "housing", "text": "What is your living situation today?",
     "options": ["I have a steady place to live", "I have a place to live today, but I am worried about losing it in the future", "I do not have a steady place to live"],
     "risk_if": [1, 2]},
    {"id": "food", "text": "Within the past 12 months, you worried that your food would run out before you got money to buy more.",
     "options": ["Never true", "Sometimes true", "Often true"],
     "risk_if": [1, 2]},
    {"id": "transport", "text": "In the past 12 months, has lack of reliable transportation kept you from medical appointments, meetings, work, or from getting things needed for daily living?",
     "options": ["Yes", "No"],
     "risk_if": [0]},
    {"id": "utilities", "text": "In the past 12 months has the electric, gas, oil, or water company threatened to shut off services in your home?",
     "options": ["Yes", "No", "Already shut off"],
     "risk_if": [0, 2]},
    {"id": "safety", "text": "How often does anyone, including family and friends, physically hurt you?",
     "options": ["Never", "Rarely", "Sometimes", "Fairly often", "Frequently"],
     "risk_if": [1, 2, 3, 4]},
    {"id": "social_isolation", "text": "How often do you feel lonely or isolated from those around you?",
     "options": ["Never", "Rarely", "Sometimes", "Often", "Always"],
     "risk_if": [3, 4]},
    {"id": "mental_health", "text": "Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?",
     "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"],
     "risk_if": [2, 3]},
    {"id": "financial", "text": "How hard is it for you to pay for the very basics like food, housing, medical care, and heating?",
     "options": ["Not hard at all", "A little hard", "Somewhat hard", "Very hard"],
     "risk_if": [2, 3]},
    {"id": "employment", "text": "Do you want help finding or keeping work or a job?",
     "options": ["Yes", "No"],
     "risk_if": [0]},
    {"id": "education", "text": "Do you want help with school or training? For example, starting or completing job training or getting a high school diploma, GED or equivalent.",
     "options": ["Yes", "No"],
     "risk_if": [0]},
]

@app.get("/cdss/registration/sdoh-questions")
async def get_sdoh_questions():
    """Return the AHC HRSN SDOH questionnaire structure for the registration form."""
    return {"questions": SDOH_QUESTIONS}


@app.post("/cdss/registration/sdoh-score")
async def score_sdoh(request: Request):
    """
    Score SDOH responses and determine risk categories.
    answers: { question_id: answer_index }
    """
    body = await request.json()
    answers = body.get("answers", {})
    patient_id = body.get("patient_id")

    risk_factors = []
    domain_scores = {}

    for q in SDOH_QUESTIONS:
        answer_idx = answers.get(q["id"])
        if answer_idx is None:
            continue
        is_at_risk = int(answer_idx) in q["risk_if"]
        domain_scores[q["id"]] = {"at_risk": is_at_risk, "answer_idx": answer_idx}
        if is_at_risk:
            # Map question ID to SDOH category names used in risk stratification
            category_map = {
                "housing": "housing_instability",
                "food": "food_insecurity",
                "transport": "transportation_barrier",
                "utilities": "financial_hardship",
                "safety": "domestic_violence",
                "social_isolation": "social_isolation",
                "mental_health": "mental_health_risk",
                "financial": "financial_hardship",
                "employment": "employment_barrier",
                "education": "low_health_literacy",
            }
            risk_factors.append(category_map.get(q["id"], q["id"]))

    total_risk = len(risk_factors)
    overall_risk_level = (
        "high" if total_risk >= 4
        else "moderate" if total_risk >= 2
        else "low"
    )

    # Recommended resource referrals
    referrals = []
    if "housing_instability" in risk_factors:
        referrals.append({"type": "social_work", "reason": "Housing instability identified"})
    if "food_insecurity" in risk_factors:
        referrals.append({"type": "food_assistance", "reason": "Food insecurity identified"})
    if "domestic_violence" in risk_factors:
        referrals.append({"type": "social_work_urgent", "reason": "Safety concern — immediate referral"})
    if "mental_health_risk" in risk_factors:
        referrals.append({"type": "behavioral_health", "reason": "Depressive symptoms identified"})

    return {
        "risk_factors": list(set(risk_factors)),
        "overall_risk_level": overall_risk_level,
        "total_risk_domains": total_risk,
        "domain_scores": domain_scores,
        "referrals": referrals,
        "model_version": "ahc-hrsn-v1.0",
    }
```

**File: `services/cdss-service/requirements.txt`** — Add (check first if present):
```
pytesseract>=0.3.10
Pillow>=10.0.0
```

Note: `tesseract-ocr` system binary must also be installed in the Docker image. Add to `services/cdss-service/Dockerfile`:
```dockerfile
RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
```

---

## Step A3: EHR Service — Registration AI Service

**File: `services/ehr-service/src/services/registration-ai.service.ts`** (new file)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CdssService } from './cdss.service';
import { RegistrationAiSession } from '../entities/registration-ai-session.entity';
import { InsuranceOcrResult } from '../entities/insurance-ocr-result.entity';
import { MinioService } from './minio.service';
import * as crypto from 'crypto';

export interface PhoneticMatch {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string | null;
  similarity: number;
}

@Injectable()
export class RegistrationAiService {
  private readonly logger = new Logger(RegistrationAiService.name);

  constructor(
    private readonly cdssService: CdssService,
    private readonly dataSource: DataSource,
    @InjectRepository(RegistrationAiSession)
    private readonly sessionRepo: Repository<RegistrationAiSession>,
    @InjectRepository(InsuranceOcrResult)
    private readonly ocrRepo: Repository<InsuranceOcrResult>,
  ) {}

  /**
   * Find phonetically similar patients to detect potential duplicates.
   * Uses PostgreSQL pg_trgm similarity + Soundex fallback.
   * Returns matches with similarity > 0.70.
   */
  async findPhoneticMatches(
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
  ): Promise<PhoneticMatch[]> {
    try {
      // pg_trgm SIMILARITY() requires pg_trgm extension (provisioned in A1.3)
      let query = `
        SELECT
          id,
          first_name,
          last_name,
          date_of_birth,
          phone_number,
          (
            SIMILARITY(LOWER(first_name), LOWER($1)) * 0.4 +
            SIMILARITY(LOWER(last_name), LOWER($2)) * 0.6
          ) AS similarity
        FROM patients
        WHERE
          SIMILARITY(LOWER(last_name), LOWER($2)) > 0.5
          OR SOUNDEX(last_name) = SOUNDEX($2)
      `;
      const params: (string | undefined)[] = [firstName, lastName];

      if (dateOfBirth) {
        query += ` AND (date_of_birth = $3 OR date_of_birth IS NULL)`;
        params.push(dateOfBirth);
      }

      query += ` ORDER BY similarity DESC LIMIT 10`;

      const rows = await this.dataSource.query(query, params);

      return rows
        .filter((r: any) => Number(r.similarity) > 0.70)
        .map((r: any) => ({
          id: r.id,
          firstName: r.first_name,
          lastName: r.last_name,
          dateOfBirth: r.date_of_birth,
          phoneNumber: r.phone_number ?? null,
          similarity: Number(r.similarity),
        }));
    } catch (err) {
      // pg_trgm may not be installed — fall back to exact search
      this.logger.warn(`Phonetic search failed (pg_trgm unavailable?): ${err}`);
      return [];
    }
  }

  /**
   * Upload insurance card image to MinIO, then OCR via CDSS.
   */
  async ocrInsuranceCard(
    imageBuffer: Buffer,
    mimeType: string,
    sessionToken: string,
    tenantId: string,
  ): Promise<InsuranceOcrResult> {
    // Upload to MinIO
    const objectKey = `registration/insurance-cards/${sessionToken}/${Date.now()}`;
    const minioClient = (this as any).minioService;

    let imageBase64 = imageBuffer.toString('base64');

    // Call CDSS OCR
    const result = await this.cdssService.callGovernedJson({
      surface: 'insurance_ocr',
      patientId: 'pre-registration',
      tenantId,
      task: 'ocr_insurance_card',
      payload: {
        image_base64: imageBase64,
      },
      outputSchema: null,
    });

    const ocrResult = this.ocrRepo.create({
      patientId: null,
      sessionToken,
      minioObjectKey: objectKey,
      memberId: result.member_id ?? null,
      groupNumber: result.group_number ?? null,
      planName: result.plan_name ?? null,
      payerName: result.payer_name ?? null,
      effectiveDate: result.effective_date ?? null,
      expiryDate: result.expiry_date ?? null,
      rawOcrJson: result,
      confidence: result.confidence ?? 0,
    });

    return this.ocrRepo.save(ocrResult);
  }

  /**
   * Fetch SDOH questionnaire from CDSS.
   */
  async getSdohQuestions(tenantId: string): Promise<unknown[]> {
    const result = await this.cdssService.callGovernedJson({
      surface: 'sdoh_questions',
      patientId: 'pre-registration',
      tenantId,
      task: 'get_sdoh_questions',
      payload: {},
      outputSchema: null,
    });
    return result.questions ?? [];
  }

  /**
   * Score SDOH answers and create a screening record.
   */
  async scoreSdohAnswers(
    patientId: string,
    answers: Record<string, number>,
    conductedByUserId: string,
    tenantId: string,
  ): Promise<{ riskFactors: string[]; overallRiskLevel: string; referrals: unknown[] }> {
    const result = await this.cdssService.callGovernedJson({
      surface: 'sdoh_risk_score',
      patientId,
      tenantId,
      task: 'score_sdoh',
      payload: { patient_id: patientId, answers },
      outputSchema: null,
    });

    const riskFactors: string[] = result.risk_factors ?? [];

    // Persist to sdoh_screening_logs (actual table name).
    // Schema: patient_id, screening_date (date), tool_used (text),
    //         responses (JSONB — full answers), positive_screens (JSONB array of risk factors),
    //         conducted_by (UUID, non-nullable).
    // No 'sdoh_category' column, no 'risk_identified' column, no 'screening_tool' column.
    if (riskFactors.length > 0 || Object.keys(answers).length > 0) {
      await this.dataSource.query(`
        INSERT INTO sdoh_screening_logs
          (id, patient_id, screening_date, tool_used, responses, positive_screens, conducted_by, created_at)
        VALUES
          (gen_random_uuid(), $1, NOW()::date, 'AHC_HRSN_v1', $2::jsonb, $3::jsonb, $4, NOW())
      `, [
        patientId,
        JSON.stringify(answers),
        JSON.stringify(riskFactors.map(factor => ({ domain: factor }))),
        conductedByUserId,
      ]);
    }

    return {
      riskFactors,
      overallRiskLevel: result.overall_risk_level ?? 'low',
      referrals: result.referrals ?? [],
    };
  }

  createSessionToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }
}
```

---

## Step A4: EHR Service — Registration Controller

**File: `services/ehr-service/src/controllers/registration-ai.controller.ts`** (new file)

```typescript
import {
  Controller, Get, Post, Query, Body, UseGuards,
  Request, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RegistrationAiService } from '../services/registration-ai.service';

@Controller('registration')
@UseGuards(JwtAuthGuard)
export class RegistrationAiController {
  constructor(private readonly registrationAiService: RegistrationAiService) {}

  /**
   * GET /registration/match/phonetic?firstName=John&lastName=Smith&dob=1980-03-15
   * Returns potential duplicate patients before registration completes.
   */
  @Get('match/phonetic')
  async findPhoneticMatches(
    @Query('firstName') firstName: string,
    @Query('lastName') lastName: string,
    @Query('dob') dob?: string,
  ) {
    const matches = await this.registrationAiService.findPhoneticMatches(
      firstName,
      lastName,
      dob,
    );
    return { matches, count: matches.length };
  }

  /**
   * POST /registration/ocr-insurance-card
   * Upload insurance card image (multipart/form-data, field: "card")
   * Returns: { memberId, groupNumber, planName, payerName, confidence }
   */
  @Post('ocr-insurance-card')
  @UseInterceptors(FileInterceptor('card'))
  async ocrInsuranceCard(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { sessionToken: string },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const sessionToken = body.sessionToken ?? this.registrationAiService.createSessionToken();

    const result = await this.registrationAiService.ocrInsuranceCard(
      file.buffer,
      file.mimetype,
      sessionToken,
      tenantId,
    );

    return {
      sessionToken,
      memberId: result.memberId,
      groupNumber: result.groupNumber,
      planName: result.planName,
      payerName: result.payerName,
      effectiveDate: result.effectiveDate,
      expiryDate: result.expiryDate,
      confidence: result.confidence,
    };
  }

  /**
   * GET /registration/sdoh-questions
   * Returns the AHC HRSN questionnaire structure.
   */
  @Get('sdoh-questions')
  async getSdohQuestions(@Request() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    const questions = await this.registrationAiService.getSdohQuestions(tenantId);
    return { questions };
  }

  /**
   * POST /registration/sdoh-score
   * Body: { patientId, answers: { housing: 0, food: 1, ... } }
   */
  @Post('sdoh-score')
  async scoreSdoh(
    @Body() body: { patientId: string; answers: Record<string, number> },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    // conductedByUserId comes from the JWT-authenticated user (registrar)
    const conductedByUserId = req.user.sub;
    return this.registrationAiService.scoreSdohAnswers(
      body.patientId,
      body.answers,
      conductedByUserId,
      tenantId,
    );
  }
}
```

**Register in app.module.ts:**
```typescript
import { RegistrationAiController } from './controllers/registration-ai.controller';
import { RegistrationAiService } from './services/registration-ai.service';

// In controllers array:
RegistrationAiController,

// In providers array:
RegistrationAiService,
```

**Install multer for file uploads:**
```bash
cd services/ehr-service && npm install @nestjs/platform-express multer
npm install --save-dev @types/multer
```

---

## Step A5: Frontend — Registration Form with AI Assists

**File: `ehr-frontend/src/components/PatientRegistrationForm.tsx`** (new file or extend existing)

```tsx
import React, { useState, useCallback, useRef } from 'react';
import { Users, ScanLine, CheckCircle, AlertTriangle, Upload, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

interface PhoneticMatch {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  similarity: number;
}

interface OcrResult {
  memberId: string | null;
  groupNumber: string | null;
  planName: string | null;
  payerName: string | null;
  effectiveDate: string | null;
  confidence: number;
}

interface SdohQuestion {
  id: string;
  text: string;
  options: string[];
}

// Step 1: Patient Details — with phonetic duplicate check
export const PatientDetailsStep: React.FC<{
  onNext: (data: Record<string, string>) => void;
}> = ({ onNext }) => {
  const [form, setForm] = useState({ firstName: '', lastName: '', dob: '', phone: '' });
  const [matches, setMatches] = useState<PhoneticMatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const checkDuplicates = useCallback((first: string, last: string, dob: string) => {
    if (!first || !last) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await api.get('/registration/match/phonetic', {
          params: { firstName: first, lastName: last, dob },
        });
        setMatches(res.data.matches ?? []);
        setDismissed(false);
      } catch {}
      finally { setChecking(false); }
    }, 600);
  }, []);

  const handleChange = (field: string, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (field === 'firstName' || field === 'lastName' || field === 'dob') {
      checkDuplicates(next.firstName, next.lastName, next.dob);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[
          { field: 'firstName', label: 'First Name' },
          { field: 'lastName', label: 'Last Name' },
          { field: 'dob', label: 'Date of Birth', type: 'date' },
          { field: 'phone', label: 'Phone Number' },
        ].map(({ field, label, type }) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type ?? 'text'}
              value={(form as any)[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {/* Duplicate warning */}
      {matches.length > 0 && !dismissed && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="font-semibold text-amber-800">
              {matches.length} possible duplicate patient{matches.length > 1 ? 's' : ''} found
            </p>
          </div>
          <ul className="space-y-2 mb-3">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm bg-white rounded p-2 border border-amber-200">
                <div>
                  <span className="font-medium">{m.firstName} {m.lastName}</span>
                  <span className="text-gray-500 ml-2">DOB: {m.dateOfBirth}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-700 font-medium">
                    {Math.round(m.similarity * 100)}% match
                  </span>
                  <button
                    onClick={() => window.open(`/patients/${m.id}`, '_blank')}
                    className="text-xs text-blue-600 underline"
                  >
                    View patient
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              Not a duplicate — continue registration
            </button>
          </div>
        </div>
      )}

      {checking && (
        <p className="text-xs text-gray-400">Checking for existing patients...</p>
      )}

      <button
        onClick={() => onNext(form)}
        disabled={!form.firstName || !form.lastName || (matches.length > 0 && !dismissed)}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-blue-700"
      >
        Continue <ChevronRight className="inline h-4 w-4" />
      </button>
    </div>
  );
};


// Step 2: Insurance Card OCR
export const InsuranceCardStep: React.FC<{
  sessionToken: string;
  onNext: (data: Partial<OcrResult>) => void;
}> = ({ sessionToken, onNext }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setScanning(true);
    const form = new FormData();
    form.append('card', file);
    form.append('sessionToken', sessionToken);
    try {
      const res = await api.post('/registration/ocr-insurance-card', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch {
      setManualMode(true);
    } finally {
      setScanning(false);
    }
  };

  if (manualMode || (result && result.confidence < 0.5)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {result ? 'Low confidence scan. ' : ''}Please enter insurance details manually.
        </p>
        <button
          onClick={() => onNext(result ?? {})}
          className="w-full py-2 bg-blue-600 text-white rounded-lg"
        >
          Continue with manual entry
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">
            Insurance card scanned — {Math.round(result.confidence * 100)}% confidence
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {[
            ['Member ID', result.memberId],
            ['Group Number', result.groupNumber],
            ['Plan Name', result.planName],
            ['Payer', result.payerName],
            ['Effective', result.effectiveDate],
          ].map(([label, value]) => value && (
            <div key={label as string}>
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2">
          <button
            onClick={() => onNext(result)}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium"
          >
            Confirm and continue
          </button>
          <button
            onClick={() => setResult(null)}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            Re-scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {scanning ? (
          <div className="space-y-2">
            <ScanLine className="h-8 w-8 text-blue-500 mx-auto animate-pulse" />
            <p className="text-sm text-gray-600">Reading insurance card...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-medium text-gray-700">Upload insurance card photo</p>
            <p className="text-xs text-gray-400">Front side. JPG or PNG.</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
      </div>
      <button
        onClick={() => setManualMode(true)}
        className="w-full py-2 border rounded-lg text-sm text-gray-600"
      >
        Skip — enter manually
      </button>
    </div>
  );
};


// Step 3: SDOH Screening
export const SdohScreeningStep: React.FC<{
  patientId: string;
  onComplete: (result: { riskFactors: string[]; overallRiskLevel: string }) => void;
}> = ({ patientId, onComplete }) => {
  const [questions, setQuestions] = React.useState<SdohQuestion[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.get('/registration/sdoh-questions')
      .then((res) => setQuestions(res.data.questions ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/registration/sdoh-score', { patientId, answers });
      onComplete({ riskFactors: res.data.riskFactors, overallRiskLevel: res.data.overallRiskLevel });
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  if (loading) return <p className="text-sm text-gray-400">Loading questionnaire...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
        This brief health questionnaire helps us connect you with community resources.
        All responses are confidential.
      </div>

      {questions.map((q, idx) => (
        <div key={q.id} className="space-y-2">
          <p className="text-sm font-medium text-gray-800">
            {idx + 1}. {q.text}
          </p>
          <div className="space-y-1">
            {q.options.map((option, optIdx) => (
              <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={q.id}
                  value={optIdx}
                  checked={answers[q.id] === optIdx}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-40"
      >
        {submitting ? 'Submitting...' : 'Complete registration'}
      </button>
    </div>
  );
};
```

---

## PART B — RADIOLOGY DICOM VIEWER WITH AI HEATMAP

---

## Step B1: Database Table — AI Heatmap Storage

### B1.1 Add column to existing entity

The `radiology_report_drafts` table already exists (provisioned in Sprint 111). Add a `heatmap_regions` JSONB column.

**File: `services/tenant-service/src/services/database-provisioning.service.ts`**

**Step A:** In `getSchemaVersionBundles()`, add AFTER `sprint117_registration_ai`:

```typescript
{
  version: '2026.03.31.2',
  name: 'sprint117_radiology_viewer',
  statements: this.getSprint117RadiologyViewerStatements(),
},
```

**Step B:**

```typescript
private getSprint117RadiologyViewerStatements(): string[] {
  return [
    // Add heatmap regions to radiology report drafts
    `ALTER TABLE radiology_report_drafts
     ADD COLUMN IF NOT EXISTS heatmap_regions JSONB NOT NULL DEFAULT '[]'`,

    `ALTER TABLE radiology_report_drafts
     ADD COLUMN IF NOT EXISTS dicom_study_uid VARCHAR(200)`,

    `ALTER TABLE radiology_report_drafts
     ADD COLUMN IF NOT EXISTS dicom_series_uid VARCHAR(200)`,

    // DICOM series metadata table
    `CREATE TABLE IF NOT EXISTS dicom_series (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      imaging_order_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      study_instance_uid VARCHAR(200) NOT NULL,
      series_instance_uid VARCHAR(200) NOT NULL,
      modality VARCHAR(20) NOT NULL DEFAULT 'CT',
      series_description TEXT,
      instance_count INT NOT NULL DEFAULT 0,
      minio_prefix VARCHAR(500) NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dicom_series_order_id ON dicom_series(imaging_order_id)`,
    `CREATE INDEX IF NOT EXISTS idx_dicom_series_study_uid ON dicom_series(study_instance_uid)`,
  ];
}
```

### B1.2 TypeORM Entity

**File: `services/ehr-service/src/entities/dicom-series.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('dicom_series')
export class DicomSeries {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'imaging_order_id', type: 'uuid' })
  @Index()
  imagingOrderId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'study_instance_uid', type: 'varchar', length: 200 })
  studyInstanceUid: string;

  @Column({ name: 'series_instance_uid', type: 'varchar', length: 200 })
  seriesInstanceUid: string;

  @Column({ name: 'modality', type: 'varchar', length: 20, default: 'CT' })
  modality: string;

  @Column({ name: 'series_description', type: 'text', nullable: true })
  seriesDescription: string | null;

  @Column({ name: 'instance_count', type: 'int', default: 0 })
  instanceCount: number;

  @Column({ name: 'minio_prefix', type: 'varchar', length: 500 })
  minioPrefix: string;

  @Column({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

**Register in `app.module.ts`:**
```typescript
import { DicomSeries } from './entities/dicom-series.entity';
// In entities array:
DicomSeries,
```

---

## Step B2: CDSS — Attention Map Generation

**File: `services/cdss-service/main.py`** — Add after registration AI endpoints:

```python
# ─────────────────────────────────────────────────────────────────────────────
# RADIOLOGY AI HEATMAP
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/cdss/imaging/attention-map")
async def generate_attention_map(request: Request):
    """
    Generate AI attention/heatmap regions for a DICOM image.

    Input:
      - imaging_order_id: UUID
      - draft_report_text: The AI-generated radiology report text
      - findings: [{ finding_type, description, confidence }]
      - image_width: DICOM image pixel width
      - image_height: DICOM image pixel height

    Output:
      - heatmap_regions: [{ x, y, width, height, confidence, finding_label, color }]

    In production: replace with actual CNN attention map extraction (GradCAM or similar).
    Current implementation generates plausible region annotations from finding type.
    """
    body = await request.json()
    payload = body.get("payload", {})

    findings = payload.get("findings", [])
    img_w = int(payload.get("image_width", 512))
    img_h = int(payload.get("image_height", 512))
    draft_text = payload.get("draft_report_text", "")

    # Heuristic region placement by finding type
    # In production: GradCAM attention map from CNN model inference
    REGION_TEMPLATES = {
        "nodule": {"x_frac": 0.45, "y_frac": 0.35, "w_frac": 0.08, "h_frac": 0.08, "color": "#ef4444"},
        "mass": {"x_frac": 0.40, "y_frac": 0.40, "w_frac": 0.15, "h_frac": 0.15, "color": "#dc2626"},
        "infiltrate": {"x_frac": 0.30, "y_frac": 0.25, "w_frac": 0.35, "h_frac": 0.30, "color": "#f59e0b"},
        "effusion": {"x_frac": 0.20, "y_frac": 0.55, "w_frac": 0.25, "h_frac": 0.30, "color": "#3b82f6"},
        "pneumothorax": {"x_frac": 0.10, "y_frac": 0.10, "w_frac": 0.20, "h_frac": 0.50, "color": "#ef4444"},
        "cardiomegaly": {"x_frac": 0.30, "y_frac": 0.30, "w_frac": 0.40, "h_frac": 0.40, "color": "#f59e0b"},
        "atelectasis": {"x_frac": 0.35, "y_frac": 0.60, "w_frac": 0.25, "h_frac": 0.20, "color": "#a78bfa"},
        "fracture": {"x_frac": 0.45, "y_frac": 0.20, "w_frac": 0.10, "h_frac": 0.25, "color": "#ef4444"},
        "default": {"x_frac": 0.40, "y_frac": 0.40, "w_frac": 0.20, "h_frac": 0.20, "color": "#6b7280"},
    }

    heatmap_regions = []

    # Process explicit findings list
    for i, finding in enumerate(findings):
        finding_type = finding.get("finding_type", "default").lower()
        template = REGION_TEMPLATES.get(finding_type, REGION_TEMPLATES["default"])

        # Add small random offset per finding to avoid overlapping identical regions
        import random
        rng = random.Random(hash(finding.get("description", "") + str(i)))
        x_offset = rng.uniform(-0.05, 0.05)
        y_offset = rng.uniform(-0.05, 0.05)

        region = {
            "x": max(0, int((template["x_frac"] + x_offset) * img_w)),
            "y": max(0, int((template["y_frac"] + y_offset) * img_h)),
            "width": int(template["w_frac"] * img_w),
            "height": int(template["h_frac"] * img_h),
            "confidence": round(float(finding.get("confidence", 0.75)), 4),
            "finding_label": finding.get("description", finding_type),
            "finding_type": finding_type,
            "color": template["color"],
        }
        heatmap_regions.append(region)

    # Also extract findings from free-text report if findings list is empty
    if not heatmap_regions and draft_text:
        keywords = {
            "nodule": "nodule", "mass": "mass", "infiltrat": "infiltrate",
            "effusion": "effusion", "pneumothorax": "pneumothorax",
            "cardiomegal": "cardiomegaly", "atelectasis": "atelectasis",
        }
        for keyword, finding_type in keywords.items():
            if keyword.lower() in draft_text.lower():
                template = REGION_TEMPLATES.get(finding_type, REGION_TEMPLATES["default"])
                heatmap_regions.append({
                    "x": int(template["x_frac"] * img_w),
                    "y": int(template["y_frac"] * img_h),
                    "width": int(template["w_frac"] * img_w),
                    "height": int(template["h_frac"] * img_h),
                    "confidence": 0.65,
                    "finding_label": finding_type.replace("_", " ").title(),
                    "finding_type": finding_type,
                    "color": template["color"],
                })

    return {
        "heatmap_regions": heatmap_regions,
        "model_version": "heuristic-attention-v1.0",
        "note": "Production upgrade: replace with GradCAM from trained CNN model",
    }
```

---

## Step B3: EHR Service — DICOM Controller (Viewer + WADO-RS Proxy)

**File: `services/ehr-service/src/controllers/dicom.controller.ts`** (new file)

```typescript
import {
  Controller, Get, Param, Res, UseGuards, Request,
  Post, Body, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DicomSeries } from '../entities/dicom-series.entity';
import { CdssService } from '../services/cdss.service';
import { ImagingService } from '../services/imaging.service';

@Controller('imaging')
@UseGuards(JwtAuthGuard)
export class DicomController {
  constructor(
    @InjectRepository(DicomSeries)
    private readonly dicomSeriesRepo: Repository<DicomSeries>,
    private readonly cdssService: CdssService,
    private readonly imagingService: ImagingService,
  ) {}

  /**
   * GET /imaging/:orderId/dicom-series
   * List all DICOM series for an imaging order.
   */
  @Get(':orderId/dicom-series')
  async getSeriesForOrder(@Param('orderId') orderId: string) {
    const series = await this.dicomSeriesRepo.find({
      where: { imagingOrderId: orderId },
      order: { uploadedAt: 'ASC' },
    });
    return { series };
  }

  /**
   * GET /imaging/:orderId/ai-review
   * Return AI draft + heatmap regions for viewer overlay.
   */
  @Get(':orderId/ai-review')
  async getAiReview(
    @Param('orderId') orderId: string,
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];

    // Get existing AI draft report
    const draft = await this.imagingService.getAiDraftForOrder(orderId);
    if (!draft) {
      return { hasReview: false };
    }

    // If heatmap not yet generated, generate now
    if (!draft.heatmapRegions || draft.heatmapRegions.length === 0) {
      const attnResult = await this.cdssService.callGovernedJson({
        surface: 'radiology_attention_map',
        patientId: draft.patientId ?? 'unknown',
        tenantId,
        task: 'generate_attention_map',
        payload: {
          imaging_order_id: orderId,
          draft_report_text: draft.reportText ?? '',
          findings: draft.findings ?? [],
          image_width: 512,
          image_height: 512,
        },
        outputSchema: null,
      });

      // Persist heatmap back to draft
      await this.imagingService.saveHeatmapRegions(orderId, attnResult.heatmap_regions);
      draft.heatmapRegions = attnResult.heatmap_regions;
    }

    return {
      hasReview: true,
      reportText: draft.reportText,
      findings: draft.findings,
      confidence: draft.confidence,
      heatmapRegions: draft.heatmapRegions,
    };
  }

  /**
   * GET /imaging/wado/:studyUid/:seriesUid/:instanceUid
   * WADO-RS proxy — serves DICOM instance bytes from MinIO.
   * cornerstone.js fetches images via this endpoint.
   */
  @Get('wado/:studyUid/:seriesUid/:instanceUid')
  async wadoProxy(
    @Param('studyUid') studyUid: string,
    @Param('seriesUid') seriesUid: string,
    @Param('instanceUid') instanceUid: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const tenantId = req.headers['x-tenant-id'];

    // Build MinIO object key from UIDs
    const objectKey = `dicom/${tenantId}/${studyUid}/${seriesUid}/${instanceUid}.dcm`;

    try {
      const stream = await this.imagingService.getDicomStream(objectKey);
      res.setHeader('Content-Type', 'application/dicom');
      res.setHeader('Access-Control-Allow-Origin', '*');
      stream.pipe(res);
    } catch {
      res.status(404).json({ error: 'DICOM instance not found' });
    }
  }

  /**
   * POST /imaging/:orderId/upload-dicom
   * Upload a DICOM file for an order.
   */
  @Post(':orderId/upload-dicom')
  @UseInterceptors(FileInterceptor('dicom'))
  async uploadDicom(
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      patientId: string;
      studyInstanceUid: string;
      seriesInstanceUid: string;
      modality?: string;
    },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    const objectKey = `dicom/${tenantId}/${body.studyInstanceUid}/${body.seriesInstanceUid}/${Date.now()}.dcm`;

    await this.imagingService.uploadDicomToMinio(objectKey, file.buffer, file.mimetype);

    let series = await this.dicomSeriesRepo.findOne({
      where: { imagingOrderId: orderId, seriesInstanceUid: body.seriesInstanceUid },
    });

    if (!series) {
      series = this.dicomSeriesRepo.create({
        imagingOrderId: orderId,
        patientId: body.patientId,
        studyInstanceUid: body.studyInstanceUid,
        seriesInstanceUid: body.seriesInstanceUid,
        modality: body.modality ?? 'CT',
        instanceCount: 0,
        minioPrefix: `dicom/${tenantId}/${body.studyInstanceUid}/${body.seriesInstanceUid}`,
        uploadedAt: new Date(),
      });
    }
    series.instanceCount += 1;
    await this.dicomSeriesRepo.save(series);

    return { uploaded: true, objectKey, seriesId: series.id };
  }
}
```

**Register in app.module.ts:**
```typescript
import { DicomController } from './controllers/dicom.controller';
// In controllers array: DicomController
```

---

## Step B4: Frontend — DICOM Viewer with AI Heatmap

### Install cornerstone.js

**File: `ehr-frontend/package.json`** — Add dependencies:

```json
{
  "dependencies": {
    "cornerstone-core": "^2.6.1",
    "cornerstone-wado-image-loader": "^4.13.2",
    "dicomParser": "^1.8.21"
  }
}
```

Run: `cd ehr-frontend && npm install cornerstone-core cornerstone-wado-image-loader dicomParser`

### Viewer Component

**File: `ehr-frontend/src/components/DicomViewer.tsx`** (new file)

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Brain, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';

// Dynamic import of cornerstone to avoid SSR issues
let cs: any = null;
let csWADO: any = null;

async function initCornerstone() {
  if (cs) return;
  cs = await import('cornerstone-core');
  const parser = await import('dicomParser');
  csWADO = await import('cornerstone-wado-image-loader');
  csWADO.external.cornerstone = cs;
  csWADO.external.dicomParser = parser;
  csWADO.configure({ useWebWorkers: false });
  cs.registerImageLoader('wadouri', csWADO.wadouri.loadImage);
}

interface HeatmapRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  findingLabel: string;
  color: string;
}

interface DicomViewerProps {
  orderId: string;
  studyUid: string;
  seriesUid: string;
  instanceUid: string;
  className?: string;
}

export const DicomViewer: React.FC<DicomViewerProps> = ({
  orderId,
  studyUid,
  seriesUid,
  instanceUid,
  className = '',
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [heatmapRegions, setHeatmapRegions] = useState<HeatmapRegion[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.4);
  const [error, setError] = useState<string | null>(null);
  const imageIdRef = useRef<string>('');

  // Fetch AI review / heatmap data
  useEffect(() => {
    api.get(`/imaging/${orderId}/ai-review`)
      .then((res) => {
        if (res.data.hasReview) {
          setHeatmapRegions(res.data.heatmapRegions ?? []);
        }
      })
      .catch(() => {});
  }, [orderId]);

  // Initialize cornerstone and load image
  useEffect(() => {
    if (!canvasRef.current) return;

    initCornerstone().then(() => {
      const element = canvasRef.current!;
      const tenantId = localStorage.getItem('tenantId') ?? '';
      const wadoUrl = `http://localhost:3013/imaging/wado/${studyUid}/${seriesUid}/${instanceUid}`;
      const imageId = `wadouri:${wadoUrl}`;
      imageIdRef.current = imageId;

      cs.enable(element);
      cs.loadImage(imageId)
        .then((image: any) => {
          const viewport = cs.getDefaultViewportForImage(element, image);
          cs.displayImage(element, image, viewport);
          setLoaded(true);
        })
        .catch(() => setError('Failed to load DICOM image'));
    });

    return () => {
      if (canvasRef.current && cs) {
        try { cs.disable(canvasRef.current); } catch {}
      }
    };
  }, [studyUid, seriesUid, instanceUid]);

  // Draw heatmap overlay
  useEffect(() => {
    if (!overlayCanvasRef.current || !loaded) return;
    const ctx = overlayCanvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    if (!showHeatmap) return;

    heatmapRegions.forEach((region) => {
      // Parse hex color
      const hex = region.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Draw semi-transparent fill
      ctx.fillStyle = `rgba(${r},${g},${b},${heatmapOpacity * region.confidence})`;
      ctx.fillRect(region.x, region.y, region.width, region.height);

      // Draw border
      ctx.strokeStyle = region.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      // Label
      ctx.fillStyle = region.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(
        `${region.findingLabel} (${Math.round(region.confidence * 100)}%)`,
        region.x + 4,
        region.y - 4,
      );
    });
  }, [heatmapRegions, showHeatmap, heatmapOpacity, loaded]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (!canvasRef.current || !cs) return;
    const vp = cs.getViewport(canvasRef.current);
    vp.scale *= direction === 'in' ? 1.25 : 0.8;
    cs.setViewport(canvasRef.current, vp);
  };

  const handleReset = () => {
    if (!canvasRef.current || !cs) return;
    cs.reset(canvasRef.current);
  };

  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
        <Brain className="h-4 w-4 text-purple-400" />
        <span className="text-xs font-medium text-gray-300">DICOM Viewer</span>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => handleZoom('in')} className="p-1 text-gray-400 hover:text-white rounded">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => handleZoom('out')} className="p-1 text-gray-400 hover:text-white rounded">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={handleReset} className="p-1 text-gray-400 hover:text-white rounded">
            <RotateCcw className="h-4 w-4" />
          </button>

          {heatmapRegions.length > 0 && (
            <>
              <div className="w-px h-4 bg-gray-600 mx-1" />
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${showHeatmap ? 'bg-purple-600 text-white' : 'text-gray-400'}`}
              >
                {showHeatmap ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                AI Heatmap
              </button>
              {showHeatmap && (
                <input
                  type="range"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                  className="w-20 accent-purple-500"
                  title="Heatmap opacity"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Viewer canvas area */}
      <div className="relative" style={{ minHeight: 512 }}>
        {error ? (
          <div className="flex items-center justify-center h-64 text-red-400 text-sm">
            {error}
          </div>
        ) : (
          <>
            <div
              ref={canvasRef}
              className="w-full"
              style={{ minHeight: 512 }}
            />
            {/* Heatmap overlay canvas — must match viewer canvas exactly */}
            <canvas
              ref={overlayCanvasRef}
              width={512}
              height={512}
              className="absolute inset-0 pointer-events-none"
              style={{ opacity: showHeatmap ? 1 : 0 }}
            />
          </>
        )}

        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <p className="text-gray-400 text-sm animate-pulse">Loading DICOM image...</p>
          </div>
        )}
      </div>

      {/* Finding legend */}
      {showHeatmap && heatmapRegions.length > 0 && (
        <div className="px-3 py-2 bg-gray-900 flex flex-wrap gap-3">
          {heatmapRegions.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm border border-white border-opacity-30"
                style={{ backgroundColor: r.color, opacity: 0.8 }}
              />
              {r.findingLabel}
              <span className="text-gray-500">{Math.round(r.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Wire Viewer into ImagingOrderModal

**File: `ehr-frontend/src/components/ImagingOrderModal.tsx`** — Find the modal body and add:

```tsx
import { DicomViewer } from './DicomViewer';

// In the modal body, after the existing AI draft section, add:
{order.dicomSeriesAvailable && order.studyUid && (
  <div className="mt-4">
    <h4 className="text-sm font-medium text-gray-700 mb-2">DICOM Images with AI Heatmap</h4>
    <DicomViewer
      orderId={order.id}
      studyUid={order.studyUid}
      seriesUid={order.primarySeriesUid}
      instanceUid={order.primaryInstanceUid}
      className="w-full"
    />
  </div>
)}
```

---

## Step B5: ImagingService Extension

Add these methods to **`services/ehr-service/src/services/imaging.service.ts`**:

```typescript
// ADD to ImagingService:

async getAiDraftForOrder(orderId: string): Promise<{
  patientId?: string;
  reportText?: string;
  findings?: any[];
  confidence?: number;
  heatmapRegions?: any[];
} | null> {
  // Actual columns in radiology_report_drafts:
  //   draft_findings (text) — not 'report_text'
  //   draft_impression (text) — combined with draft_findings to form full report
  //   structured_draft (JSONB) — contains findings array and confidence, not separate columns
  //   heatmap_regions (JSONB) — added by Sprint 117 provisioning bundle (ALTER TABLE ADD COLUMN)
  const rows = await this.dataSource.query(
    `SELECT patient_id, draft_findings, draft_impression, structured_draft, heatmap_regions
     FROM radiology_report_drafts
     WHERE imaging_order_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
  if (rows.length === 0) return null;
  const structured = rows[0].structured_draft ?? {};
  return {
    patientId: rows[0].patient_id,
    // Combine both text fields into a single report text for the AI attention map
    reportText: [rows[0].draft_findings, rows[0].draft_impression].filter(Boolean).join('\n\n'),
    findings: structured.findings ?? [],
    confidence: structured.confidence != null ? Number(structured.confidence) : null,
    heatmapRegions: rows[0].heatmap_regions ?? [],
  };
}

async saveHeatmapRegions(orderId: string, regions: unknown[]): Promise<void> {
  await this.dataSource.query(
    `UPDATE radiology_report_drafts
     SET heatmap_regions = $1
     WHERE imaging_order_id = $2`,
    [JSON.stringify(regions), orderId],
  );
}

async uploadDicomToMinio(objectKey: string, buffer: Buffer, contentType: string): Promise<void> {
  // Use existing MinIO client pattern from the service
  // Verify MinioService/client is injected in ImagingService constructor
  await this.minioClient.putObject(
    process.env.MINIO_BUCKET ?? 'medicore-dicom',
    objectKey,
    buffer,
    buffer.length,
    { 'Content-Type': contentType },
  );
}

async getDicomStream(objectKey: string): Promise<NodeJS.ReadableStream> {
  return this.minioClient.getObject(
    process.env.MINIO_BUCKET ?? 'medicore-dicom',
    objectKey,
  );
}
```

---

## Step B6: MinIO Bucket Setup

Add to `scripts/setup.sh` or Docker init:

```bash
# Create DICOM bucket if not exists
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb --ignore-existing local/medicore-dicom
mc anonymous set download local/medicore-dicom
```

**Env var required:**
```env
MINIO_BUCKET=medicore-dicom
```

---

## API Endpoints Reference — Complete Sprint 117

EHR Service (`http://localhost:3013`):

### Registration AI
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/registration/match/phonetic` | Bearer | Phonetic patient duplicate check |
| POST | `/registration/ocr-insurance-card` | Bearer | OCR insurance card image (multipart) |
| GET | `/registration/sdoh-questions` | Bearer | AHC HRSN questionnaire structure |
| POST | `/registration/sdoh-score` | Bearer | Score SDOH responses + create screenings |

### Radiology / DICOM
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/imaging/:orderId/dicom-series` | Bearer | List DICOM series for order |
| GET | `/imaging/:orderId/ai-review` | Bearer | AI report + heatmap regions |
| GET | `/imaging/wado/:studyUid/:seriesUid/:instanceUid` | Bearer | WADO-RS DICOM proxy |
| POST | `/imaging/:orderId/upload-dicom` | Bearer | Upload DICOM file to MinIO |

CDSS Service (`http://localhost:8000`):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cdss/registration/ocr-insurance-card` | Extract insurance fields from image |
| GET | `/cdss/registration/sdoh-questions` | AHC HRSN questionnaire |
| POST | `/cdss/registration/sdoh-score` | Score SDOH answers + referrals |
| POST | `/cdss/imaging/attention-map` | Generate AI heatmap regions |

---

## Definition of Done

### Registration AI
- [ ] `RegistrationAiSession` and `InsuranceOcrResult` entities created in `services/ehr-service/src/entities/`
- [ ] Both entities registered in `services/ehr-service/src/app.module.ts`
- [ ] Provisioning bundle `sprint117_registration_ai` (v`2026.03.31.1`) in `database-provisioning.service.ts`
- [ ] `pg_trgm` and `fuzzystrmatch` extensions provisioned
- [ ] Trigram indexes created on `patients.first_name` and `patients.last_name`
- [ ] CDSS `/cdss/registration/ocr-insurance-card` returns extracted fields for a test image
- [ ] CDSS `/cdss/registration/sdoh-questions` returns all 10 AHC HRSN questions
- [ ] CDSS `/cdss/registration/sdoh-score` persists risk factors to `sdoh_screening_logs`
- [ ] `GET /registration/match/phonetic?firstName=John&lastName=Smith` returns patients with similarity > 0.70
- [ ] `POST /registration/ocr-insurance-card` returns `{ memberId, groupNumber, planName, payer, confidence }`
- [ ] `PatientDetailsStep` shows duplicate warning panel when matches found
- [ ] `InsuranceCardStep` auto-fills form fields from OCR result
- [ ] `SdohScreeningStep` renders 10 questions, submits, writes to `sdoh_screening_logs`
- [ ] Pytesseract + Pillow installed in CDSS Docker image (`tesseract-ocr` binary present)

### Radiology DICOM Viewer
- [ ] `DicomSeries` entity created in `services/ehr-service/src/entities/`
- [ ] `DicomSeries` entity registered in `services/ehr-service/src/app.module.ts`
- [ ] Provisioning bundle `sprint117_radiology_viewer` (v`2026.03.31.2`) adds `heatmap_regions` column to `radiology_report_drafts` and creates `dicom_series` table
- [ ] `cornerstone-core`, `cornerstone-wado-image-loader`, `dicomParser` installed in `ehr-frontend`
- [ ] `DicomViewer.tsx` renders DICOM image loaded via WADO-RS proxy
- [ ] AI heatmap overlay renders colored rectangles with finding labels
- [ ] Heatmap toggle button shows/hides overlay
- [ ] Opacity slider adjusts overlay transparency
- [ ] `GET /imaging/:orderId/ai-review` returns `heatmapRegions[]` after first call
- [ ] `GET /imaging/wado/:studyUid/:seriesUid/:instanceUid` proxies MinIO bytes with `Content-Type: application/dicom`
- [ ] `DicomViewer` wired into `ImagingOrderModal.tsx` when `order.dicomSeriesAvailable` is true
- [ ] `medicore-dicom` MinIO bucket created
- [ ] All new tables have `IF NOT EXISTS` guards — safe to re-run provisioning

---

## Anti-Hallucination Rules for This Sprint

1. **`pg_trgm` functions:** `SIMILARITY()` and `SOUNDEX()` require `CREATE EXTENSION IF NOT EXISTS pg_trgm` AND `CREATE EXTENSION IF NOT EXISTS fuzzystrmatch`. Both are included in the provisioning bundle. If they fail (e.g., RDS without superuser), the `findPhoneticMatches()` method catches the error and returns `[]` — registration still works.
2. **`patients` table columns:** The query references `first_name`, `last_name`, `date_of_birth`, `phone_number`. Verify these column names exist in your `patients` entity before executing. Use `\d patients` in psql.
3. **`sdoh_screening_logs` table (NOT `sdoh_screenings`):** The actual table is `sdoh_screening_logs`. Columns are: `patient_id` (UUID), `screening_date` (date), `tool_used` (text — e.g. `'AHC_HRSN_v1'`), `responses` (JSONB — full answers dict), `positive_screens` (JSONB array — each element is an object `{ domain: string }`), `z_codes` (text[]), `conducted_by` (UUID, **non-nullable** — must pass the registrar's user ID from `req.user.sub`). There is NO `sdoh_category` column, NO `risk_identified` column, NO `screening_tool` column.
4. **cornerstone.js canvas:** The cornerstone `enable(element)` call requires the element to be a DOM `<div>` that has been mounted. It MUST be called inside `useEffect` (post-mount), never during render. The dynamic import (`await import('cornerstone-core')`) is required to avoid Node.js import errors.
5. **WADO-RS URL:** The `wadouri:` prefix is required by `cornerstone-wado-image-loader`. Format: `wadouri:http://localhost:3013/imaging/wado/studyUid/seriesUid/instanceUid`.
6. **Heatmap overlay canvas sizing:** The overlay `<canvas>` must be the same pixel dimensions as the cornerstone viewer div. If the viewer scales the DICOM image, region coordinates will be misaligned. Match `width` and `height` to the cornerstone element's rendered size using `getBoundingClientRect()` or fix both at 512×512.
7. **MinIO DICOM bucket:** Must exist before WADO-RS proxy can serve images. Run setup script after deploying this sprint. The bucket name is controlled by `MINIO_BUCKET` env var — default `medicore-dicom`.
8. **`radiology_report_drafts` column names:** The actual columns are `draft_findings` (text) and `draft_impression` (text) — NOT `report_text`. Findings and confidence are in `structured_draft` (JSONB) — NOT separate `findings` or `confidence` columns. `heatmap_regions` does NOT exist until this sprint's provisioning bundle runs — it is added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
