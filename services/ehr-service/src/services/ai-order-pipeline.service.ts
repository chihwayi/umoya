// services/ehr-service/src/services/ai-order-pipeline.service.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderType, OrderPriority } from '../entities/order.entity';
import { AlertDeliveryService } from './alert-delivery.service';

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
    @Optional() private readonly alertDelivery?: AlertDeliveryService,
  ) {}

  /** Persist AI order suggestions as pending rows */
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
          patientId,
          source,
          sourceEntityId,
          s.orderType,
          s.medicationName ?? null,
          s.instructions,
          s.priority ?? OrderPriority.NORMAL,
          s.aiReason,
          s.confidenceScore ?? null,
          s.suggestedByModel ?? null,
        ],
      );
      if (row?.id) ids.push(row.id);
    }
    this.logger.log(`Saved ${ids.length} AI order suggestions for patient ${patientId}`);
    return ids;
  }

  /** Approve suggestion – creates a real order */
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
    if (!suggestion) throw new Error('Suggestion not found or already reviewed');

    const order = await this.orderService.createOrder(
      {
        patientId: suggestion.patient_id,
        orderType: suggestion.order_type as OrderType,
        orderName: suggestion.medication_name ?? suggestion.instructions?.substring(0, 100) ?? 'AI-suggested order',
        instructions: suggestion.instructions,
        priority: (suggestion.priority as OrderPriority) ?? OrderPriority.NORMAL,
      },
      doctorId,
      tenantId,
    );

    await db.query(
      `UPDATE ai_order_suggestions SET status='approved', reviewed_by=$2, reviewed_at=now(), created_order_id=$3 WHERE id=$1`,
      [suggestionId, doctorId, order.id],
    );
    this.logger.log(`AI suggestion ${suggestionId} approved → order ${order.id}`);
    return order.id;
  }

  /** Reject suggestion */
  async rejectSuggestion(
    suggestionId: string,
    doctorId: string,
    rejectionReason: string,
    db: any,
  ): Promise<void> {
    await db.query(
      `UPDATE ai_order_suggestions SET status='rejected', reviewed_by=$2, reviewed_at=now(), rejection_reason=$3 WHERE id=$1`,
      [suggestionId, doctorId, rejectionReason],
    );
  }

  /** Get pending suggestions */
  async getPendingSuggestions(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM ai_order_suggestions WHERE patient_id=$1 AND status='pending' AND expires_at > now()
       ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, created_at DESC`,
      [patientId],
    );
  }

  /** Auto‑approve (e.g., maternity guideline) */
  async autoApproveSuggestion(
    suggestionId: string,
    systemUserId: string,
    tenantId: string,
    db: any,
  ): Promise<string> {
    return this.approveSuggestion(suggestionId, systemUserId, tenantId, db);
  }
}
