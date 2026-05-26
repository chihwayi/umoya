# NC-S10 — USSD Workflows + Adherence Nudge Campaigns

**Sprint ID:** NC-S10  
**Priority:** High  
**Effort:** 8 days  
**Dependencies:** NC-S01 (tenant provisioning), NC-S04 (MMD schedules), NC-S02 (session management)  
**Gaps Covered:**
- Feature 6.3 — USSD appointment confirmation and refill request menus (50% → 100%)
- Feature 6.4 — Adherence nudge campaigns (40% → 100%)
- Feature 6.5 — Bulk SMS/USSD dispatch with provider failover (new)

---

## 1. Codebase Context

### Existing SMS/USSD Infrastructure
- `services/ehr-service/src/services/sms.service.ts` — exists, sends raw SMS via Africa's Talking; no USSD session management
- `services/ehr-service/src/controllers/communication.controller.ts` — exists, exposes `POST /communication/sms/send` (single message only)
- `services/ehr-service/src/services/notification.service.ts` — exists, push + in-app; no SMS scheduling
- No USSD session state machine exists anywhere in the codebase
- No campaign scheduler, no bulk dispatch queue

### Existing Patient Scheduling
- `services/ehr-service/src/services/appointments.service.ts` — has `getUpcomingAppointments(patientId)` returning date/time/provider
- `services/ehr-service/src/services/hiv-mmd.service.ts` — has `getOverdueMmdPatients()` and `getPatientMmdHistory()`
- `services/ehr-service/src/entities/patient.entity.ts` — has `phoneNumber` (encrypted), `preferredLanguage`

### Existing Module Registration
- `services/ehr-service/src/ehr.module.ts` — controllers array must include every new controller

### Africa's Talking SDK
- Already installed: `package.json` contains `"africastalking": "^3.x"`
- Credentials stored in env: `AT_API_KEY`, `AT_USERNAME`, `AT_SHORTCODE`, `AT_USSD_CODE`

---

## 2. What This Sprint Builds

### Part A — USSD Session State Machine
A stateful USSD session handler that supports multi-level menus across callback round-trips. Africa's Talking sends `POST` to a webhook URL per USSD keystroke.

### Part B — USSD Menu Scripts
Complete menu trees for:
1. Appointment confirmation (patient dials → view next appointment → confirm/reschedule)
2. Refill request (dial → view current regimen → request refill → branch: MMD eligible?)
3. Lab result notification (one-way push with follow-up options)

### Part C — Adherence Nudge Campaign Engine
Scheduled campaign logic: define campaign (audience, message template, schedule), bulk-dispatch, track delivery and opt-outs.

### Part D — Bulk SMS Dispatch Queue with Provider Failover
Bull queue backed by Redis for async bulk sends. If Africa's Talking fails, retries via Twilio fallback.

---

## 3. Database Changes

### 3.1 Provisioning Bundle — add to `getProvisioningBundles()` in `services/ehr-service/src/services/database-provisioning.service.ts`

```typescript
{
  id: 'nc_ussd_campaigns',
  tables: [
    `CREATE TABLE IF NOT EXISTS ussd_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR(64) NOT NULL UNIQUE,
      phone_number VARCHAR(20) NOT NULL,
      patient_id UUID,
      current_state VARCHAR(64) NOT NULL DEFAULT 'MAIN_MENU',
      context JSONB NOT NULL DEFAULT '{}',
      last_input VARCHAR(255),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ussd_sessions_session_id ON ussd_sessions(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone ON ussd_sessions(phone_number)`,
    `CREATE INDEX IF NOT EXISTS idx_ussd_sessions_active ON ussd_sessions(is_active, expires_at)`,

    `CREATE TABLE IF NOT EXISTS sms_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      message_template TEXT NOT NULL,
      audience_criteria JSONB NOT NULL DEFAULT '{}',
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      total_recipients INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      delivered_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON sms_campaigns(status)`,
    `CREATE INDEX IF NOT EXISTS idx_sms_campaigns_scheduled ON sms_campaigns(scheduled_at) WHERE status = 'scheduled'`,

    `CREATE TABLE IF NOT EXISTS sms_dispatch_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID REFERENCES sms_campaigns(id),
      patient_id UUID NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      provider VARCHAR(32) NOT NULL DEFAULT 'africastalking',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      provider_message_id VARCHAR(255),
      error_message TEXT,
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sms_dispatch_campaign ON sms_dispatch_log(campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sms_dispatch_patient ON sms_dispatch_log(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sms_dispatch_status ON sms_dispatch_log(status)`,

    `CREATE TABLE IF NOT EXISTS sms_opt_outs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number VARCHAR(20) NOT NULL UNIQUE,
      patient_id UUID,
      opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason VARCHAR(255)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone ON sms_opt_outs(phone_number)`,

    `CREATE TABLE IF NOT EXISTS adherence_nudge_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      nudge_type VARCHAR(64) NOT NULL,
      frequency VARCHAR(32) NOT NULL DEFAULT 'daily',
      preferred_time TIME NOT NULL DEFAULT '08:00',
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_sent_at TIMESTAMPTZ,
      next_send_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nudge_schedules_patient ON adherence_nudge_schedules(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nudge_schedules_next ON adherence_nudge_schedules(next_send_at) WHERE is_active = true`,
  ],
}
```

### 3.2 After provisioning: `POST /api/admin/tenants/repair-all`

---

## 4. Backend Implementation

### 4.1 USSD State Machine Service
**File:** `services/ehr-service/src/services/ussd-session.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

export type UssdState =
  | 'MAIN_MENU'
  | 'APPOINTMENTS_VIEW'
  | 'APPOINTMENTS_CONFIRM'
  | 'APPOINTMENTS_RESCHEDULE_REASON'
  | 'REFILL_VIEW'
  | 'REFILL_CONFIRM'
  | 'REFILL_MMD_ELIGIBLE'
  | 'LAB_RESULTS_VIEW'
  | 'OPT_OUT_CONFIRM';

interface UssdSession {
  session_id: string;
  phone_number: string;
  patient_id: string | null;
  current_state: UssdState;
  context: Record<string, unknown>;
  is_active: boolean;
}

interface UssdResponse {
  text: string;
  continueSession: boolean; // true = CON, false = END
}

@Injectable()
export class UssdSessionService {
  private readonly logger = new Logger(UssdSessionService.name);

  constructor(private readonly db: DatabaseService) {}

  async handleCallback(
    sessionId: string,
    phoneNumber: string,
    text: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    // Expire old sessions first
    await this.db.query(
      tenantDb,
      `UPDATE ussd_sessions SET is_active = false WHERE expires_at < NOW() AND is_active = true`,
      [],
    );

    let session = await this.getOrCreateSession(sessionId, phoneNumber, tenantDb);
    const patient = await this.lookupPatientByPhone(phoneNumber, tenantDb);
    if (patient && !session.patient_id) {
      session = await this.updateSession(session.session_id, { patient_id: patient.id }, tenantDb);
    }

    const userInput = text.split('*').pop()?.trim() ?? '';

    return this.dispatch(session, userInput, tenantDb);
  }

  private async dispatch(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    switch (session.current_state) {
      case 'MAIN_MENU':
        return this.handleMainMenu(session, input, tenantDb);
      case 'APPOINTMENTS_VIEW':
        return this.handleAppointmentsView(session, input, tenantDb);
      case 'APPOINTMENTS_CONFIRM':
        return this.handleAppointmentsConfirm(session, input, tenantDb);
      case 'APPOINTMENTS_RESCHEDULE_REASON':
        return this.handleRescheduleReason(session, input, tenantDb);
      case 'REFILL_VIEW':
        return this.handleRefillView(session, input, tenantDb);
      case 'REFILL_CONFIRM':
        return this.handleRefillConfirm(session, input, tenantDb);
      case 'OPT_OUT_CONFIRM':
        return this.handleOptOutConfirm(session, input, tenantDb);
      default:
        await this.endSession(session.session_id, tenantDb);
        return { text: 'END Thank you for contacting Newlands Clinic.', continueSession: false };
    }
  }

  private async handleMainMenu(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    if (!input) {
      // First entry — show menu
      const name = (session.context as any).patient_name ?? 'Patient';
      return {
        text: `CON Welcome to Newlands Clinic, ${name}\n1. My next appointment\n2. Request medication refill\n3. My recent results\n4. Stop SMS reminders\n99. Exit`,
        continueSession: true,
      };
    }

    switch (input) {
      case '1':
        await this.transitionState(session.session_id, 'APPOINTMENTS_VIEW', {}, tenantDb);
        return this.handleAppointmentsView({ ...session, current_state: 'APPOINTMENTS_VIEW', context: {} }, '', tenantDb);
      case '2':
        await this.transitionState(session.session_id, 'REFILL_VIEW', {}, tenantDb);
        return this.handleRefillView({ ...session, current_state: 'REFILL_VIEW', context: {} }, '', tenantDb);
      case '3':
        return this.showLabResults(session, tenantDb);
      case '4':
        await this.transitionState(session.session_id, 'OPT_OUT_CONFIRM', {}, tenantDb);
        return {
          text: 'CON Are you sure you want to stop SMS reminders?\n1. Yes, stop reminders\n2. No, keep them',
          continueSession: true,
        };
      case '99':
        await this.endSession(session.session_id, tenantDb);
        return { text: 'END Thank you. Goodbye.', continueSession: false };
      default:
        return {
          text: 'CON Invalid option. Please try again:\n1. My next appointment\n2. Request medication refill\n3. My recent results\n4. Stop SMS reminders\n99. Exit',
          continueSession: true,
        };
    }
  }

  private async handleAppointmentsView(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    if (!session.patient_id) {
      return { text: 'END Your phone number is not registered. Please visit the clinic.', continueSession: false };
    }

    const appt = await this.db.queryOne<{ date: string; time: string; provider_name: string; id: string }>(
      tenantDb,
      `SELECT a.id, a.appointment_date::date as date, TO_CHAR(a.appointment_time, 'HH24:MI') as time,
              p.first_name || ' ' || p.last_name as provider_name
       FROM appointments a
       JOIN staff p ON p.id = a.provider_id
       WHERE a.patient_id = $1 AND a.appointment_date >= CURRENT_DATE AND a.status = 'scheduled'
       ORDER BY a.appointment_date ASC LIMIT 1`,
      [session.patient_id],
    );

    if (!appt) {
      await this.endSession(session.session_id, tenantDb);
      return { text: 'END You have no upcoming appointments. Please call 0800 NEWLANDS to book.', continueSession: false };
    }

    await this.transitionState(
      session.session_id,
      'APPOINTMENTS_CONFIRM',
      { appointment_id: appt.id },
      tenantDb,
    );

    return {
      text: `CON Your next appointment:\n${appt.date} at ${appt.time}\nWith: ${appt.provider_name}\n\n1. Confirm I will attend\n2. I cannot make it\n0. Back`,
      continueSession: true,
    };
  }

  private async handleAppointmentsConfirm(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    const apptId = (session.context as any).appointment_id;

    switch (input) {
      case '1':
        await this.db.query(
          tenantDb,
          `UPDATE appointments SET patient_confirmed = true, confirmed_at = NOW() WHERE id = $1`,
          [apptId],
        );
        await this.endSession(session.session_id, tenantDb);
        return { text: 'END Thank you! Your appointment is confirmed. We look forward to seeing you.', continueSession: false };
      case '2':
        await this.transitionState(session.session_id, 'APPOINTMENTS_RESCHEDULE_REASON', { appointment_id: apptId }, tenantDb);
        return {
          text: 'CON Sorry you cannot make it. Reason:\n1. Transport issues\n2. Work commitment\n3. Feeling unwell\n4. Family emergency\n5. Other',
          continueSession: true,
        };
      case '0':
        await this.transitionState(session.session_id, 'MAIN_MENU', {}, tenantDb);
        return this.handleMainMenu({ ...session, current_state: 'MAIN_MENU' }, '', tenantDb);
      default:
        return {
          text: 'CON Invalid option:\n1. Confirm I will attend\n2. I cannot make it\n0. Back',
          continueSession: true,
        };
    }
  }

  private async handleRescheduleReason(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    const reasons: Record<string, string> = {
      '1': 'Transport issues',
      '2': 'Work commitment',
      '3': 'Feeling unwell',
      '4': 'Family emergency',
      '5': 'Other',
    };
    const apptId = (session.context as any).appointment_id;
    const reason = reasons[input];

    if (!reason) {
      return {
        text: 'CON Invalid option. Select reason:\n1. Transport issues\n2. Work commitment\n3. Feeling unwell\n4. Family emergency\n5. Other',
        continueSession: true,
      };
    }

    await this.db.query(
      tenantDb,
      `UPDATE appointments SET status = 'rescheduling_requested', reschedule_reason = $2, reschedule_requested_at = NOW() WHERE id = $1`,
      [apptId, reason],
    );
    await this.endSession(session.session_id, tenantDb);
    return {
      text: 'END Your reschedule request has been noted. Our team will call you within 24 hours to book a new date.',
      continueSession: false,
    };
  }

  private async handleRefillView(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    if (!session.patient_id) {
      return { text: 'END Your phone number is not registered. Please visit the clinic.', continueSession: false };
    }

    const regimen = await this.db.queryOne<{ regimen: string; next_pickup: string; mmd_eligible: boolean }>(
      tenantDb,
      `SELECT h.current_regimen as regimen,
              m.next_pickup_date::date::text as next_pickup,
              (m.schedule_type IN ('3-month', '6-month')) as mmd_eligible
       FROM hiv_enrollments h
       LEFT JOIN hiv_mmd_schedules m ON m.patient_id = h.patient_id AND m.is_active = true
       WHERE h.patient_id = $1 AND h.status = 'active' LIMIT 1`,
      [session.patient_id],
    );

    if (!regimen) {
      await this.endSession(session.session_id, tenantDb);
      return { text: 'END No active regimen found. Please visit the clinic.', continueSession: false };
    }

    const pickupInfo = regimen.next_pickup
      ? `Next pickup: ${regimen.next_pickup}`
      : 'Pickup date not set';
    const mmdNote = regimen.mmd_eligible ? ' (Multi-month dispensing)' : '';

    await this.transitionState(
      session.session_id,
      'REFILL_CONFIRM',
      { regimen: regimen.regimen, mmd_eligible: regimen.mmd_eligible },
      tenantDb,
    );

    return {
      text: `CON Your current regimen:\n${regimen.regimen}${mmdNote}\n${pickupInfo}\n\n1. Request refill now\n2. I will come in person\n0. Back`,
      continueSession: true,
    };
  }

  private async handleRefillConfirm(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    switch (input) {
      case '1': {
        const isMmd = (session.context as any).mmd_eligible;
        await this.db.query(
          tenantDb,
          `INSERT INTO hiv_mmd_schedules (patient_id, schedule_type, next_pickup_date, requested_via_ussd, is_active, created_at)
           VALUES ($1, $2, CURRENT_DATE + INTERVAL '3 days', true, true, NOW())
           ON CONFLICT (patient_id) DO UPDATE SET
             next_pickup_date = CURRENT_DATE + INTERVAL '3 days',
             requested_via_ussd = true,
             updated_at = NOW()`,
          [session.patient_id, isMmd ? '3-month' : 'standard'],
        );
        await this.endSession(session.session_id, tenantDb);
        return {
          text: 'END Refill request received. Your medication will be ready within 3 days. You will receive an SMS when ready.',
          continueSession: false,
        };
      }
      case '2':
        await this.endSession(session.session_id, tenantDb);
        return { text: 'END Thank you. Please visit us at your convenience.', continueSession: false };
      case '0':
        await this.transitionState(session.session_id, 'MAIN_MENU', {}, tenantDb);
        return this.handleMainMenu({ ...session, current_state: 'MAIN_MENU' }, '', tenantDb);
      default:
        return {
          text: 'CON Invalid option:\n1. Request refill now\n2. I will come in person\n0. Back',
          continueSession: true,
        };
    }
  }

  private async showLabResults(
    session: UssdSession,
    tenantDb: string,
  ): Promise<UssdResponse> {
    if (!session.patient_id) {
      return { text: 'END Your phone number is not registered.', continueSession: false };
    }

    const result = await this.db.queryOne<{ test_type: string; result_value: string; result_date: string }>(
      tenantDb,
      `SELECT test_type, result_value, result_date::date::text as result_date
       FROM lab_results WHERE patient_id = $1 AND is_released = true
       ORDER BY result_date DESC LIMIT 1`,
      [session.patient_id],
    );

    await this.endSession(session.session_id, tenantDb);
    if (!result) {
      return { text: 'END No recent results available. Please visit the clinic.', continueSession: false };
    }

    return {
      text: `END Your latest result:\n${result.test_type}: ${result.result_value}\nDate: ${result.result_date}\n\nFor details, please visit the clinic.`,
      continueSession: false,
    };
  }

  private async handleOptOutConfirm(
    session: UssdSession,
    input: string,
    tenantDb: string,
  ): Promise<UssdResponse> {
    switch (input) {
      case '1':
        await this.db.query(
          tenantDb,
          `INSERT INTO sms_opt_outs (phone_number, patient_id, opted_out_at, reason)
           VALUES ($1, $2, NOW(), 'USSD opt-out')
           ON CONFLICT (phone_number) DO NOTHING`,
          [session.phone_number, session.patient_id],
        );
        await this.db.query(
          tenantDb,
          `UPDATE adherence_nudge_schedules SET is_active = false WHERE patient_id = $1`,
          [session.patient_id],
        );
        await this.endSession(session.session_id, tenantDb);
        return { text: 'END SMS reminders stopped. You can restart them at any time by visiting the clinic.', continueSession: false };
      case '2':
        await this.endSession(session.session_id, tenantDb);
        return { text: 'END Your SMS reminders will continue. Thank you.', continueSession: false };
      default:
        return {
          text: 'CON Invalid option:\n1. Yes, stop reminders\n2. No, keep them',
          continueSession: true,
        };
    }
  }

  // --- Helpers ---

  private async getOrCreateSession(
    sessionId: string,
    phoneNumber: string,
    tenantDb: string,
  ): Promise<UssdSession> {
    const existing = await this.db.queryOne<UssdSession>(
      tenantDb,
      `SELECT * FROM ussd_sessions WHERE session_id = $1 AND is_active = true`,
      [sessionId],
    );
    if (existing) return existing;

    const [created] = await this.db.query<UssdSession>(
      tenantDb,
      `INSERT INTO ussd_sessions (session_id, phone_number, current_state, context, expires_at)
       VALUES ($1, $2, 'MAIN_MENU', '{}', NOW() + INTERVAL '5 minutes')
       RETURNING *`,
      [sessionId, phoneNumber],
    );
    return created;
  }

  private async lookupPatientByPhone(
    phone: string,
    tenantDb: string,
  ): Promise<{ id: string } | null> {
    // Note: phoneNumber is encrypted; look up via pgp_sym_decrypt if using pgcrypto,
    // or via a phone_hash index. For now we store a deterministic hash at registration.
    return this.db.queryOne<{ id: string }>(
      tenantDb,
      `SELECT id FROM patients WHERE phone_hash = encode(sha256($1::bytea), 'hex') LIMIT 1`,
      [phone],
    );
  }

  private async transitionState(
    sessionId: string,
    newState: UssdState,
    context: Record<string, unknown>,
    tenantDb: string,
  ): Promise<void> {
    await this.db.query(
      tenantDb,
      `UPDATE ussd_sessions SET current_state = $2, context = $3, expires_at = NOW() + INTERVAL '5 minutes', updated_at = NOW()
       WHERE session_id = $1`,
      [sessionId, newState, JSON.stringify(context)],
    );
  }

  private async endSession(sessionId: string, tenantDb: string): Promise<void> {
    await this.db.query(
      tenantDb,
      `UPDATE ussd_sessions SET is_active = false, updated_at = NOW() WHERE session_id = $1`,
      [sessionId],
    );
  }

  private async updateSession(
    sessionId: string,
    updates: Partial<UssdSession>,
    tenantDb: string,
  ): Promise<UssdSession> {
    const [updated] = await this.db.query<UssdSession>(
      tenantDb,
      `UPDATE ussd_sessions SET patient_id = COALESCE($2, patient_id), updated_at = NOW()
       WHERE session_id = $1 RETURNING *`,
      [sessionId, updates.patient_id ?? null],
    );
    return updated;
  }
}
```

### 4.2 Campaign Service
**File:** `services/ehr-service/src/services/sms-campaign.service.ts`

```typescript
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { SmsService } from './sms.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface CreateCampaignDto {
  name: string;
  messageTemplate: string;
  audienceCriteria: {
    nudge_type?: 'appointment_reminder' | 'refill_reminder' | 'vl_due' | 'general';
    age_min?: number;
    age_max?: number;
    on_mmd?: boolean;
    days_before_appointment?: number;
  };
  language: 'en' | 'sn' | 'nd';
  scheduledAt?: string; // ISO timestamp; if omitted, send immediately
}

@Injectable()
export class SmsCampaignService {
  private readonly logger = new Logger(SmsCampaignService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly sms: SmsService,
    @InjectQueue('sms-dispatch') private readonly dispatchQueue: Queue,
  ) {}

  async createCampaign(dto: CreateCampaignDto, createdBy: string, tenantDb: string): Promise<{ id: string }> {
    const recipients = await this.resolveAudience(dto.audienceCriteria, tenantDb);

    const [campaign] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO sms_campaigns (name, message_template, audience_criteria, language, scheduled_at, status, total_recipients, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        dto.name,
        dto.messageTemplate,
        JSON.stringify(dto.audienceCriteria),
        dto.language,
        dto.scheduledAt ?? null,
        dto.scheduledAt ? 'scheduled' : 'sending',
        recipients.length,
        createdBy,
      ],
    );

    if (!dto.scheduledAt) {
      await this.dispatchQueue.add('bulk-send', {
        campaignId: campaign.id,
        tenantDb,
        recipients,
        template: dto.messageTemplate,
      }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    }

    return campaign;
  }

  async processScheduledCampaigns(tenantDb: string): Promise<void> {
    const due = await this.db.query<{ id: string; message_template: string }>(
      tenantDb,
      `SELECT id, message_template FROM sms_campaigns
       WHERE status = 'scheduled' AND scheduled_at <= NOW()`,
      [],
    );

    for (const campaign of due) {
      const criteria = await this.db.queryOne<{ audience_criteria: Record<string, unknown> }>(
        tenantDb,
        `SELECT audience_criteria FROM sms_campaigns WHERE id = $1`,
        [campaign.id],
      );
      const recipients = await this.resolveAudience(criteria!.audience_criteria as any, tenantDb);
      await this.db.query(
        tenantDb,
        `UPDATE sms_campaigns SET status = 'sending', sent_at = NOW(), total_recipients = $2 WHERE id = $1`,
        [campaign.id, recipients.length],
      );
      await this.dispatchQueue.add('bulk-send', {
        campaignId: campaign.id,
        tenantDb,
        recipients,
        template: campaign.message_template,
      });
    }
  }

  private async resolveAudience(
    criteria: CreateCampaignDto['audienceCriteria'],
    tenantDb: string,
  ): Promise<Array<{ patient_id: string; phone: string; name: string }>> {
    let sql = `
      SELECT p.id as patient_id, p.phone_number as phone,
             p.first_name || ' ' || p.last_name as name
      FROM patients p
      LEFT JOIN sms_opt_outs o ON o.phone_number = p.phone_number
      WHERE o.id IS NULL AND p.phone_number IS NOT NULL
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (criteria.age_min !== undefined) {
      sql += ` AND DATE_PART('year', AGE(p.date_of_birth)) >= $${idx++}`;
      params.push(criteria.age_min);
    }
    if (criteria.age_max !== undefined) {
      sql += ` AND DATE_PART('year', AGE(p.date_of_birth)) <= $${idx++}`;
      params.push(criteria.age_max);
    }
    if (criteria.on_mmd) {
      sql += ` AND EXISTS (SELECT 1 FROM hiv_mmd_schedules m WHERE m.patient_id = p.id AND m.is_active = true)`;
    }
    if (criteria.days_before_appointment !== undefined) {
      sql += ` AND EXISTS (
        SELECT 1 FROM appointments a WHERE a.patient_id = p.id
        AND a.appointment_date::date = CURRENT_DATE + $${idx++}
        AND a.status = 'scheduled'
      )`;
      params.push(criteria.days_before_appointment);
    }

    return this.db.query<{ patient_id: string; phone: string; name: string }>(tenantDb, sql, params);
  }

  async getCampaignStats(campaignId: string, tenantDb: string) {
    return this.db.queryOne(
      tenantDb,
      `SELECT c.*, 
              COUNT(d.id) FILTER (WHERE d.status = 'delivered') as actual_delivered,
              COUNT(d.id) FILTER (WHERE d.status = 'failed') as actual_failed
       FROM sms_campaigns c
       LEFT JOIN sms_dispatch_log d ON d.campaign_id = c.id
       WHERE c.id = $1 GROUP BY c.id`,
      [campaignId],
    );
  }
}
```

### 4.3 Bull Queue Processor
**File:** `services/ehr-service/src/processors/sms-dispatch.processor.ts`

```typescript
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { SmsService } from '../services/sms.service';
import { DatabaseService } from '../services/database.service';

interface BulkSendJob {
  campaignId: string;
  tenantDb: string;
  recipients: Array<{ patient_id: string; phone: string; name: string }>;
  template: string;
}

@Processor('sms-dispatch')
export class SmsDispatchProcessor {
  private readonly logger = new Logger(SmsDispatchProcessor.name);

  constructor(
    private readonly sms: SmsService,
    private readonly db: DatabaseService,
  ) {}

  @Process('bulk-send')
  async handleBulkSend(job: Job<BulkSendJob>): Promise<void> {
    const { campaignId, tenantDb, recipients, template } = job.data;

    for (const recipient of recipients) {
      const message = template
        .replace('{name}', recipient.name)
        .replace('{clinic}', 'Newlands Clinic');

      const logId = await this.insertDispatchLog(campaignId, recipient, message, tenantDb);

      try {
        const result = await this.sms.sendSms(recipient.phone, message);
        await this.updateDispatchLog(logId, 'sent', result.messageId, null, tenantDb);
        await this.db.query(
          tenantDb,
          `UPDATE sms_campaigns SET sent_count = sent_count + 1 WHERE id = $1`,
          [campaignId],
        );
      } catch (err: any) {
        this.logger.warn(`SMS failed for ${recipient.phone}: ${err.message} — trying Twilio fallback`);
        try {
          await this.sms.sendSmsFallback(recipient.phone, message);
          await this.updateDispatchLog(logId, 'sent', null, null, tenantDb, 'twilio');
        } catch (fallbackErr: any) {
          await this.updateDispatchLog(logId, 'failed', null, fallbackErr.message, tenantDb);
          await this.db.query(
            tenantDb,
            `UPDATE sms_campaigns SET failed_count = failed_count + 1 WHERE id = $1`,
            [campaignId],
          );
        }
      }

      await job.progress(Math.round((recipients.indexOf(recipient) / recipients.length) * 100));
    }

    await this.db.query(
      tenantDb,
      `UPDATE sms_campaigns SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [campaignId],
    );
  }

  private async insertDispatchLog(
    campaignId: string,
    recipient: { patient_id: string; phone: string },
    message: string,
    tenantDb: string,
  ): Promise<string> {
    const [row] = await this.db.query<{ id: string }>(
      tenantDb,
      `INSERT INTO sms_dispatch_log (campaign_id, patient_id, phone_number, message, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW()) RETURNING id`,
      [campaignId, recipient.patient_id, recipient.phone, message],
    );
    return row.id;
  }

  private async updateDispatchLog(
    logId: string,
    status: string,
    providerMessageId: string | null,
    errorMessage: string | null,
    tenantDb: string,
    provider = 'africastalking',
  ): Promise<void> {
    await this.db.query(
      tenantDb,
      `UPDATE sms_dispatch_log SET status = $2, provider_message_id = $3, error_message = $4,
       provider = $5, sent_at = NOW() WHERE id = $1`,
      [logId, status, providerMessageId, errorMessage, provider],
    );
  }
}
```

### 4.4 Adherence Nudge Scheduler
**File:** `services/ehr-service/src/services/adherence-nudge.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from './database.service';
import { SmsCampaignService } from './sms-campaign.service';
import { TenantService } from './tenant.service';

const NUDGE_TEMPLATES: Record<string, Record<string, string>> = {
  daily_reminder: {
    en: 'Hello {name}, this is your daily medication reminder from Newlands Clinic. Remember to take your ART today. Health is wealth!',
    sn: 'Mhoro {name}, chirango chako chemishonga yezuva nezuva kubva kuNewlands Clinic. Rangarira kutora mishonga yako yanhasi.',
    nd: 'Sawubona {name}, lesi yisikhumbuziso sakho semithi yamuhla esivela e-Newlands Clinic. Khumbula ukuthatja imithi yakho namhlanje.',
  },
  appointment_reminder: {
    en: 'Hi {name}, you have an appointment at Newlands Clinic on {date}. Please confirm via *123# or call 0800-NEWLANDS.',
    sn: 'Mhoro {name}, une musangano kuNewlands Clinic musi wa{date}. Ndokumbirawo usimbisi kuburikidza ne*123#.',
    nd: 'Sawubona {name}, ulemimangano e-Newlands Clinic ngomhla ka{date}. Sicela uqinisekise nge*123#.',
  },
  refill_reminder: {
    en: 'Hi {name}, your medication is due for refill soon. Dial *123# to request your refill or visit Newlands Clinic.',
    sn: 'Mhoro {name}, mishonga yako yasvika nguva yekugamuchira zvakare. Bhadha *123# kukumbira refill yako.',
    nd: 'Sawubona {name}, imithi yakho isiduze ukuphelelwa. Shayana *123# ukucela ukugcwaliswa kwayo.',
  },
};

@Injectable()
export class AdherenceNudgeService {
  private readonly logger = new Logger(AdherenceNudgeService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly campaigns: SmsCampaignService,
    private readonly tenantService: TenantService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async sendDailyNudges(): Promise<void> {
    const tenants = await this.tenantService.getActiveTenants();
    for (const tenant of tenants) {
      await this.sendNudgesForTenant(tenant.id, tenant.db_name);
    }
  }

  private async sendNudgesForTenant(tenantId: string, tenantDb: string): Promise<void> {
    const due = await this.db.query<{
      id: string;
      patient_id: string;
      nudge_type: string;
      language: string;
      phone_number: string;
      first_name: string;
    }>(
      tenantDb,
      `SELECT s.id, s.patient_id, s.nudge_type, s.language,
              p.phone_number, p.first_name
       FROM adherence_nudge_schedules s
       JOIN patients p ON p.id = s.patient_id
       LEFT JOIN sms_opt_outs o ON o.phone_number = p.phone_number
       WHERE s.is_active = true
         AND s.next_send_at <= NOW()
         AND o.id IS NULL
         AND p.phone_number IS NOT NULL`,
      [],
    );

    for (const nudge of due) {
      const templates = NUDGE_TEMPLATES[nudge.nudge_type] ?? NUDGE_TEMPLATES['daily_reminder'];
      const template = templates[nudge.language] ?? templates['en'];
      const message = template.replace('{name}', nudge.first_name);

      try {
        await this.campaigns.createCampaign(
          {
            name: `Auto nudge: ${nudge.nudge_type} - ${nudge.patient_id}`,
            messageTemplate: message,
            audienceCriteria: {},
            language: nudge.language as 'en' | 'sn' | 'nd',
          },
          'system',
          tenantDb,
        );

        const nextSend = this.calculateNextSend(nudge.nudge_type);
        await this.db.query(
          tenantDb,
          `UPDATE adherence_nudge_schedules SET last_sent_at = NOW(), next_send_at = $2 WHERE id = $1`,
          [nudge.id, nextSend],
        );
      } catch (err: any) {
        this.logger.error(`Failed to send nudge ${nudge.id}: ${err.message}`);
      }
    }
  }

  private calculateNextSend(nudgeType: string): Date {
    const now = new Date();
    switch (nudgeType) {
      case 'daily_reminder':
        now.setDate(now.getDate() + 1);
        break;
      case 'appointment_reminder':
        now.setDate(now.getDate() + 7);
        break;
      case 'refill_reminder':
        now.setDate(now.getDate() + 30);
        break;
      default:
        now.setDate(now.getDate() + 1);
    }
    return now;
  }

  async enrollPatientInNudges(
    patientId: string,
    nudgeType: string,
    language: 'en' | 'sn' | 'nd',
    tenantDb: string,
  ): Promise<void> {
    await this.db.query(
      tenantDb,
      `INSERT INTO adherence_nudge_schedules (patient_id, nudge_type, language, next_send_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 day')
       ON CONFLICT (patient_id, nudge_type) DO UPDATE SET
         language = EXCLUDED.language, is_active = true, updated_at = NOW()`,
      [patientId, nudgeType, language],
    );
  }
}
```

### 4.5 USSD Controller
**File:** `services/ehr-service/src/controllers/ussd.controller.ts`

```typescript
import { Controller, Post, Body, Headers, UseGuards, Get, Query, Param, Req } from '@nestjs/common';
import { UssdSessionService } from '../services/ussd-session.service';
import { SmsCampaignService, CreateCampaignDto } from '../services/sms-campaign.service';
import { AdherenceNudgeService } from '../services/adherence-nudge.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Request } from 'express';
import * as crypto from 'crypto';

// Africa's Talking USSD webhook — no JWT (external webhook)
@Controller('ussd')
export class UssdController {
  constructor(
    private readonly ussdSession: UssdSessionService,
    private readonly campaigns: SmsCampaignService,
    private readonly nudges: AdherenceNudgeService,
  ) {}

  @Post('callback')
  async handleUssdCallback(
    @Body() body: {
      sessionId: string;
      phoneNumber: string;
      serviceCode: string;
      text: string;
    },
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ): Promise<string> {
    const tenantDb = (req as any).tenantDb ?? tenantId;
    const response = await this.ussdSession.handleCallback(
      body.sessionId,
      body.phoneNumber,
      body.text,
      tenantDb,
    );

    // Africa's Talking expects plain text response starting with CON or END
    return response.text;
  }
}

// Authenticated campaign management endpoints
@Controller('sms')
@UseGuards(JwtAuthGuard)
export class SmsCampaignController {
  constructor(
    private readonly campaigns: SmsCampaignService,
    private readonly nudges: AdherenceNudgeService,
  ) {}

  @Post('campaigns')
  async createCampaign(
    @Body() dto: CreateCampaignDto,
    @Req() req: Request,
  ) {
    const { user, tenantDb } = req as any;
    return this.campaigns.createCampaign(dto, user.sub, tenantDb);
  }

  @Get('campaigns/:id/stats')
  async getCampaignStats(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.campaigns.getCampaignStats(id, (req as any).tenantDb);
  }

  @Post('nudges/enrol/:patientId')
  async enrolInNudges(
    @Param('patientId') patientId: string,
    @Body() body: { nudgeType: string; language: 'en' | 'sn' | 'nd' },
    @Req() req: Request,
  ) {
    await this.nudges.enrollPatientInNudges(
      patientId,
      body.nudgeType,
      body.language,
      (req as any).tenantDb,
    );
    return { enrolled: true };
  }
}
```

### 4.6 Register in `ehr.module.ts`
```typescript
// Add to imports:
BullModule.registerQueue({ name: 'sms-dispatch' }),

// Add to controllers array:
UssdController,
SmsCampaignController,

// Add to providers array:
UssdSessionService,
SmsCampaignService,
AdherenceNudgeService,
SmsDispatchProcessor,
```

### 4.7 Add `sendSmsFallback` to existing `SmsService`
**File:** `services/ehr-service/src/services/sms.service.ts` — add method:
```typescript
async sendSmsFallback(to: string, message: string): Promise<void> {
  // Twilio fallback — credentials from env TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
  const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  });
}
```

### 4.8 Add `phone_hash` column migration
In the provisioning bundle add to `patients` table — done via system-level `ensureSubscriptionSchema()`:
```typescript
// In tenant-service database-provisioning.service.ts, ensureSubscriptionSchema():
await db.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64)`);
await db.query(`CREATE INDEX IF NOT EXISTS idx_patients_phone_hash ON patients(phone_hash)`);
// Backfill:
await db.query(`UPDATE patients SET phone_hash = encode(sha256(phone_number::bytea), 'hex') WHERE phone_hash IS NULL AND phone_number IS NOT NULL`);
```

---

## 5. Frontend Implementation

### 5.1 SMS Campaign Manager Page
**File:** `ehr-frontend/src/pages/SmsCampaignPage.tsx`

Tabs:
1. **Campaigns** — table of campaigns with name, status, recipients, sent/failed counts, schedule date; "Create Campaign" button
2. **Create Campaign** — form: name, message template (with `{name}` preview), audience filters (age range, on MMD toggle, days before appointment), language selector (English/Shona/Ndebele), schedule date or "Send Now"
3. **Nudge Schedules** — per-patient nudge enrolment list; search patient; toggle nudge types on/off

### 5.2 USSD Menu Preview Component
**File:** `ehr-frontend/src/components/UssdMenuPreview.tsx`

Static visual diagram showing the USSD menu tree so clinic staff understand what patients see:
- Main Menu → (1) Appointments → View → Confirm/Reschedule
- Main Menu → (2) Refill → View regimen → Request/Visit
- Main Menu → (3) Results → Show latest lab
- Main Menu → (4) Opt Out → Confirm

---

## 6. Environment Variables Required

Add to `.env.example`:
```
AT_API_KEY=
AT_USERNAME=
AT_SHORTCODE=
AT_USSD_CODE=*123#
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
REDIS_URL=redis://localhost:6379
```

---

## 7. Tests Required

**File:** `services/ehr-service/src/services/__tests__/ussd-session.service.spec.ts`

```typescript
describe('UssdSessionService', () => {
  let service: UssdSessionService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    mockDb = { query: jest.fn(), queryOne: jest.fn() } as any;
    service = new UssdSessionService(mockDb);
  });

  it('returns CON main menu on empty text', async () => {
    mockDb.queryOne.mockResolvedValueOnce(null); // no expired sessions
    mockDb.query.mockResolvedValueOnce([{ session_id: 'sess1', current_state: 'MAIN_MENU', context: {}, patient_id: null }]);
    mockDb.queryOne.mockResolvedValueOnce(null); // no patient by phone

    const res = await service.handleCallback('sess1', '+263771234567', '', 'tenant_db');
    expect(res.continueSession).toBe(true);
    expect(res.text).toMatch(/CON Welcome/);
    expect(res.text).toContain('1. My next appointment');
  });

  it('transitions to APPOINTMENTS_VIEW on input "1"', async () => {
    const session = { session_id: 's1', current_state: 'MAIN_MENU', context: {}, patient_id: 'p1', is_active: true };
    mockDb.queryOne.mockResolvedValueOnce(session);
    mockDb.queryOne.mockResolvedValueOnce({ id: 'p1' }); // patient found
    mockDb.query.mockResolvedValue([]);
    mockDb.queryOne.mockResolvedValueOnce({
      id: 'a1', date: '2026-06-01', time: '09:00', provider_name: 'Dr Smith',
    });

    const res = await service.handleCallback('s1', '+263771234567', '1', 'tenant_db');
    expect(res.continueSession).toBe(true);
    expect(res.text).toMatch(/Your next appointment/);
  });

  it('confirms appointment on "1" in APPOINTMENTS_CONFIRM state', async () => {
    const session = {
      session_id: 's1', current_state: 'APPOINTMENTS_CONFIRM',
      context: { appointment_id: 'a1' }, patient_id: 'p1', is_active: true,
    };
    mockDb.queryOne.mockResolvedValueOnce(session);
    mockDb.queryOne.mockResolvedValueOnce({ id: 'p1' });
    mockDb.query.mockResolvedValue([]);

    const res = await service.handleCallback('s1', '+263771234567', '1*1', 'tenant_db');
    expect(res.continueSession).toBe(false);
    expect(res.text).toMatch(/END Thank you! Your appointment is confirmed/);
  });

  it('opts out on "4" then "1"', async () => {
    const session = {
      session_id: 's1', current_state: 'OPT_OUT_CONFIRM',
      context: {}, patient_id: 'p1', phone_number: '+263771234567', is_active: true,
    };
    mockDb.queryOne.mockResolvedValueOnce(session);
    mockDb.queryOne.mockResolvedValueOnce({ id: 'p1' });
    mockDb.query.mockResolvedValue([]);

    const res = await service.handleCallback('s1', '+263771234567', '4*1', 'tenant_db');
    expect(res.continueSession).toBe(false);
    expect(res.text).toMatch(/SMS reminders stopped/);
  });
});
```

**File:** `services/ehr-service/src/services/__tests__/sms-campaign.service.spec.ts`

```typescript
describe('SmsCampaignService', () => {
  it('resolves audience excluding opt-outs', async () => {
    // Verifies SQL excludes opted-out patients
    // Mock db returns 3 patients, 1 opted out => 2 recipients
  });

  it('dispatches bulk job immediately when no scheduledAt', async () => {
    // Verifies dispatchQueue.add called with 'bulk-send'
  });

  it('marks campaign as scheduled when scheduledAt provided', async () => {
    // Verifies status = 'scheduled' in INSERT
  });
});
```

---

## 8. Sign-off Criteria

- [ ] `npm run lint` passes zero errors in `services/ehr-service`
- [ ] `npm test` passes all tests including new USSD + campaign specs
- [ ] CI `build-and-test` job passes green
- [ ] `POST /api/admin/tenants/repair-all` backfills `ussd_sessions`, `sms_campaigns`, `sms_dispatch_log`, `sms_opt_outs`, `adherence_nudge_schedules`
- [ ] Africa's Talking USSD callback test: dial `*123#`, navigate full appointment confirm flow, session ends with `END` response
- [ ] Bulk campaign created, processed via Bull queue, dispatch log populated
- [ ] Opted-out patient excluded from campaign audience query
- [ ] Daily nudge cron fires at 07:00, sends SMS only to opted-in patients
- [ ] Twilio fallback triggered when Africa's Talking throws; dispatch log records provider = 'twilio'
