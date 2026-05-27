# S185 — AI Follow-up Scheduler & Care Continuity

**Phase:** 3 — Intelligence Layer  
**Effort:** M (4–5 days)  
**Depends on:** S167 (escalation routing), S173 (risk scores), S182 (care gaps)  
**Blocks:** nothing — final sprint in the 20-sprint block  

---

## Problem

After a clinical encounter, follow-up scheduling is manual and inconsistent. Clinicians must decide when to recall a patient, which modality to use (in-person vs telemedicine vs phone), and whether the care gap queue needs action. There is no AI-assisted recommendation engine for follow-up timing. High-risk patients frequently fall through the cracks between encounters.

---

## Goal

After every encounter (consultation, telemedicine call, or discharge):
1. AI analyses diagnosis severity, risk score, open care gaps, and medication changes
2. Recommends a follow-up interval (e.g. 7 days) and modality (in-person / telemedicine / phone)
3. Persists the recommendation to the DB for audit
4. Clinician reviews and accepts/overrides in EHR
5. Accepted recommendation creates a pending appointment reminder
6. Daily cron flags overdue follow-ups (no appointment booked within the window)
7. Mobile shows follow-up badges on patient cards

---

## Database Provisioning

Add to `getProvisioningBundles()` in  
`services/tenant-service/src/services/database-provisioning.service.ts`

```typescript
{
  id: 'followup_recommendations',
  version: '2026.05.27.2',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS followup_recommendations (
      id                  SERIAL PRIMARY KEY,
      patient_id          INTEGER     NOT NULL,
      encounter_id        INTEGER,
      encounter_type      TEXT        NOT NULL DEFAULT 'consultation',
      recommended_days    INTEGER     NOT NULL,
      recommended_modality TEXT       NOT NULL DEFAULT 'in_person',
      urgency             TEXT        NOT NULL DEFAULT 'routine',
      reasoning           TEXT,
      ai_source           TEXT        NOT NULL DEFAULT 'rule',
      clinician_override_days     INTEGER,
      clinician_override_modality TEXT,
      accepted_by         INTEGER,
      accepted_at         TIMESTAMPTZ,
      dismissed_by        INTEGER,
      dismissed_at        TIMESTAMPTZ,
      appointment_booked  BOOLEAN     NOT NULL DEFAULT FALSE,
      appointment_due_by  TIMESTAMPTZ,
      overdue_alerted     BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_followup_patient
       ON followup_recommendations(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_followup_due
       ON followup_recommendations(appointment_due_by)
       WHERE appointment_booked = FALSE AND dismissed_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_followup_encounter
       ON followup_recommendations(encounter_id)`,
  ],
},
```

---

## Recommendation Logic

### Interval Matrix

| Risk Band | Encounter Type | Diagnoses Contains | Days | Modality |
|-----------|---------------|-------------------|------|----------|
| critical  | any           | any               | 2    | in_person |
| high      | consultation  | any               | 7    | in_person |
| high      | telemedicine  | any               | 7    | in_person |
| moderate  | consultation  | cancer / HIV / TB | 14   | in_person |
| moderate  | consultation  | chronic other     | 21   | telemedicine |
| low       | telemedicine  | any               | 30   | phone |
| low       | consultation  | any               | 30   | telemedicine |
| any       | discharge     | any               | 7    | in_person |

### Urgency

- `critical` or recommended_days ≤ 3 → urgency = `urgent`
- recommended_days ≤ 14 → urgency = `soon`
- else → urgency = `routine`

---

## Backend — FollowUpRecommendationService

**File:** `services/ehr-service/src/services/followup-recommendation.service.ts`

```typescript
import { Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';
import { AbstentionLogService } from './abstention-log.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { TenantContextService } from './tenant-context.service';

export type Modality = 'in_person' | 'telemedicine' | 'phone';
export type Urgency = 'urgent' | 'soon' | 'routine';

export interface FollowUpRecommendation {
  id: number;
  patientId: number;
  recommendedDays: number;
  recommendedModality: Modality;
  urgency: Urgency;
  reasoning: string;
  aiSource: string;
}

@Injectable()
export class FollowUpRecommendationService {
  constructor(
    @Optional() private readonly llm: PostVisitGroundedLlmService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
    @Optional() private readonly alertDelivery: AlertDeliveryService,
    @Optional() private readonly tenantContext: TenantContextService,
  ) {}

  async generateRecommendation(
    db: any,
    params: {
      patientId: number;
      encounterId?: number;
      encounterType: 'consultation' | 'telemedicine' | 'discharge';
      riskBand: 'low' | 'moderate' | 'high' | 'critical';
      diagnoses: string[];
      openCareGapsCount: number;
      medicationsChanged: boolean;
      subdomain: string;
    },
  ): Promise<FollowUpRecommendation> {
    const {
      patientId, encounterId, encounterType, riskBand, diagnoses,
      openCareGapsCount, medicationsChanged, subdomain,
    } = params;

    const { days, modality } = this.computeInterval(riskBand, encounterType, diagnoses);
    let reasoning = this.buildBaseReasoning(riskBand, encounterType, diagnoses, medicationsChanged, openCareGapsCount);
    let aiSource = 'rule';

    // Try LLM to enrich reasoning narrative
    if (this.llm) {
      try {
        const enriched = await this.llm.polishDoctorContent(
          `Follow-up recommendation for patient. Risk band: ${riskBand}. ` +
          `Encounter type: ${encounterType}. Diagnoses: ${diagnoses.slice(0, 5).join(', ')}. ` +
          `Recommended: ${days} days, ${modality}. Open care gaps: ${openCareGapsCount}. ` +
          `Medications changed: ${medicationsChanged}. ` +
          `Write 1-2 sentences explaining why this follow-up schedule is appropriate.`,
          'followup_reasoning',
        );
        if (enriched && enriched.length > 20) {
          reasoning = enriched.trim();
          aiSource = 'llm';
        }
      } catch {
        // Rule-based reasoning already set
      }
    }

    const urgency = this.computeUrgency(riskBand, days);
    const dueBy = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const rows = await db.query(
      `INSERT INTO followup_recommendations
         (patient_id, encounter_id, encounter_type, recommended_days,
          recommended_modality, urgency, reasoning, ai_source, appointment_due_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [patientId, encounterId ?? null, encounterType, days, modality,
       urgency, reasoning, aiSource, dueBy],
    );

    return {
      id: rows[0].id,
      patientId,
      recommendedDays: days,
      recommendedModality: modality,
      urgency,
      reasoning,
      aiSource,
    };
  }

  async acceptRecommendation(
    db: any,
    id: number,
    acceptedBy: number,
    override?: { days?: number; modality?: string },
  ): Promise<void> {
    const effectiveDays = override?.days ?? null;
    const effectiveModality = override?.modality ?? null;
    const dueByUpdate = effectiveDays
      ? `appointment_due_by = NOW() + ($4 * INTERVAL '1 day'),`
      : '';

    await db.query(
      `UPDATE followup_recommendations
         SET accepted_by = $1, accepted_at = NOW(),
             clinician_override_days = $2,
             clinician_override_modality = $3,
             ${dueByUpdate}
             updated_at = NOW()
       WHERE id = $${effectiveDays ? 5 : 4}`,
      effectiveDays
        ? [acceptedBy, effectiveDays, effectiveModality, effectiveDays, id]
        : [acceptedBy, effectiveDays, effectiveModality, id],
    );
  }

  async dismissRecommendation(db: any, id: number, dismissedBy: number): Promise<void> {
    await db.query(
      `UPDATE followup_recommendations
         SET dismissed_by = $1, dismissed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [dismissedBy, id],
    );
  }

  async markAppointmentBooked(db: any, recommendationId: number): Promise<void> {
    await db.query(
      `UPDATE followup_recommendations
         SET appointment_booked = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [recommendationId],
    );
  }

  async getPatientRecommendations(db: any, patientId: number): Promise<any[]> {
    return db.query(
      `SELECT * FROM followup_recommendations
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT 10`,
      [patientId],
    );
  }

  async getOverdueFollowUps(db: any): Promise<any[]> {
    return db.query(
      `SELECT fr.*, p.full_name, p.mrn
         FROM followup_recommendations fr
         JOIN patients p ON p.id = fr.patient_id
        WHERE fr.appointment_booked = FALSE
          AND fr.dismissed_at IS NULL
          AND fr.accepted_at IS NOT NULL
          AND fr.appointment_due_by < NOW()
          AND fr.overdue_alerted = FALSE
        ORDER BY fr.urgency DESC, fr.appointment_due_by ASC`,
      [],
    );
  }

  @Cron('0 7 * * *')
  async sweepOverdueFollowUps(): Promise<void> {
    if (!this.tenantContext) return;
    const tenants = await this.tenantContext.getAllActiveTenants();
    for (const tenant of tenants) {
      try {
        const overdue = await this.getOverdueFollowUps(tenant.db);
        for (const row of overdue) {
          await this.alertDelivery?.broadcastCriticalAlert(tenant.subdomain, {
            alertType: 'overdue_followup',
            sourceEntityId: row.id,
            patientId: row.patient_id,
            severity: row.urgency === 'urgent' ? 'critical' : 'high',
            message: `Overdue follow-up: ${row.full_name} (MRN ${row.mrn}) — ` +
                     `was due ${new Date(row.appointment_due_by).toLocaleDateString()}`,
          });
          await tenant.db.query(
            `UPDATE followup_recommendations
               SET overdue_alerted = TRUE, updated_at = NOW()
             WHERE id = $1`,
            [row.id],
          );
        }
      } catch {
        // Continue to next tenant
      }
    }
  }

  private computeInterval(
    risk: string, encounterType: string, diagnoses: string[],
  ): { days: number; modality: Modality } {
    if (risk === 'critical') return { days: 2, modality: 'in_person' };
    if (encounterType === 'discharge') return { days: 7, modality: 'in_person' };
    if (risk === 'high') return { days: 7, modality: 'in_person' };

    const seriousDx = diagnoses.some(d => {
      const l = d.toLowerCase();
      return l.includes('cancer') || l.includes('hiv') || l.includes('tb') ||
             l.includes('tuberculosis') || l.includes('lymphoma') || l.includes('leukemia');
    });

    if (risk === 'moderate' && seriousDx) return { days: 14, modality: 'in_person' };
    if (risk === 'moderate') return { days: 21, modality: 'telemedicine' };
    if (encounterType === 'telemedicine') return { days: 30, modality: 'phone' };
    return { days: 30, modality: 'telemedicine' };
  }

  private computeUrgency(risk: string, days: number): Urgency {
    if (risk === 'critical' || days <= 3) return 'urgent';
    if (days <= 14) return 'soon';
    return 'routine';
  }

  private buildBaseReasoning(
    risk: string, encounterType: string, diagnoses: string[],
    medicationsChanged: boolean, openGaps: number,
  ): string {
    const parts: string[] = [];
    if (risk === 'critical' || risk === 'high') parts.push(`Patient is ${risk}-risk.`);
    if (encounterType === 'discharge') parts.push('Post-discharge follow-up required.');
    if (medicationsChanged) parts.push('Medications were adjusted this encounter.');
    if (openGaps > 0) parts.push(`${openGaps} open care gap(s) require monitoring.`);
    if (diagnoses.length) parts.push(`Active diagnoses: ${diagnoses.slice(0, 3).join(', ')}.`);
    return parts.join(' ') || 'Routine follow-up as per clinical protocol.';
  }
}
```

---

## Backend — FollowUpController

**File:** `services/ehr-service/src/controllers/followup.controller.ts`

```typescript
import {
  Controller, Post, Get, Patch, Body, Param, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { FollowUpRecommendationService } from '../services/followup-recommendation.service';

@UseGuards(JwtAuthGuard)
@Controller('followup')
export class FollowUpController {
  constructor(private readonly svc: FollowUpRecommendationService) {}

  @Post('recommend')
  async recommend(
    @Req() req: any,
    @Body()
    body: {
      patientId: number;
      encounterId?: number;
      encounterType: 'consultation' | 'telemedicine' | 'discharge';
      riskBand: 'low' | 'moderate' | 'high' | 'critical';
      diagnoses: string[];
      openCareGapsCount: number;
      medicationsChanged: boolean;
    },
  ) {
    return this.svc.generateRecommendation(req.tenantDb, {
      ...body,
      subdomain: req.tenantSubdomain,
    });
  }

  @Patch(':id/accept')
  async accept(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { overrideDays?: number; overrideModality?: string },
  ) {
    await this.svc.acceptRecommendation(
      req.tenantDb,
      parseInt(id),
      req.user.sub,
      body.overrideDays || body.overrideModality
        ? { days: body.overrideDays, modality: body.overrideModality }
        : undefined,
    );
    return { ok: true };
  }

  @Patch(':id/dismiss')
  async dismiss(@Req() req: any, @Param('id') id: string) {
    await this.svc.dismissRecommendation(req.tenantDb, parseInt(id), req.user.sub);
    return { ok: true };
  }

  @Patch(':id/booked')
  async markBooked(@Req() req: any, @Param('id') id: string) {
    await this.svc.markAppointmentBooked(req.tenantDb, parseInt(id));
    return { ok: true };
  }

  @Get('patient/:patientId')
  async patientHistory(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientRecommendations(req.tenantDb, parseInt(patientId));
  }

  @Get('overdue')
  async overdue(@Req() req: any) {
    return this.svc.getOverdueFollowUps(req.tenantDb);
  }
}
```

---

## EHR React Component — FollowUpRecommendationPanel

**File:** `ehr-frontend/src/components/FollowUpRecommendationPanel.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import AiStatusBadge from './AiStatusBadge';

interface Recommendation {
  id: number;
  recommendedDays: number;
  recommendedModality: string;
  urgency: string;
  reasoning: string;
  aiSource: string;
  acceptedAt?: string;
  dismissedAt?: string;
  appointmentBooked: boolean;
  appointmentDueBy?: string;
}

interface Props {
  patientId: number;
  encounterId?: number;
  encounterType: 'consultation' | 'telemedicine' | 'discharge';
  riskBand: 'low' | 'moderate' | 'high' | 'critical';
  diagnoses: string[];
  openCareGapsCount: number;
  medicationsChanged: boolean;
}

const URGENCY_COLOR: Record<string, string> = {
  urgent: '#dc2626',
  soon: '#d97706',
  routine: '#2563eb',
};

const MODALITY_LABEL: Record<string, string> = {
  in_person: 'In-Person',
  telemedicine: 'Telemedicine',
  phone: 'Phone',
};

export default function FollowUpRecommendationPanel({
  patientId, encounterId, encounterType, riskBand, diagnoses,
  openCareGapsCount, medicationsChanged,
}: Props) {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideDays, setOverrideDays] = useState('');
  const [overrideModality, setOverrideModality] = useState('');

  useEffect(() => {
    void generate();
  }, [patientId]);

  async function generate() {
    setLoading(true);
    try {
      const data = await api.post('/followup/recommend', {
        patientId, encounterId, encounterType, riskBand,
        diagnoses, openCareGapsCount, medicationsChanged,
      });
      setRec(data);
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!rec) return;
    const override = (overrideDays || overrideModality)
      ? { overrideDays: overrideDays ? parseInt(overrideDays) : undefined, overrideModality: overrideModality || undefined }
      : undefined;
    await api.patch(`/followup/${rec.id}/accept`, override ?? {});
    setRec(r => r ? { ...r, acceptedAt: new Date().toISOString() } : r);
  }

  async function dismiss() {
    if (!rec) return;
    await api.patch(`/followup/${rec.id}/dismiss`, {});
    setRec(r => r ? { ...r, dismissedAt: new Date().toISOString() } : r);
  }

  if (loading) {
    return (
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8 }}>
        <AiStatusBadge status="loading" />
        <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 14 }}>
          Generating follow-up recommendation…
        </span>
      </div>
    );
  }

  if (!rec) return null;

  const urgencyColor = URGENCY_COLOR[rec.urgency] ?? '#2563eb';
  const accepted = !!rec.acceptedAt;
  const dismissed = !!rec.dismissedAt;

  return (
    <div style={{
      border: `2px solid ${urgencyColor}`, borderRadius: 10, padding: 16,
      background: dismissed ? '#f9fafb' : '#fff', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>AI Follow-up Recommendation</h4>
          <AiStatusBadge status={dismissed ? 'abstained' : accepted ? 'active' : 'active'} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#fff',
          background: urgencyColor, padding: '2px 10px', borderRadius: 10,
          textTransform: 'uppercase',
        }}>
          {rec.urgency}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Recommended in</span>
          <div style={{ fontSize: 22, fontWeight: 800, color: urgencyColor }}>
            {rec.recommendedDays}d
          </div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Modality</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
            {MODALITY_LABEL[rec.recommendedModality] ?? rec.recommendedModality}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>AI Source</span>
          <div style={{ fontSize: 13, color: '#374151' }}>
            {rec.aiSource === 'llm' ? 'AI-enriched' : rec.aiSource === 'rule' ? 'Protocol rules' : rec.aiSource}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px', lineHeight: 1.5 }}>
        {rec.reasoning}
      </p>

      {!accepted && !dismissed && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="number"
              placeholder="Override days"
              value={overrideDays}
              onChange={e => setOverrideDays(e.target.value)}
              style={{
                width: 120, padding: '6px 10px', border: '1px solid #d1d5db',
                borderRadius: 6, fontSize: 13,
              }}
            />
            <select
              value={overrideModality}
              onChange={e => setOverrideModality(e.target.value)}
              style={{
                padding: '6px 10px', border: '1px solid #d1d5db',
                borderRadius: 6, fontSize: 13,
              }}
            >
              <option value="">Original modality</option>
              <option value="in_person">In-Person</option>
              <option value="telemedicine">Telemedicine</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={accept}
              style={{
                flex: 1, padding: '9px 0', background: '#16a34a', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Accept & Schedule
            </button>
            <button
              onClick={dismiss}
              style={{
                padding: '9px 16px', background: '#f3f4f6', border: '1px solid #d1d5db',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}

      {accepted && (
        <div style={{
          padding: '8px 12px', background: '#f0fdf4', borderRadius: 8,
          border: '1px solid #bbf7d0', fontSize: 13, color: '#16a34a', fontWeight: 600,
        }}>
          ✓ Accepted — follow-up scheduled
          {rec.appointmentDueBy && (
            <span style={{ fontWeight: 400, color: '#374151' }}>
              {' '}(due by {new Date(rec.appointmentDueBy).toLocaleDateString()})
            </span>
          )}
        </div>
      )}

      {dismissed && (
        <div style={{
          padding: '8px 12px', background: '#fef9c3', borderRadius: 8,
          border: '1px solid #fde68a', fontSize: 13, color: '#92400e',
        }}>
          Recommendation dismissed
        </div>
      )}
    </div>
  );
}
```

---

## Mobile Component — FollowUpBadge

**File:** `mobile/src/components/FollowUpBadge.tsx`

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS, SPACING } from '../design-tokens';

interface Props {
  days: number;
  modality: string;
  urgency: 'urgent' | 'soon' | 'routine';
  overdue?: boolean;
}

const URGENCY_BG: Record<string, string> = {
  urgent: C.red,
  soon: C.amber,
  routine: C.blue,
};

const MODALITY_ICON: Record<string, string> = {
  in_person: '🏥',
  telemedicine: '📹',
  phone: '📞',
};

export default function FollowUpBadge({ days, modality, urgency, overdue }: Props) {
  const bg = overdue ? C.red : URGENCY_BG[urgency] ?? C.blue;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.icon}>{MODALITY_ICON[modality] ?? '📅'}</Text>
      <Text style={styles.label}>
        {overdue ? 'OVERDUE' : `${days}d`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    gap: 3,
  },
  icon: { fontSize: 11 },
  label: {
    fontFamily: FONT.uiBd,
    fontSize: 11,
    color: '#fff',
  },
});
```

**Usage in patient list row (mobile):**
```tsx
{patient.followUp && (
  <FollowUpBadge
    days={patient.followUp.recommendedDays}
    modality={patient.followUp.recommendedModality}
    urgency={patient.followUp.urgency}
    overdue={patient.followUp.overdue}
  />
)}
```

---

## Mobile Screen — OverdueFollowUpsScreen

**File:** `mobile/src/screens/OverdueFollowUpsScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW, SPACING } from '../design-tokens';
import AiStatusChip from '../components/AiStatusChip';
import api from '../services/api';

interface OverdueItem {
  id: number;
  patientId: number;
  fullName: string;
  mrn: string;
  urgency: string;
  recommendedDays: number;
  recommendedModality: string;
  appointmentDueBy: string;
  reasoning: string;
}

export default function OverdueFollowUpsScreen() {
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/followup/overdue')
      .then((data: any[]) => setItems(data.map(d => ({
        id: d.id,
        patientId: d.patient_id,
        fullName: d.full_name,
        mrn: d.mrn,
        urgency: d.urgency,
        recommendedDays: d.recommended_days,
        recommendedModality: d.recommended_modality,
        appointmentDueBy: d.appointment_due_by,
        reasoning: d.reasoning,
      }))))
      .finally(() => setLoading(false));
  }, []);

  function urgencyColor(u: string) {
    if (u === 'urgent') return C.red;
    if (u === 'soon') return C.amber;
    return C.blue;
  }

  function renderItem({ item }: { item: OverdueItem }) {
    const color = urgencyColor(item.urgency);
    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardRow}>
          <Text style={styles.name}>{item.fullName}</Text>
          <Text style={[styles.urgencyBadge, { backgroundColor: color }]}>
            {item.urgency.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.mrn}>MRN {item.mrn}</Text>
        <Text style={styles.meta}>
          Due {new Date(item.appointmentDueBy).toLocaleDateString()} ·{' '}
          {item.recommendedModality.replace('_', '-')}
        </Text>
        <Text style={styles.reason} numberOfLines={2}>{item.reasoning}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.blue} />
        <AiStatusChip status="loading" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Overdue Follow-Ups</Text>
        <AiStatusChip status="active" />
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>No overdue follow-ups today.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: SPACING.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title: { fontFamily: FONT.uiBd, fontSize: 18, color: C.text },
  card: {
    backgroundColor: C.surface, borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.sm, borderLeftWidth: 4, ...SHADOW.sm,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: FONT.uiBd, fontSize: 15, color: C.text, flex: 1 },
  urgencyBadge: {
    fontSize: 10, fontFamily: FONT.uiBd, color: '#fff',
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.sm,
  },
  mrn: { fontSize: 12, color: C.subtext, marginTop: 2 },
  meta: { fontSize: 12, color: C.subtext, marginTop: 2 },
  reason: { fontSize: 12, color: C.text, marginTop: 4, lineHeight: 17 },
  empty: { textAlign: 'center', color: C.muted, marginTop: SPACING.xl, fontStyle: 'italic' },
});
```

---

## i18n Keys

```json
{
  "followup": {
    "title": "AI Follow-up Recommendation",
    "recommended_in": "Recommended in",
    "modality": "Modality",
    "source": "AI Source",
    "urgency_urgent": "Urgent",
    "urgency_soon": "Soon",
    "urgency_routine": "Routine",
    "modality_in_person": "In-Person",
    "modality_telemedicine": "Telemedicine",
    "modality_phone": "Phone",
    "accept": "Accept & Schedule",
    "dismiss": "Dismiss",
    "accepted": "Accepted — follow-up scheduled",
    "dismissed": "Recommendation dismissed",
    "override_days": "Override days",
    "override_modality": "Override modality",
    "overdue_title": "Overdue Follow-Ups",
    "no_overdue": "No overdue follow-ups today.",
    "generating": "Generating follow-up recommendation…"
  }
}
```

| Key | sn | nd | pt | fr | sw | zu | af |
|-----|----|----|----|----|----|----|-----|
| title | AI Kudzoka Chiremba | AI Ukubuya Kodokotela | Recomendação de Acompanhamento IA | Recommandation de Suivi IA | Ushauri wa Ufuatiliaji wa AI | Isiluleko Sokulandela se-AI | AI Opvolgaanbeveling |
| accept | Samukira & Rongesa | Yamukela & Beka | Aceitar e Agendar | Accepter et Planifier | Kubali na Ratiba | Amukela Uhlele | Aanvaar en Skeduleer |
| overdue_title | Mafuatirwo Akudonhedza | Ukukubuya Okulate | Acompanhamentos em Atraso | Suivis en Retard | Ufuatiliaji Uliochelewa | Ukubuya Okuphelelwe Yisikhathi | Agterstallige Opvolging |
| no_overdue | Hapana mafuatirwo akudonhedza nhasi. | Akukho ukubuya okulate namhlanje. | Sem acompanhamentos atrasados hoje. | Aucun suivi en retard aujourd'hui. | Hakuna ufuatiliaji uliochelewa leo. | Akukho ukubuya okuphelelwe yisikhathi namhlanje. | Geen agterstallige opvolging vandag nie. |

---

## Module Registration

**File:** `services/ehr-service/src/ehr.module.ts`

```typescript
import { FollowUpRecommendationService } from './services/followup-recommendation.service';
import { FollowUpController } from './controllers/followup.controller';

// In @Module:
providers: [...existingProviders, FollowUpRecommendationService],
controllers: [...existingControllers, FollowUpController],
```

---

## Jest Spec

**File:** `services/ehr-service/src/services/followup-recommendation.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { FollowUpRecommendationService } from './followup-recommendation.service';

describe('FollowUpRecommendationService', () => {
  let svc: FollowUpRecommendationService;
  let db: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [FollowUpRecommendationService],
    }).compile();
    svc = module.get(FollowUpRecommendationService);
    db = { query: jest.fn().mockResolvedValue([{ id: 42 }]) };
  });

  it('recommends 2-day in-person for critical risk', async () => {
    const res = await svc.generateRecommendation(db, {
      patientId: 1, encounterType: 'consultation',
      riskBand: 'critical', diagnoses: [],
      openCareGapsCount: 0, medicationsChanged: false,
      subdomain: 'test',
    });
    expect(res.recommendedDays).toBe(2);
    expect(res.recommendedModality).toBe('in_person');
    expect(res.urgency).toBe('urgent');
  });

  it('recommends 7-day in-person for discharge', async () => {
    const res = await svc.generateRecommendation(db, {
      patientId: 2, encounterType: 'discharge',
      riskBand: 'low', diagnoses: [],
      openCareGapsCount: 0, medicationsChanged: false,
      subdomain: 'test',
    });
    expect(res.recommendedDays).toBe(7);
    expect(res.recommendedModality).toBe('in_person');
  });

  it('recommends 14-day in-person for moderate risk with cancer dx', async () => {
    const res = await svc.generateRecommendation(db, {
      patientId: 3, encounterType: 'consultation',
      riskBand: 'moderate', diagnoses: ['Breast cancer'],
      openCareGapsCount: 1, medicationsChanged: true,
      subdomain: 'test',
    });
    expect(res.recommendedDays).toBe(14);
    expect(res.recommendedModality).toBe('in_person');
  });

  it('persists recommendation to DB', async () => {
    await svc.generateRecommendation(db, {
      patientId: 4, encounterType: 'telemedicine',
      riskBand: 'low', diagnoses: [],
      openCareGapsCount: 0, medicationsChanged: false,
      subdomain: 'test',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO followup_recommendations'),
      expect.any(Array),
    );
  });

  it('accepts recommendation and updates DB', async () => {
    await svc.acceptRecommendation(db, 42, 99);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE followup_recommendations'),
      expect.arrayContaining([99]),
    );
  });
});
```

---

## Acceptance Criteria

1. `POST /followup/recommend` with `{ patientId, encounterType: 'discharge', riskBand: 'low', ... }` returns `recommendedDays: 7`, `recommendedModality: 'in_person'`, `urgency: 'soon'`.
2. `POST /followup/recommend` with `riskBand: 'critical'` returns `recommendedDays: 2`, `urgency: 'urgent'`.
3. `PATCH /followup/:id/accept` sets `accepted_at` and `accepted_by` in DB; returns `{ ok: true }`.
4. `PATCH /followup/:id/accept` with `{ overrideDays: 5 }` updates `clinician_override_days = 5` and recalculates `appointment_due_by`.
5. `PATCH /followup/:id/dismiss` sets `dismissed_at` and `dismissed_by`.
6. `GET /followup/overdue` returns only rows where `appointment_booked = FALSE`, `dismissed_at IS NULL`, `accepted_at IS NOT NULL`, `appointment_due_by < NOW()`.
7. Daily cron at 07:00 sends a `broadcastCriticalAlert` for each overdue row and sets `overdue_alerted = TRUE`.
8. EHR `FollowUpRecommendationPanel` auto-generates recommendation on mount, shows days/modality/urgency, allows override inputs, accept button calls `PATCH /:id/accept`.
9. Mobile `FollowUpBadge` uses `C.red/amber/blue` for urgency colours and `FONT.uiBd` for labels.
10. `followup_recommendations` table is created by provisioning bundle `2026.05.27.2` using `CREATE TABLE IF NOT EXISTS`.
11. All 8 i18n locale files have `followup.*` keys.

---

## Definition of Done

- [ ] DB provisioning bundle added with `CREATE TABLE IF NOT EXISTS` and indexes
- [ ] `FollowUpRecommendationService` uses `@Optional()` on all AI dependencies
- [ ] Interval matrix covers all risk bands × encounter types × diagnosis flags
- [ ] LLM enriches reasoning narrative; falls back to rule-based string when unavailable
- [ ] Daily cron (`0 7 * * *`) iterates all tenants via `TenantContextService`; alerts only unalerted overdue rows
- [ ] Alert deduplication via `overdue_alerted = TRUE` flag
- [ ] Controller guards: `@UseGuards(JwtAuthGuard)`, uses `req.tenantDb`, `req.user.sub`
- [ ] EHR panel: auto-generates on mount, override inputs, accept/dismiss flow, accepted/dismissed state indicators
- [ ] Mobile `FollowUpBadge` and `OverdueFollowUpsScreen` use design tokens throughout
- [ ] All 8 i18n locale files updated with `followup.*` keys
- [ ] Module registration complete (providers + controllers)
- [ ] Jest spec: 5 tests passing, no stubs
- [ ] Reviewer certification signed off
