# Sprint S168 — AI Order Creation Pipeline

## Sprint Goal
The encounter copilot builds `suggestedOrders[]` and the maternity guideline engine sets `auto_authorize: true` on recommendations — but neither actually calls `OrderService.createOrder()`. This sprint creates an `AiOrderPipelineService` that converts AI suggestions into real pending orders, a doctor-facing approval UI in the EHR, and a mobile notification for pending approval.

## Prerequisites
- S166 (alert wiring pattern)

---

## Step 1 — Database Provisioning

```typescript
{
  id: 'ai_order_suggestions',
  label: 'AI Order Suggestions — Pending Approval Queue',
  version: '2026.05.27.1',
  description: 'Tracks AI-suggested orders from encounter copilot and maternity guidelines — pending doctor approval before creation',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS ai_order_suggestions (
      id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id          UUID        NOT NULL,
      source              VARCHAR(64) NOT NULL,
      source_entity_id    UUID,
      order_type          VARCHAR(32) NOT NULL,
      medication_name     VARCHAR(255),
      instructions        TEXT        NOT NULL,
      priority            VARCHAR(16) NOT NULL DEFAULT 'normal',
      ai_reason           TEXT        NOT NULL,
      confidence_score    NUMERIC(4,3),
      suggested_by_model  VARCHAR(64),
      status              VARCHAR(16) NOT NULL DEFAULT 'pending',
      reviewed_by         UUID,
      reviewed_at         TIMESTAMPTZ,
      rejection_reason    TEXT,
      created_order_id    UUID,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_orders_patient ON ai_order_suggestions (patient_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_orders_pending ON ai_order_suggestions (status, created_at) WHERE status = 'pending'`,
    `CREATE INDEX IF NOT EXISTS idx_ai_orders_source ON ai_order_suggestions (source, source_entity_id)`,
  ],
},
```

---

## Step 2 — AiOrderPipelineService

**File:** `services/ehr-service/src/services/ai-order-pipeline.service.ts`

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderType, OrderPriority } from '../entities/order.entity';
import { AlertDeliveryService, AlertPayload } from './alert-delivery.service';

export interface AiOrderSuggestion {
  orderType: OrderType;
  medicationName?: string;
  instructions: string;
  priority?: OrderPriority;
  aiReason: string;
  confidenceScore?: number;
  suggestedByModel?: string;
}

@Injectable()
export class AiOrderPipelineService {
  private readonly logger = new Logger(AiOrderPipelineService.name);

  constructor(
    private readonly orderService: OrderService,
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  /**
   * Persist AI order suggestions as pending rows in ai_order_suggestions.
   * Does NOT create real orders yet — doctor must approve first.
   *
   * @param patientId     UUID
   * @param source        'encounter_copilot' | 'maternity_guideline' | 'cdss_recommendation'
   * @param sourceEntityId e.g. encounter session id
   * @param suggestions   array of AI-suggested orders
   * @param db            tenant DB
   * @returns array of suggestion UUIDs
   */
  async saveSuggestions(
    patientId: string,
    source: string,
    sourceEntityId: string,
    suggestions: AiOrderSuggestion[],
    db: any,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const s of suggestions) {
      const [row] = await db.query(
        `INSERT INTO ai_order_suggestions
           (patient_id, source, source_entity_id, order_type, medication_name,
            instructions, priority, ai_reason, confidence_score, suggested_by_model)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          patientId, source, sourceEntityId, s.orderType,
          s.medicationName ?? null, s.instructions,
          s.priority ?? OrderPriority.NORMAL, s.aiReason,
          s.confidenceScore ?? null, s.suggestedByModel ?? null,
        ],
      );
      if (row?.id) ids.push(row.id);
    }
    this.logger.log(`Saved ${ids.length} AI order suggestions for patient ${patientId} from ${source}`);
    return ids;
  }

  /**
   * Doctor approves a suggestion — creates the real order and marks suggestion as approved.
   */
  async approveSuggestion(
    suggestionId: string,
    doctorId: string,
    tenantId: string,
    db: any,
  ): Promise<string> {
    const [suggestion] = await db.query(
      `SELECT * FROM ai_order_suggestions WHERE id = $1 AND status = 'pending'`,
      [suggestionId],
    );
    if (!suggestion) throw new Error(`Suggestion ${suggestionId} not found or already reviewed`);

    const order = await this.orderService.createOrder(
      {
        patientId: suggestion.patient_id,
        orderType: suggestion.order_type as OrderType,
        instructions: suggestion.instructions,
        priority: (suggestion.priority as OrderPriority) ?? OrderPriority.NORMAL,
      },
      doctorId,
      tenantId,
    );

    await db.query(
      `UPDATE ai_order_suggestions
       SET status = 'approved', reviewed_by = $2, reviewed_at = now(), created_order_id = $3
       WHERE id = $1`,
      [suggestionId, doctorId, order.id],
    );

    this.logger.log(`AI suggestion ${suggestionId} approved by ${doctorId} → order ${order.id}`);
    return order.id;
  }

  /**
   * Doctor rejects a suggestion.
   */
  async rejectSuggestion(
    suggestionId: string,
    doctorId: string,
    rejectionReason: string,
    db: any,
  ): Promise<void> {
    await db.query(
      `UPDATE ai_order_suggestions
       SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
       WHERE id = $1`,
      [suggestionId, doctorId, rejectionReason],
    );
  }

  /**
   * Get all pending suggestions for a patient.
   */
  async getPendingSuggestions(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM ai_order_suggestions
       WHERE patient_id = $1 AND status = 'pending' AND expires_at > now()
       ORDER BY
         CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
         created_at DESC`,
      [patientId],
    );
  }

  /**
   * Auto-approve a suggestion if auto_authorize is true (maternity guidelines).
   * Creates the order immediately without doctor action.
   */
  async autoApproveSuggestion(
    suggestionId: string,
    systemUserId: string,
    tenantId: string,
    db: any,
  ): Promise<string> {
    return this.approveSuggestion(suggestionId, systemUserId, tenantId, db);
  }
}
```

---

## Step 3 — Wire into EncounterCopilotService

**File:** `services/ehr-service/src/services/encounter-copilot.service.ts`

Add to constructor (with `@Optional()`):
```typescript
@Optional() private readonly aiOrderPipeline: AiOrderPipelineService,
```

Find the section where `suggestedOrders` is assembled (search for `suggestedOrders` in the file). After building the array:
```typescript
// Existing: build suggestedOrders array
const suggestedOrders = [...]; // existing logic

// NEW: persist as AI suggestions
if (this.aiOrderPipeline && suggestedOrders.length > 0 && sessionId && patientId) {
  const mappedSuggestions = suggestedOrders.map((o: any) => ({
    orderType: o.type ?? OrderType.LAB_TEST,
    medicationName: o.medicationName,
    instructions: o.description ?? o.instructions ?? 'AI-suggested order',
    priority: o.priority ?? OrderPriority.NORMAL,
    aiReason: o.reason ?? 'Suggested by encounter copilot',
    confidenceScore: o.confidence,
    suggestedByModel: 'encounter_copilot',
  }));
  await this.aiOrderPipeline.saveSuggestions(patientId, 'encounter_copilot', sessionId, mappedSuggestions, db);
}
```

---

## Step 4 — Wire into Maternity Service

**File:** `services/ehr-service/src/services/maternity.service.ts`

Add to constructor (with `@Optional()`):
```typescript
@Optional() private readonly aiOrderPipeline: AiOrderPipelineService,
```

Find the section where maternity recommendations with `auto_authorize: true` are built. After building them:
```typescript
// Find recommendations with auto_authorize === true
const autoRecommendations = recommendations.filter((r: any) => r.autoAuthorize === true);

if (this.aiOrderPipeline && autoRecommendations.length > 0) {
  const suggestions = autoRecommendations.map((r: any) => ({
    orderType: r.type === 'lab_order' ? OrderType.LAB_TEST
             : r.type === 'referral' ? OrderType.CONSULTATION
             : OrderType.PROCEDURE,
    instructions: r.description ?? r.title,
    priority: OrderPriority.NORMAL,
    aiReason: `Maternity guideline: ${r.guidelineRule ?? r.title}`,
    suggestedByModel: 'maternity_guideline_registry',
  }));
  const ids = await this.aiOrderPipeline.saveSuggestions(patientId, 'maternity_guideline', enrollmentId, suggestions, db);
  // Auto-approve guideline-driven orders immediately
  for (const id of ids) {
    await this.aiOrderPipeline.autoApproveSuggestion(id, 'system_maternity', tenantId, db);
  }
}
```

---

## Step 5 — AI Order Suggestions Controller

**File:** `services/ehr-service/src/controllers/ai-order-suggestions.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AiOrderPipelineService } from '../services/ai-order-pipeline.service';

@ApiTags('AI Order Suggestions')
@Controller('ai-order-suggestions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiOrderSuggestionsController {
  constructor(private readonly svc: AiOrderPipelineService) {}

  @Get()
  @ApiOperation({ summary: 'List pending AI order suggestions for a patient' })
  list(@Query('patientId') patientId: string, @Req() req: any) {
    return this.svc.getPendingSuggestions(patientId, req.tenantDb);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve an AI order suggestion — creates real order' })
  approve(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.headers['x-tenant-id'] as string;
    return this.svc.approveSuggestion(id, req.user.sub, tenantId, req.tenantDb);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject an AI order suggestion' })
  reject(
    @Param('id') id: string,
    @Body() body: { rejectionReason: string },
    @Req() req: any,
  ) {
    return this.svc.rejectSuggestion(id, req.user.sub, body.rejectionReason, req.tenantDb);
  }
}
```

Register both service and controller in `ehr.module.ts`.

---

## Step 6 — EHR Frontend: AI Suggested Orders Panel

**File:** `ehr-frontend/src/components/AiOrderSuggestionsPanel.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Sparkles, Check, X, Clock } from 'lucide-react';

interface Suggestion {
  id: string;
  order_type: string;
  instructions: string;
  priority: string;
  ai_reason: string;
  confidence_score?: number;
  created_at: string;
}

const priorityColor = {
  urgent: 'border-red-300 bg-red-50',
  high: 'border-orange-300 bg-orange-50',
  normal: 'border-blue-200 bg-blue-50',
  low: 'border-gray-200 bg-gray-50',
};

export const AiOrderSuggestionsPanel: React.FC<{
  patientId: string;
  tenantSlug: string;
  onApproved?: () => void;
}> = ({ patientId, tenantSlug, onApproved }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'X-Tenant-Slug': tenantSlug,
    'Content-Type': 'application/json',
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-order-suggestions?patientId=${patientId}`, { headers });
      setSuggestions(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [patientId]);

  const approve = async (id: string) => {
    await fetch(`/api/ai-order-suggestions/${id}/approve`, { method: 'PATCH', headers });
    load();
    onApproved?.();
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Reason for rejection (optional):') ?? '';
    await fetch(`/api/ai-order-suggestions/${id}/reject`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ rejectionReason: reason }),
    });
    load();
  };

  if (loading) return <div className="animate-pulse h-16 bg-gray-100 rounded-xl mb-4" />;
  if (!suggestions.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-gray-900">AI Suggested Orders</h3>
        <span className="ml-auto bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {suggestions.length} pending
        </span>
      </div>
      <div className="space-y-2">
        {suggestions.map(s => (
          <div key={s.id} className={`rounded-xl border p-3 ${priorityColor[s.priority as keyof typeof priorityColor] ?? priorityColor.normal}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                    {s.order_type.replace('_', ' ')}
                  </span>
                  {s.confidence_score && (
                    <span className="text-xs text-gray-500">
                      {Math.round(s.confidence_score * 100)}% confidence
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-1">{s.instructions}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {s.ai_reason}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => approve(s.id)}
                  className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                  title="Approve"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => reject(s.id)}
                  className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                  title="Reject"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

Render `<AiOrderSuggestionsPanel patientId={patient.id} tenantSlug={tenantSlug} />` inside the patient encounter view.

---

## Step 7 — i18n Keys (all 8 locales)

```json
"ai_orders": {
  "panel_title": "AI Suggested Orders",
  "pending_count": "{{count}} pending",
  "approve": "Approve",
  "reject": "Reject",
  "approved": "Order created",
  "rejected": "Suggestion dismissed",
  "confidence": "{{pct}}% confidence",
  "expires_soon": "Expires in {{hours}}h"
}
```

---

## Step 8 — Test Spec

**File:** `services/ehr-service/src/services/ai-order-pipeline.spec.ts`

```typescript
import { AiOrderPipelineService } from './ai-order-pipeline.service';
import { OrderType, OrderPriority } from '../entities/order.entity';

describe('AiOrderPipelineService', () => {
  let svc: AiOrderPipelineService;
  let orderService: any;
  let db: any;

  beforeEach(() => {
    orderService = {
      createOrder: jest.fn().mockResolvedValue({ id: 'order-uuid-1' }),
    };
    db = { query: jest.fn().mockResolvedValue([{ id: 'suggestion-uuid-1' }]) };
    svc = new AiOrderPipelineService(orderService, undefined as any);
  });

  it('saves suggestions to DB without creating orders', async () => {
    const ids = await svc.saveSuggestions('p1', 'encounter_copilot', 'session-1', [
      { orderType: OrderType.LAB_TEST, instructions: 'CD4 count', aiReason: 'CD4 not done in 6 months', priority: OrderPriority.HIGH },
    ], db);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_order_suggestions'), expect.any(Array));
    expect(orderService.createOrder).not.toHaveBeenCalled();
    expect(ids).toContain('suggestion-uuid-1');
  });

  it('creates real order on approve', async () => {
    db.query.mockResolvedValueOnce([{
      id: 'sugg-1', patient_id: 'p1', order_type: 'lab_test',
      instructions: 'CD4 count', priority: 'high',
    }]);
    await svc.approveSuggestion('sugg-1', 'doctor-1', 'tenant-1', db);
    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1', orderType: 'lab_test' }),
      'doctor-1', 'tenant-1',
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ai_order_suggestions'),
      expect.arrayContaining(['sugg-1', 'doctor-1']),
    );
  });

  it('marks suggestion as rejected on reject', async () => {
    await svc.rejectSuggestion('sugg-1', 'doctor-1', 'Not clinically indicated', db);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'rejected'"),
      expect.arrayContaining(['sugg-1', 'doctor-1', 'Not clinically indicated']),
    );
  });
});
```

---

## Acceptance Criteria

1. After an encounter copilot session is created, rows appear in `ai_order_suggestions` with `status = 'pending'`.
2. `GET /ai-order-suggestions?patientId=X` returns pending suggestions for that patient.
3. `PATCH /ai-order-suggestions/:id/approve` creates a row in the `orders` table and sets suggestion `status = 'approved'`.
4. `PATCH /ai-order-suggestions/:id/reject` sets suggestion `status = 'rejected'` with reason.
5. Maternity auto-authorize recommendations create orders directly (no approval needed).
6. The `AiOrderSuggestionsPanel` renders in the EHR patient encounter view.
7. Suggestions expire after 24 hours (`expires_at < now()` excluded from list).
8. All tests pass.

## Definition of Done
- [ ] `ai_order_suggestions` provisioning bundle added and verified
- [ ] `AiOrderPipelineService` created
- [ ] Injected into `EncounterCopilotService` and `MaternityService`
- [ ] Controller registered in `ehr.module.ts`
- [ ] `AiOrderSuggestionsPanel` component rendered in encounter view
- [ ] i18n keys in all 8 locales
- [ ] Test spec passes
- [ ] `tsc --noEmit` clean
