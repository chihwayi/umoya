# NC-S15 — Alumni Network Standalone Page + MFA Extensions + Final Gaps Closure

**Sprint ID:** NC-S15  
**Priority:** Medium-High  
**Effort:** 7 days  
**Dependencies:** NC-S01–NC-S14 (all prior sprints)  
**Gaps Covered:**
- Feature 11.1 — Alumni Network standalone page and directory (0% → 100%)
- Feature 11.2 — MFA: Hardware token (FIDO2/WebAuthn) support in addition to TOTP (0% → 100%)
- Feature 11.3 — MFA: Emergency bypass audit and time-limited override (partial → 100%)
- Feature 11.4 — Patient portal: Consent management dashboard (signed consent records) (0% → 100%)
- Feature 11.5 — Role-based access matrix documentation + enforcement audit (partial → 100%)
- Feature 11.6 — Telemedicine pre-consultation form integration with clinical record (partial → 100%)
- Feature 11.7 — Final CI pipeline hardening: coverage gates, lint-on-push enforcement (0% → 100%)

---

## 1. Codebase Context

### Alumni Network (from NC-S07)
- `training_trainees` table exists with `deployment_facility`, `alumni_since`, `cpd_total_credits`
- `GET /training/alumni` endpoint exists returning basic list
- No dedicated page in EHR frontend; no directory search, no map view

### MFA (from NC-S02)
- TOTP via `speakeasy` — fully implemented
- `two_factor_secret`, `two_factor_enabled` in users table
- `MfaGuard` applied globally
- `emergency_access_log` table exists
- `allowEmergencyBypass` tenant flag exists
- WebAuthn/FIDO2 hardware tokens: NOT implemented — no `webauthn-json` or `@simplewebauthn` package

### Consent Records
- No consent_records table exists anywhere
- Patient portal has no consent management UI
- CDPA 2021 Article 22 requires documented consent for processing sensitive health data
- NC-S01 created CDPA compliance tracking but not per-patient consent records

### Telemedicine
- Video integration: stub/placeholder (see broader AI-First sprints)
- Pre-consultation form: exists as basic text fields only; form data NOT linked to EHR clinical encounter
- Gap: telemedicine pre-consultation responses should auto-populate EHR visit note

### CI Pipeline Gaps
- No coverage threshold enforcement in `jest.config.js`
- ESLint not run on pre-push git hook
- No test:ci script that fails below 70% coverage

---

## 2. What This Sprint Builds

### Part A — Alumni Network Page
A searchable, filterable alumni directory showing trained staff with their deployment facility, course completed, CPD credits, and last active date. Includes a Zimbabwe map overlay showing facility distribution.

### Part B — WebAuthn / FIDO2 Hardware Token MFA
Registration of hardware security keys (YubiKey, TouchID, FaceID) as second factors. Supports both TOTP and WebAuthn side-by-side.

### Part C — Per-Patient Consent Records
Signed consent records per patient per data processing purpose, with expiry tracking and consent withdrawal.

### Part D — Telemedicine Pre-Consultation → EHR Bridge
On completing a telemedicine pre-consultation form, auto-create a clinical visit draft in the EHR pre-populated with the form's chief complaint, symptoms, and relevant history.

### Part E — CI Pipeline Hardening
Add coverage thresholds, lint gates, and pre-push hooks.

---

## 3. Database Changes

### 3.1 Provisioning Bundle — add to `getProvisioningBundles()` in `ehr-service`

```typescript
{
  id: 'nc_alumni_consent_webauthn',
  tables: [
    // ─── WebAuthn Credentials ───
    `CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      device_type VARCHAR(32) NOT NULL DEFAULT 'unknown',
      backed_up BOOLEAN NOT NULL DEFAULT false,
      transports TEXT[],
      name VARCHAR(128) NOT NULL DEFAULT 'Security Key',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id)`,

    // ─── Consent Records ───
    `CREATE TABLE IF NOT EXISTS patient_consent_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      consent_type VARCHAR(64) NOT NULL,
      purpose TEXT NOT NULL,
      data_categories TEXT[] NOT NULL,
      granted BOOLEAN NOT NULL,
      granted_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      withdrawn_at TIMESTAMPTZ,
      withdrawn_reason TEXT,
      collected_by UUID,
      collection_method VARCHAR(32) NOT NULL DEFAULT 'electronic',
      version VARCHAR(16) NOT NULL DEFAULT '1.0',
      ip_address VARCHAR(45),
      signature_ref VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_consent_patient ON patient_consent_records(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consent_type ON patient_consent_records(patient_id, consent_type)`,
    `CREATE INDEX IF NOT EXISTS idx_consent_expiry ON patient_consent_records(expires_at) WHERE withdrawn_at IS NULL`,

    // ─── Telemedicine ↔ EHR Bridge ───
    `CREATE TABLE IF NOT EXISTS teleconsult_ehr_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      teleconsult_id UUID NOT NULL UNIQUE,
      ehr_visit_id UUID,
      patient_id UUID NOT NULL,
      pre_consult_data JSONB NOT NULL DEFAULT '{}',
      chief_complaint TEXT,
      symptoms TEXT[],
      linked_at TIMESTAMPTZ,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teleconsult_links_patient ON teleconsult_ehr_links(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_teleconsult_links_status ON teleconsult_ehr_links(status)`,

    // ─── WebAuthn challenge store (temporary, expiry-managed) ───
    `CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      challenge TEXT NOT NULL,
      type VARCHAR(16) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON webauthn_challenges(user_id, type)`,
  ],
}
```

### 3.2 After provisioning: `POST /api/admin/tenants/repair-all`

---

## 4. Backend Implementation

### 4.1 WebAuthn Service
**Install packages first:**
```bash
cd services/ehr-service
npm install @simplewebauthn/server @simplewebauthn/types
```

**File:** `services/ehr-service/src/services/webauthn.service.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';
import { DatabaseService } from './database.service';

const RP_NAME = 'Newlands Clinic MediCore';
const RP_ID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';

@Injectable()
export class WebAuthnService {
  constructor(private readonly db: DatabaseService) {}

  async generateRegistrationOptions(userId: string, userEmail: string, tenantDb: string) {
    const existingCredentials = await this.db.query<{ credential_id: string }>(
      tenantDb,
      `SELECT credential_id FROM webauthn_credentials WHERE user_id = $1`,
      [userId],
    );

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(userId),
      userName: userEmail,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.credential_id,
        type: 'public-key',
        transports: ['usb', 'ble', 'nfc', 'internal'],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge
    await this.db.query(
      tenantDb,
      `INSERT INTO webauthn_challenges (user_id, challenge, type) VALUES ($1, $2, 'registration')
       ON CONFLICT DO NOTHING`,
      [userId, options.challenge],
    );

    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    deviceName: string,
    tenantDb: string,
  ): Promise<{ verified: boolean; credentialId: string }> {
    const challenge = await this.db.queryOne<{ challenge: string }>(
      tenantDb,
      `SELECT challenge FROM webauthn_challenges WHERE user_id = $1 AND type = 'registration' AND expires_at > NOW()`,
      [userId],
    );
    if (!challenge) throw new UnauthorizedException('Challenge expired or not found');

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('WebAuthn registration verification failed');
    }

    const { credential } = verification.registrationInfo;

    await this.db.query(
      tenantDb,
      `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_type, backed_up, transports, name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        Buffer.from(credential.id).toString('base64url'),
        Buffer.from(credential.publicKey).toString('base64'),
        credential.counter,
        credential.type ?? 'public-key',
        credential.backedUp ?? false,
        credential.transports ?? [],
        deviceName,
      ],
    );

    // Clean up challenge
    await this.db.query(
      tenantDb,
      `DELETE FROM webauthn_challenges WHERE user_id = $1 AND type = 'registration'`,
      [userId],
    );

    return { verified: true, credentialId: Buffer.from(credential.id).toString('base64url') };
  }

  async generateAuthenticationOptions(userId: string, tenantDb: string) {
    const credentials = await this.db.query<{ credential_id: string; transports: string[] }>(
      tenantDb,
      `SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1`,
      [userId],
    );

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
        type: 'public-key',
        transports: c.transports as any,
      })),
      userVerification: 'preferred',
    });

    await this.db.query(
      tenantDb,
      `INSERT INTO webauthn_challenges (user_id, challenge, type) VALUES ($1, $2, 'authentication')`,
      [userId, options.challenge],
    );

    return options;
  }

  async verifyAuthentication(
    userId: string,
    response: AuthenticationResponseJSON,
    tenantDb: string,
  ): Promise<boolean> {
    const challenge = await this.db.queryOne<{ challenge: string }>(
      tenantDb,
      `SELECT challenge FROM webauthn_challenges WHERE user_id = $1 AND type = 'authentication' AND expires_at > NOW()`,
      [userId],
    );
    if (!challenge) throw new UnauthorizedException('Challenge expired or not found');

    const credId = response.id;
    const credential = await this.db.queryOne<{ public_key: string; counter: number }>(
      tenantDb,
      `SELECT public_key, counter FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2`,
      [credId, userId],
    );
    if (!credential) throw new UnauthorizedException('Credential not found');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credId,
        publicKey: Buffer.from(credential.public_key, 'base64'),
        counter: credential.counter,
      },
    });

    if (verification.verified) {
      await this.db.query(
        tenantDb,
        `UPDATE webauthn_credentials SET counter = $2, last_used_at = NOW() WHERE credential_id = $1`,
        [credId, verification.authenticationInfo.newCounter],
      );
      await this.db.query(
        tenantDb,
        `DELETE FROM webauthn_challenges WHERE user_id = $1 AND type = 'authentication'`,
        [userId],
      );
    }

    return verification.verified;
  }

  async listCredentials(userId: string, tenantDb: string) {
    return this.db.query(
      tenantDb,
      `SELECT id, name, device_type, backed_up, last_used_at, created_at FROM webauthn_credentials WHERE user_id = $1`,
      [userId],
    );
  }

  async removeCredential(credentialDbId: string, userId: string, tenantDb: string): Promise<void> {
    await this.db.query(
      tenantDb,
      `DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2`,
      [credentialDbId, userId],
    );
  }
}
```

### 4.2 Consent Records Service
**File:** `services/ehr-service/src/services/consent.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

const CONSENT_TYPES = {
  HIV_TESTING: 'hiv_testing',
  DATA_SHARING_RESEARCH: 'data_sharing_research',
  SMS_COMMUNICATION: 'sms_communication',
  TREATMENT: 'treatment',
  PHOTOGRAPHY: 'photography',
  MINOR_ASSENT: 'minor_assent',
} as const;

type ConsentType = typeof CONSENT_TYPES[keyof typeof CONSENT_TYPES];

@Injectable()
export class ConsentService {
  constructor(private readonly db: DatabaseService) {}

  async grantConsent(
    data: {
      patientId: string;
      consentType: ConsentType;
      purpose: string;
      dataCategories: string[];
      expiresAt?: string;
      collectedBy: string;
      ipAddress?: string;
      signatureRef?: string;
    },
    tenantDb: string,
  ): Promise<{ id: string }> {
    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO patient_consent_records (
         patient_id, consent_type, purpose, data_categories, granted, granted_at,
         expires_at, collected_by, ip_address, signature_ref
       ) VALUES ($1,$2,$3,$4,true,NOW(),$5,$6,$7,$8)
       RETURNING id`,
      [
        data.patientId, data.consentType, data.purpose,
        data.dataCategories, data.expiresAt ?? null,
        data.collectedBy, data.ipAddress ?? null, data.signatureRef ?? null,
      ],
    );
    return row;
  }

  async withdrawConsent(consentId: string, reason: string, tenantDb: string): Promise<void> {
    await this.db.query(
      tenantDb,
      `UPDATE patient_consent_records SET withdrawn_at = NOW(), withdrawn_reason = $2, granted = false WHERE id = $1`,
      [consentId, reason],
    );
  }

  async getPatientConsents(patientId: string, tenantDb: string) {
    return this.db.query(
      tenantDb,
      `SELECT * FROM patient_consent_records WHERE patient_id = $1 ORDER BY created_at DESC`,
      [patientId],
    );
  }

  async hasActiveConsent(patientId: string, consentType: ConsentType, tenantDb: string): Promise<boolean> {
    const row = await this.db.queryOne<{ cnt: number }>(
      tenantDb,
      `SELECT COUNT(*)::int as cnt FROM patient_consent_records
       WHERE patient_id = $1 AND consent_type = $2 AND granted = true
         AND withdrawn_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [patientId, consentType],
    );
    return (row?.cnt ?? 0) > 0;
  }

  async getExpiringConsents(daysAhead: number, tenantDb: string) {
    return this.db.query(
      tenantDb,
      `SELECT c.*, p.first_name, p.last_name, p.phone_number
       FROM patient_consent_records c
       JOIN patients p ON p.id = c.patient_id
       WHERE c.granted = true AND c.withdrawn_at IS NULL
         AND c.expires_at BETWEEN NOW() AND NOW() + ($1 || ' days')::INTERVAL
       ORDER BY c.expires_at ASC`,
      [daysAhead],
    );
  }
}
```

### 4.3 Telemedicine ↔ EHR Bridge
**File:** `services/ehr-service/src/services/teleconsult-bridge.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

interface PreConsultForm {
  chiefComplaint: string;
  symptoms: string[];
  currentMedications?: string;
  allergies?: string;
  recentLabResults?: string;
  questionForDoctor?: string;
}

@Injectable()
export class TeleconsultBridgeService {
  constructor(private readonly db: DatabaseService) {}

  async linkPreConsultToEhr(
    teleconsultId: string,
    patientId: string,
    formData: PreConsultForm,
    tenantDb: string,
  ): Promise<{ linkId: string; ehrVisitDraftId: string }> {
    // Create link record
    const [link] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO teleconsult_ehr_links (teleconsult_id, patient_id, pre_consult_data, chief_complaint, symptoms, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
      [teleconsultId, patientId, JSON.stringify(formData), formData.chiefComplaint, formData.symptoms],
    );

    // Auto-create EHR clinical visit draft
    const [visit] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO hiv_clinical_visits (
         patient_id, visit_date, visit_type, chief_complaint, subjective_notes,
         status, source, created_at
       ) VALUES ($1, CURRENT_DATE, 'telemedicine', $2, $3, 'draft', 'teleconsult', NOW())
       RETURNING id`,
      [
        patientId,
        formData.chiefComplaint,
        [
          formData.currentMedications ? `Medications: ${formData.currentMedications}` : '',
          formData.allergies ? `Allergies: ${formData.allergies}` : '',
          formData.questionForDoctor ? `Patient question: ${formData.questionForDoctor}` : '',
        ].filter(Boolean).join('\n'),
      ],
    );

    // Update link with EHR visit ID
    await this.db.query(
      tenantDb,
      `UPDATE teleconsult_ehr_links SET ehr_visit_id = $2, linked_at = NOW(), status = 'linked' WHERE id = $1`,
      [link.id, visit.id],
    );

    return { linkId: link.id, ehrVisitDraftId: visit.id };
  }

  async getEhrDraftForTeleconsult(teleconsultId: string, tenantDb: string) {
    return this.db.queryOne(
      tenantDb,
      `SELECT l.*, v.id as visit_id, v.chief_complaint, v.subjective_notes, v.status as visit_status
       FROM teleconsult_ehr_links l
       LEFT JOIN hiv_clinical_visits v ON v.id = l.ehr_visit_id
       WHERE l.teleconsult_id = $1`,
      [teleconsultId],
    );
  }
}
```

### 4.4 WebAuthn Controller
**File:** `services/ehr-service/src/controllers/webauthn.controller.ts`

```typescript
import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { WebAuthnService } from '../services/webauthn.service';
import { Request } from 'express';

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(private readonly webAuthn: WebAuthnService) {}

  // Registration — requires existing JWT session (user already logged in via password)
  @Post('register/options')
  @UseGuards(JwtAuthGuard)
  getRegistrationOptions(@Req() req: Request) {
    const { user, tenantDb } = req as any;
    return this.webAuthn.generateRegistrationOptions(user.sub, user.email, tenantDb);
  }

  @Post('register/verify')
  @UseGuards(JwtAuthGuard)
  verifyRegistration(
    @Body() body: { response: any; deviceName: string },
    @Req() req: Request,
  ) {
    const { user, tenantDb } = req as any;
    return this.webAuthn.verifyRegistration(user.sub, body.response, body.deviceName, tenantDb);
  }

  // Authentication — no JWT needed (this IS the second-factor)
  @Post('authenticate/options')
  getAuthenticationOptions(@Body() body: { userId: string }, @Req() req: Request) {
    return this.webAuthn.generateAuthenticationOptions(body.userId, (req as any).tenantDb);
  }

  @Post('authenticate/verify')
  async verifyAuthentication(@Body() body: { userId: string; response: any }, @Req() req: Request) {
    const verified = await this.webAuthn.verifyAuthentication(
      body.userId, body.response, (req as any).tenantDb,
    );
    return { verified };
  }

  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  listCredentials(@Req() req: Request) {
    const { user, tenantDb } = req as any;
    return this.webAuthn.listCredentials(user.sub, tenantDb);
  }

  @Delete('credentials/:id')
  @UseGuards(JwtAuthGuard)
  removeCredential(@Param('id') id: string, @Req() req: Request) {
    const { user, tenantDb } = req as any;
    return this.webAuthn.removeCredential(id, user.sub, tenantDb);
  }
}
```

### 4.5 Consent + Telemedicine Bridge Controller
**File:** `services/ehr-service/src/controllers/consent.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ConsentService } from '../services/consent.service';
import { TeleconsultBridgeService } from '../services/teleconsult-bridge.service';
import { Request } from 'express';

@Controller('consent')
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(
    private readonly consent: ConsentService,
    private readonly telebridge: TeleconsultBridgeService,
  ) {}

  @Post('grant')
  grantConsent(@Body() body: any, @Req() req: Request) {
    const { user, tenantDb } = req as any;
    return this.consent.grantConsent({ ...body, collectedBy: user.sub, ipAddress: req.ip }, tenantDb);
  }

  @Patch(':id/withdraw')
  withdrawConsent(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: Request) {
    return this.consent.withdrawConsent(id, body.reason, (req as any).tenantDb);
  }

  @Get('patients/:patientId')
  getPatientConsents(@Param('patientId') patientId: string, @Req() req: Request) {
    return this.consent.getPatientConsents(patientId, (req as any).tenantDb);
  }

  @Get('expiring')
  getExpiringConsents(@Query('daysAhead') daysAhead = 30, @Req() req: Request) {
    return this.consent.getExpiringConsents(+daysAhead, (req as any).tenantDb);
  }

  @Post('teleconsult/link')
  linkTeleconsultToEhr(@Body() body: { teleconsultId: string; patientId: string; formData: any }, @Req() req: Request) {
    return this.telebridge.linkPreConsultToEhr(
      body.teleconsultId, body.patientId, body.formData, (req as any).tenantDb,
    );
  }

  @Get('teleconsult/:teleconsultId/ehr-draft')
  getEhrDraft(@Param('teleconsultId') teleconsultId: string, @Req() req: Request) {
    return this.telebridge.getEhrDraftForTeleconsult(teleconsultId, (req as any).tenantDb);
  }
}
```

### 4.6 Register in `ehr.module.ts`
```typescript
// Add to controllers:
WebAuthnController,
ConsentController,

// Add to providers:
WebAuthnService,
ConsentService,
TeleconsultBridgeService,
```

---

## 5. Frontend Implementation

### 5.1 Alumni Network Page
**File:** `ehr-frontend/src/pages/AlumniNetworkPage.tsx`

Features:
- Full searchable table with columns: Name, Facility, Course Completed, CPD Credits, Alumni Since
- Filters: search by name, filter by facility (dropdown from training_trainees), filter by course
- Export to CSV button
- Map panel: Leaflet map showing Zimbabwe clinics with dot markers; click facility → see alumni count
- "Invite to Case Conference" button (hooks into support groups module)

```typescript
import React, { useState, useEffect } from 'react';

interface AlumniRecord {
  id: string;
  first_name: string;
  last_name: string;
  facility_name: string;
  course_name: string;
  alumni_since: string;
  cpd_total_credits: number;
}

export const AlumniNetworkPage: React.FC = () => {
  const [alumni, setAlumni] = useState<AlumniRecord[]>([]);
  const [search, setSearch] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');

  useEffect(() => {
    fetch(`/api/training/alumni?search=${search}&facility=${facilityFilter}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then((r) => r.json()).then(setAlumni);
  }, [search, facilityFilter]);

  const exportCsv = () => {
    const header = 'Name,Facility,Course,CPD Credits,Alumni Since';
    const rows = alumni.map((a) =>
      `${a.first_name} ${a.last_name},${a.facility_name},${a.course_name},${a.cpd_total_credits},${a.alumni_since}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newlands_alumni.csv';
    a.click();
  };

  const filtered = alumni.filter((a) =>
    `${a.first_name} ${a.last_name} ${a.facility_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 24 }}>
      <h1>Alumni Network</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Search by name or facility..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', flex: 1, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button onClick={exportCsv} style={{ padding: '8px 16px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 4 }}>
          Export CSV
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f7f7f7' }}>
            {['Name', 'Facility', 'Course', 'CPD Credits', 'Alumni Since'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px' }}>{a.first_name} {a.last_name}</td>
              <td style={{ padding: '8px 12px' }}>{a.facility_name}</td>
              <td style={{ padding: '8px 12px' }}>{a.course_name}</td>
              <td style={{ padding: '8px 12px' }}>{a.cpd_total_credits}</td>
              <td style={{ padding: '8px 12px' }}>{a.alumni_since}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### 5.2 Consent Management (Patient Portal)
**File:** `patient-portal/src/pages/ConsentManagementPage.tsx`

- Table of all consent records with status (Active / Withdrawn / Expired)
- Each row: consent type, purpose, date granted, expiry date, "Withdraw" button
- New consent types list with "Grant Consent" per type
- Uses `useTranslation` for i18n (from NC-S11)

### 5.3 WebAuthn Security Keys UI
**File:** `ehr-frontend/src/pages/SecuritySettingsPage.tsx` — add tab "Security Keys":

- List of registered security keys with name, device type, last used date
- "Register New Key" button — triggers WebAuthn registration ceremony
- "Remove" button per key

---

## 6. CI Pipeline Hardening

### 6.1 Add coverage thresholds to Jest
**File:** `services/ehr-service/jest.config.js`

```javascript
module.exports = {
  // ... existing config
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
  ],
};
```

**File:** `patient-portal/jest.config.js` — same thresholds.
**File:** `ehr-frontend/jest.config.js` — same thresholds.

### 6.2 Add `test:ci` script to all packages
**In `services/ehr-service/package.json`, `patient-portal/package.json`, `ehr-frontend/package.json`:**
```json
{
  "scripts": {
    "test:ci": "jest --coverage --ci --coverageReporters=text-summary"
  }
}
```

### 6.3 Add lint pre-push git hook
**File:** `.husky/pre-push` (create if not exists — requires `husky` in root `package.json`):

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "Running lint checks before push..."
npm run lint --workspace=services/ehr-service || exit 1
npm run lint --workspace=patient-portal || exit 1
npm run lint --workspace=ehr-frontend || exit 1
echo "All lint checks passed."
```

```bash
chmod +x .husky/pre-push
```

Install husky if not present:
```bash
npm install --save-dev husky
npx husky install
```

### 6.4 Update CI workflow to use `test:ci`
**File:** `.github/workflows/ci.yml` — find the test step and replace:
```yaml
# Before:
- name: Run tests
  run: npm test

# After:
- name: Run tests with coverage
  run: npm run test:ci
  working-directory: services/ehr-service

- name: Run patient portal tests with coverage
  run: npm run test:ci
  working-directory: patient-portal
```

---

## 7. Role-Based Access Matrix Enforcement

### 7.1 Role definitions (enforce in guards)
The following role hierarchy must be enforced — add a `RolesGuard` if not already present:

| Role | Access Level |
|------|-------------|
| `super_admin` | All endpoints including tenant management |
| `admin` | All EHR endpoints except tenant management |
| `doctor` | Patient records, clinical notes, prescriptions, lab results |
| `nurse` | Vitals, appointments, basic clinical notes; no prescriptions |
| `counsellor` | Psychosocial tabs, counsellor sessions (own notes only) |
| `lab` | Lab results only; read-only patient demographics |
| `reception` | Appointments, patient registration; no clinical data |
| `pharmacist` | Medications, MMD schedules; no full clinical record |
| `researcher` | De-identified exports only; no individual patient PHI |

**File:** `services/ehr-service/src/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

import { SetMetadata } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(`Role '${user?.role}' is not authorised for this action. Required: ${required.join(', ')}`);
    }
    return true;
  }
}
```

Register `RolesGuard` as a global guard in `ehr.module.ts`:
```typescript
{ provide: APP_GUARD, useClass: RolesGuard },
```

Apply `@Roles('doctor', 'admin')` decorators to sensitive endpoints:
- `DeidExportController` — `@Roles('researcher', 'admin')`
- `BreachDetectionController` — `@Roles('admin')`
- `ResearchController.buildCohort()` — `@Roles('researcher', 'admin', 'doctor')`
- `CounsellorSessionsService` — already enforced in service layer

---

## 8. Tests Required

**File:** `services/ehr-service/src/services/__tests__/webauthn.service.spec.ts`

```typescript
describe('WebAuthnService', () => {
  it('generateRegistrationOptions returns challenge and excludes existing credentials', async () => {
    mockDb.query.mockResolvedValueOnce([{ credential_id: 'existing123' }]);
    const options = await service.generateRegistrationOptions('u1', 'user@test.com', 'db');
    expect(options.challenge).toBeDefined();
    expect(options.excludeCredentials).toHaveLength(1);
  });

  it('throws UnauthorizedException when challenge expired', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null); // no valid challenge
    await expect(service.verifyRegistration('u1', {} as any, 'My Key', 'db'))
      .rejects.toThrow(UnauthorizedException);
  });
});
```

**File:** `services/ehr-service/src/services/__tests__/consent.service.spec.ts`

```typescript
describe('ConsentService', () => {
  it('hasActiveConsent returns false when withdrawn', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ cnt: 0 });
    const result = await service.hasActiveConsent('p1', 'hiv_testing', 'db');
    expect(result).toBe(false);
  });

  it('hasActiveConsent returns true when granted and not expired', async () => {
    mockDb.queryOne.mockResolvedValueOnce({ cnt: 1 });
    const result = await service.hasActiveConsent('p1', 'hiv_testing', 'db');
    expect(result).toBe(true);
  });

  it('withdrawConsent sets withdrawn_at and granted=false', async () => {
    mockDb.query.mockResolvedValue([]);
    await service.withdrawConsent('c1', 'Patient request', 'db');
    expect(mockDb.query).toHaveBeenCalledWith(
      'db',
      expect.stringContaining('withdrawn_at = NOW()'),
      expect.any(Array),
    );
  });
});
```

**File:** `services/ehr-service/src/services/__tests__/teleconsult-bridge.service.spec.ts`

```typescript
describe('TeleconsultBridgeService', () => {
  it('creates EHR draft visit from pre-consult form data', async () => {
    mockDb.query.mockResolvedValueOnce([{ id: 'link1' }]);
    mockDb.query.mockResolvedValueOnce([{ id: 'visit1' }]);
    mockDb.query.mockResolvedValue([]);

    const result = await service.linkPreConsultToEhr(
      'tc1', 'p1',
      { chiefComplaint: 'Cough', symptoms: ['cough', 'fever'] },
      'db',
    );
    expect(result.ehrVisitDraftId).toBe('visit1');
    expect(result.linkId).toBe('link1');
  });
});
```

**File:** `services/ehr-service/src/guards/__tests__/roles.guard.spec.ts`

```typescript
describe('RolesGuard', () => {
  it('allows request when user role matches', () => {
    const context = createMockContext('doctor');
    reflector.getAllAndOverride.mockReturnValue(['doctor', 'admin']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when role does not match', () => {
    const context = createMockContext('reception');
    reflector.getAllAndOverride.mockReturnValue(['doctor', 'admin']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows request when no roles required', () => {
    const context = createMockContext('reception');
    reflector.getAllAndOverride.mockReturnValue(null);
    expect(guard.canActivate(context)).toBe(true);
  });
});
```

---

## 9. Sign-off Criteria

- [ ] `npm run lint` passes zero errors in all modified packages
- [ ] `npm test` passes all tests including WebAuthn, consent, telebridge, roles guard specs
- [ ] CI `build-and-test` job passes green with coverage gates enforced (≥70% coverage)
- [ ] Pre-push hook blocks push when lint fails
- [ ] `POST /api/admin/tenants/repair-all` backfills `webauthn_credentials`, `webauthn_challenges`, `patient_consent_records`, `teleconsult_ehr_links`
- [ ] WebAuthn registration ceremony completes end-to-end (generate options → browser ceremony → verify)
- [ ] WebAuthn authentication ceremony completes and returns `{ verified: true }`
- [ ] Removing a credential removes it from `webauthn_credentials` and future auth attempts fail
- [ ] `POST /consent/grant` creates consent record with `granted = true`
- [ ] `PATCH /consent/:id/withdraw` sets `withdrawn_at` and `granted = false`
- [ ] `hasActiveConsent()` returns false for withdrawn or expired consent
- [ ] `POST /consent/teleconsult/link` creates both `teleconsult_ehr_links` record and `hiv_clinical_visits` draft
- [ ] `GET /consent/teleconsult/:id/ehr-draft` returns the linked EHR visit with chief complaint populated
- [ ] Alumni Network page renders with search, CSV export, and facility filter working
- [ ] `RolesGuard` throws 403 when `reception` role hits a `doctor`-only endpoint
- [ ] Coverage threshold failure causes `npm run test:ci` to exit non-zero

---

## Appendix: Complete Sprint Sign-off Checklist for NC-S01 → NC-S15

All 15 sprints are signed off only after ALL of the following are confirmed across the entire codebase:

```
NC-S01 ✅ BAA registry + CDPA 18-control seeding
NC-S02 ✅ MFA TOTP + session management + encryption at rest
NC-S03 ✅ OI early warning + VACS index + fast-track classification
NC-S04 ✅ Drug resistance + regimen switching + MMD scheduling
NC-S05 ✅ ALHIV disclosure + TRAQ transition + GBV HITS + counsellor sessions
NC-S06 ✅ WEEP/MEEP empowerment + support groups + attendance
NC-S07 ✅ Training platform + CPD ledger + alumni deployment
NC-S08 ✅ 95-95-95 cascade + retention + LTFU + cohort builder
NC-S09 ✅ De-identification + Kaplan-Meier + pharmacovigilance + research day portal
NC-S10 ✅ USSD state machine + adherence nudge campaigns + SMS failover
NC-S11 ✅ Shona/Ndebele localisation (patient portal, EHR, mobile, PDF)
NC-S12 ✅ Breach detection + hash-chained audit + backup DR + POTRAZ notification
NC-S13 ✅ Grafana dashboards + offline-first conflict resolution + alert badges
NC-S14 ✅ Dental module + ANC PMTCT + EID + WHO growth charts + paediatric dosing
NC-S15 ✅ Alumni network + WebAuthn + consent records + teleconsult bridge + CI hardening

Final gate: POST /api/admin/tenants/repair-all returns 200 OK with all NC sprint tables backfilled.
```
