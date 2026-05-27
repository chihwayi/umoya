# Sprint S167 — Post-Visit Escalation Routing

## Sprint Goal
The `PostVisitGroundedLlmService.classifyEscalationSignal()` method identifies urgent clinical findings in post-visit notes but the result is never acted upon. This sprint wires the escalation output into: (1) a nurse task created via DB insert, (2) an `AlertDeliveryService.broadcastCriticalAlert()` call, and (3) a new `post_visit_escalations` DB table that tracks every escalation lifecycle from detected → routed → acknowledged → resolved.

## Prerequisites
- S166 must be complete (AlertDeliveryService wiring pattern established)

---

## Step 1 — Database Provisioning

**File:** `services/tenant-service/src/services/database-provisioning.service.ts`

Add inside `getProvisioningBundles()` array:

```typescript
{
  id: 'post_visit_escalations',
  label: 'Post-Visit AI Escalation Routing',
  version: '2026.05.27.1',
  description: 'Tracks escalation signals from AI post-visit classification — routed to nurse tasks and alerts',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS post_visit_escalations (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      post_visit_session_id UUID      NOT NULL,
      patient_id          UUID        NOT NULL,
      escalation_level    VARCHAR(16) NOT NULL DEFAULT 'moderate',
      signal_summary      TEXT        NOT NULL,
      detected_findings   JSONB       NOT NULL DEFAULT '[]',
      routed_to_user_id   UUID,
      routed_to_role      VARCHAR(32),
      nurse_task_id       UUID,
      alert_delivery_id   UUID,
      status              VARCHAR(16) NOT NULL DEFAULT 'detected',
      acknowledged_at     TIMESTAMPTZ,
      acknowledged_by     UUID,
      resolved_at         TIMESTAMPTZ,
      resolved_by         UUID,
      resolution_note     TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pve_patient ON post_visit_escalations (patient_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_pve_status ON post_visit_escalations (status) WHERE status IN ('detected','routed')`,
    `CREATE INDEX IF NOT EXISTS idx_pve_session ON post_visit_escalations (post_visit_session_id)`,
    `CREATE TABLE IF NOT EXISTS nurse_tasks (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID        NOT NULL,
      task_type       VARCHAR(64) NOT NULL,
      title           VARCHAR(255) NOT NULL,
      description     TEXT,
      priority        VARCHAR(16) NOT NULL DEFAULT 'normal',
      source          VARCHAR(64) NOT NULL DEFAULT 'manual',
      source_entity_id UUID,
      assigned_to     UUID,
      status          VARCHAR(16) NOT NULL DEFAULT 'open',
      due_at          TIMESTAMPTZ,
      completed_at    TIMESTAMPTZ,
      completed_by    UUID,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_patient ON nurse_tasks (patient_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_open ON nurse_tasks (status, priority, created_at) WHERE status = 'open'`,
    `CREATE INDEX IF NOT EXISTS idx_nurse_tasks_source ON nurse_tasks (source, source_entity_id)`,
  ],
},
```

---

## Step 2 — New PostVisitEscalationRoutingService

Create a new file:

**File:** `services/ehr-service/src/services/post-visit-escalation-routing.service.ts`

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { AlertDeliveryService, AlertPayload } from './alert-delivery.service';
import { TenantService } from './tenant.service';

export interface EscalationSignal {
  escalationLevel: 'low' | 'moderate' | 'high' | 'critical';
  summary: string;
  findings: string[];
  recommendedAction?: string;
}

@Injectable()
export class PostVisitEscalationRoutingService {
  private readonly logger = new Logger(PostVisitEscalationRoutingService.name);

  constructor(
    @Optional() private readonly alertDelivery: AlertDeliveryService,
    @Optional() private readonly tenantService: TenantService,
  ) {}

  /**
   * Route an escalation signal from the post-visit AI classifier.
   * Creates a nurse task in the DB, delivers an alert, and records the escalation lifecycle row.
   *
   * @param sessionId   post_visit_sessions.id
   * @param patientId   UUID of the patient
   * @param signal      structured output from classifyEscalationSignal()
   * @param db          tenant DB connection (req.tenantDb)
   */
  async routeEscalation(
    sessionId: string,
    patientId: string,
    signal: EscalationSignal,
    db: any,
  ): Promise<string | null> {
    if (signal.escalationLevel === 'low') {
      this.logger.debug(`Escalation level low for session ${sessionId} — skipping routing`);
      return null;
    }

    // 1. Create nurse task
    const taskPriority = signal.escalationLevel === 'critical' ? 'urgent'
      : signal.escalationLevel === 'high' ? 'high'
      : 'normal';

    const [task] = await db.query(
      `INSERT INTO nurse_tasks
         (patient_id, task_type, title, description, priority, source, source_entity_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       RETURNING id`,
      [
        patientId,
        'post_visit_escalation',
        `Post-Visit Escalation: ${signal.escalationLevel.toUpperCase()}`,
        `${signal.summary}\n\nFindings:\n${signal.findings.map(f => `• ${f}`).join('\n')}`,
        taskPriority,
        'post_visit_ai',
        sessionId,
      ],
    );

    const taskId: string = task?.id ?? null;

    // 2. Create escalation record
    const [esc] = await db.query(
      `INSERT INTO post_visit_escalations
         (post_visit_session_id, patient_id, escalation_level, signal_summary,
          detected_findings, nurse_task_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'routed')
       RETURNING id`,
      [
        sessionId,
        patientId,
        signal.escalationLevel,
        signal.summary,
        JSON.stringify(signal.findings),
        taskId,
      ],
    );

    const escalationId: string = esc?.id ?? null;

    // 3. Broadcast alert for high/critical
    if (this.alertDelivery && (signal.escalationLevel === 'critical' || signal.escalationLevel === 'high')) {
      const subdomain = await this.resolveTenantSubdomain(db);
      if (subdomain) {
        const alertPayload: AlertPayload = {
          alertType: 'post_visit_escalation',
          sourceEntityId: sessionId,
          patientId,
          severity: signal.escalationLevel,
          message: signal.summary,
          payload: {
            findings: signal.findings,
            taskId,
            escalationId,
            sourceService: 'PostVisitEscalationRoutingService',
          },
        };
        await this.alertDelivery.broadcastCriticalAlert(subdomain, alertPayload);
      }
    }

    this.logger.log(`Escalation routed for session ${sessionId}: level=${signal.escalationLevel}, taskId=${taskId}`);
    return escalationId;
  }

  async getOpenEscalations(db: any): Promise<any[]> {
    return db.query(
      `SELECT pve.*, p.first_name, p.last_name, p.mrn
       FROM post_visit_escalations pve
       JOIN patients p ON p.id = pve.patient_id
       WHERE pve.status IN ('detected', 'routed')
       ORDER BY
         CASE pve.escalation_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
         pve.created_at DESC
       LIMIT 100`,
    );
  }

  async acknowledgeEscalation(
    escalationId: string,
    userId: string,
    db: any,
  ): Promise<void> {
    await db.query(
      `UPDATE post_visit_escalations
       SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = $2, updated_at = now()
       WHERE id = $1`,
      [escalationId, userId],
    );
    // Also mark the nurse task as in_progress
    await db.query(
      `UPDATE nurse_tasks SET status = 'in_progress', updated_at = now()
       WHERE source = 'post_visit_ai' AND source_entity_id IN (
         SELECT post_visit_session_id FROM post_visit_escalations WHERE id = $1
       )`,
      [escalationId],
    );
  }

  async resolveEscalation(
    escalationId: string,
    userId: string,
    resolutionNote: string,
    db: any,
  ): Promise<void> {
    await db.query(
      `UPDATE post_visit_escalations
       SET status = 'resolved', resolved_at = now(), resolved_by = $2,
           resolution_note = $3, updated_at = now()
       WHERE id = $1`,
      [escalationId, userId, resolutionNote],
    );
    await db.query(
      `UPDATE nurse_tasks SET status = 'completed', completed_at = now(), completed_by = $2, updated_at = now()
       WHERE source = 'post_visit_ai' AND source_entity_id IN (
         SELECT post_visit_session_id FROM post_visit_escalations WHERE id = $1
       )`,
      [escalationId, userId],
    );
  }

  private async resolveTenantSubdomain(db: any): Promise<string | null> {
    if (!this.tenantService) return null;
    try {
      const dbName = db.options?.database ?? '';
      const tenants = await this.tenantService.getAllTenants();
      const found = (tenants as any[]).find(t => t.dbName === dbName || t.database === dbName);
      return found?.subdomain ?? found?.slug ?? null;
    } catch {
      return null;
    }
  }
}
```

---

## Step 3 — Wire into PostVisitService

**File:** `services/ehr-service/src/services/post-visit.service.ts`

Find the method that calls `classifyEscalationSignal()` (inside `PostVisitGroundedLlmService`). After receiving the signal result, call `routeEscalation()`.

Add to the constructor:
```typescript
@Optional() private readonly escalationRouter: PostVisitEscalationRoutingService,
```

Add import:
```typescript
import { PostVisitEscalationRoutingService, EscalationSignal } from './post-visit-escalation-routing.service';
```

After the line that calls `classifyEscalationSignal`:
```typescript
// Existing call (find this pattern in the file):
const escalationResult = await this.groundedLlm.classifyEscalationSignal(/* ... */);

// NEW: Route the escalation if level is moderate or above
if (escalationResult && escalationResult.escalationLevel !== 'low' && this.escalationRouter) {
  const signal: EscalationSignal = {
    escalationLevel: escalationResult.escalationLevel ?? 'moderate',
    summary: escalationResult.summary ?? 'Escalation signal detected in post-visit note',
    findings: escalationResult.findings ?? [],
    recommendedAction: escalationResult.recommendedAction,
  };
  await this.escalationRouter.routeEscalation(sessionId, patientId, signal, db);
}
```

---

## Step 4 — Escalation Controller

**File:** `services/ehr-service/src/controllers/post-visit-escalation.controller.ts`

```typescript
import { Controller, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PostVisitEscalationRoutingService } from '../services/post-visit-escalation-routing.service';

@ApiTags('Post-Visit Escalations')
@Controller('post-visit-escalations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostVisitEscalationController {
  constructor(private readonly svc: PostVisitEscalationRoutingService) {}

  @Get()
  @ApiOperation({ summary: 'List open post-visit escalations' })
  getOpen(@Req() req: any) {
    return this.svc.getOpenEscalations(req.tenantDb);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an escalation' })
  acknowledge(@Param('id') id: string, @Req() req: any) {
    return this.svc.acknowledgeEscalation(id, req.user.sub, req.tenantDb);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an escalation' })
  resolve(
    @Param('id') id: string,
    @Body() body: { resolutionNote: string },
    @Req() req: any,
  ) {
    return this.svc.resolveEscalation(id, req.user.sub, body.resolutionNote, req.tenantDb);
  }
}
```

**Register in ehr.module.ts:**
Add `PostVisitEscalationRoutingService` to `providers: []`.
Add `PostVisitEscalationController` to `controllers: []`.

---

## Step 5 — EHR Frontend: Escalation Queue Panel

**File:** `ehr-frontend/src/components/EscalationQueuePanel.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface Escalation {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  escalation_level: 'moderate' | 'high' | 'critical';
  signal_summary: string;
  detected_findings: string[];
  status: string;
  created_at: string;
}

const levelColor = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

export const EscalationQueuePanel: React.FC<{ tenantSlug: string }> = ({ tenantSlug }) => {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`/api/post-visit-escalations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`,
                   'X-Tenant-Slug': tenantSlug },
      });
      const data = await res.json();
      setEscalations(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const acknowledge = async (id: string) => {
    await fetch(`/api/post-visit-escalations/${id}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}`,
                 'X-Tenant-Slug': tenantSlug },
    });
    load();
  };

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />;
  if (!escalations.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h3 className="font-bold text-gray-900">Post-Visit Escalations</h3>
        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {escalations.length}
        </span>
      </div>
      <div className="space-y-2">
        {escalations.map(esc => (
          <div key={esc.id} className={`rounded-xl border p-3 ${levelColor[esc.escalation_level]}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">
                  {esc.first_name} {esc.last_name} — {esc.mrn}
                </p>
                <p className="text-xs mt-0.5 line-clamp-2">{esc.signal_summary}</p>
              </div>
              <span className="text-xs font-bold uppercase shrink-0">
                {esc.escalation_level}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              {esc.status === 'routed' && (
                <button
                  onClick={() => acknowledge(esc.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-current border border-current rounded-full px-3 py-1 hover:opacity-70"
                >
                  <CheckCircle className="w-3 h-3" /> Acknowledge
                </button>
              )}
              <span className="flex items-center gap-1 text-xs opacity-60">
                <Clock className="w-3 h-3" />
                {new Date(esc.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

Import and render `<EscalationQueuePanel tenantSlug={tenantSlug} />` at the top of the nurse worklist page.

---

## Step 6 — Mobile: Nurse Escalation Alert Screen Component

**File:** `mobile/src/components/nurse/EscalationAlertCard.tsx`

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon } from '../ui';

interface Props {
  escalation: {
    id: string;
    first_name: string;
    last_name: string;
    escalation_level: string;
    signal_summary: string;
    created_at: string;
  };
  onAcknowledge: (id: string) => void;
}

export const EscalationAlertCard: React.FC<Props> = ({ escalation, onAcknowledge }) => {
  const bgColor = escalation.escalation_level === 'critical' ? '#FEE2E2'
    : escalation.escalation_level === 'high' ? '#FFEDD5'
    : '#FEF9C3';
  const textColor = escalation.escalation_level === 'critical' ? '#991B1B'
    : escalation.escalation_level === 'high' ? '#9A3412'
    : '#854D0E';

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <View style={styles.row}>
        <Icon name="alert" size={16} color={textColor} />
        <Text style={[styles.name, { color: textColor }]}>
          {escalation.first_name} {escalation.last_name}
        </Text>
        <Text style={[styles.level, { color: textColor }]}>
          {escalation.escalation_level.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.summary, { color: textColor }]} numberOfLines={2}>
        {escalation.signal_summary}
      </Text>
      <TouchableOpacity
        style={[styles.btn, { borderColor: textColor }]}
        onPress={() => onAcknowledge(escalation.id)}
      >
        <Text style={[styles.btnText, { color: textColor }]}>Acknowledge</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.md, padding: 12, marginBottom: 8, ...SHADOW.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { fontSize: 13, fontFamily: FONT.uiBd, flex: 1 },
  level: { fontSize: 11, fontFamily: FONT.uiBd },
  summary: { fontSize: 12, fontFamily: FONT.ui, lineHeight: 17, marginBottom: 8 },
  btn: { borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: 6, alignItems: 'center' },
  btnText: { fontSize: 12, fontFamily: FONT.uiBd },
});
```

**i18n keys** — add to all 8 locale files under `"escalation"`:
```json
"escalation": {
  "queue_title": "Post-Visit Escalations",
  "acknowledge": "Acknowledge",
  "resolve": "Resolve",
  "level_critical": "CRITICAL",
  "level_high": "HIGH",
  "level_moderate": "MODERATE",
  "no_escalations": "No open escalations"
}
```

---

## Step 7 — Test Spec

**File:** `services/ehr-service/src/services/post-visit-escalation-routing.spec.ts`

```typescript
import { PostVisitEscalationRoutingService } from './post-visit-escalation-routing.service';

describe('PostVisitEscalationRoutingService', () => {
  let service: PostVisitEscalationRoutingService;
  let alertDelivery: any;
  let db: any;

  beforeEach(() => {
    alertDelivery = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    db = {
      query: jest.fn().mockResolvedValue([{ id: 'uuid-1' }]),
      options: { database: 'clinic_test_db' },
    };
    service = new PostVisitEscalationRoutingService(alertDelivery, { getAllTenants: jest.fn().mockResolvedValue([{ dbName: 'clinic_test_db', subdomain: 'tc' }]) } as any);
  });

  it('creates nurse task and escalation record for high level', async () => {
    const id = await service.routeEscalation('session-1', 'patient-1', {
      escalationLevel: 'high',
      summary: 'Elevated troponin detected',
      findings: ['Troponin 0.8 ng/mL (high)'],
    }, db);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO nurse_tasks'), expect.any(Array));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO post_visit_escalations'), expect.any(Array));
    expect(alertDelivery.broadcastCriticalAlert).toHaveBeenCalled();
    expect(id).toBeDefined();
  });

  it('returns null and does not create task for low level', async () => {
    const id = await service.routeEscalation('session-1', 'patient-1', {
      escalationLevel: 'low', summary: 'Routine', findings: [],
    }, db);
    expect(id).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('does not broadcast for moderate level', async () => {
    await service.routeEscalation('session-1', 'patient-1', {
      escalationLevel: 'moderate', summary: 'Borderline finding', findings: ['borderline glucose'],
    }, db);
    expect(alertDelivery.broadcastCriticalAlert).not.toHaveBeenCalled();
  });
});
```

---

## Acceptance Criteria

1. After a post-visit AI classification, if escalation level is `moderate` or above, a row exists in `post_visit_escalations` with `status = 'routed'`.
2. A corresponding row exists in `nurse_tasks` with `source = 'post_visit_ai'` and appropriate priority.
3. For `critical` and `high` escalations, `AlertDeliveryService.broadcastCriticalAlert()` is called.
4. `PATCH /post-visit-escalations/:id/acknowledge` updates status to `acknowledged` and marks nurse task `in_progress`.
5. `PATCH /post-visit-escalations/:id/resolve` updates status to `resolved` and marks nurse task `completed`.
6. The EHR nurse dashboard renders the `EscalationQueuePanel` with escalations sorted critical first.
7. Mobile `EscalationAlertCard` renders with correct background colour per level.
8. `provision-repair-all.sh` creates `post_visit_escalations` and `nurse_tasks` in all tenant DBs.
9. All test cases pass.
10. `tsc --noEmit` passes.

## Definition of Done
- [ ] `post_visit_escalations` provisioning bundle added
- [ ] `nurse_tasks` provisioning bundle added (in same bundle)
- [ ] `PostVisitEscalationRoutingService` created and injected into `PostVisitService`
- [ ] `PostVisitEscalationController` created and registered in `ehr.module.ts`
- [ ] `EscalationQueuePanel` rendered in nurse worklist EHR page
- [ ] `EscalationAlertCard` mobile component created
- [ ] i18n keys in all 8 locales
- [ ] Test spec passes
- [ ] `tsc --noEmit` clean
