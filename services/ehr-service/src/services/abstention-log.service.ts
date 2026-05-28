import { Injectable, Logger } from '@nestjs/common';

export type AbstentionReason =
  | 'cdss_error'
  | 'low_confidence'
  | 'no_data'
  | 'out_of_scope'
  | 'timeout'
  | 'not_configured';

@Injectable()
export class AbstentionLogService {
  private readonly logger = new Logger(AbstentionLogService.name);

  async log(
    db: any,
    context: string,
    reason: AbstentionReason,
    options?: { patientId?: string; requestedBy?: string; errorDetail?: string },
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO ai_abstention_log (patient_id, context, reason, error_detail, requested_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          options?.patientId ?? null,
          context,
          reason,
          options?.errorDetail ?? null,
          options?.requestedBy ?? null,
        ],
      );
    } catch (err: any) {
      this.logger.warn(`Failed to log abstention: ${err.message}`);
    }
  }

  async getAbstentions(db: any, patientId?: string, limit = 20): Promise<unknown[]> {
    if (patientId) {
      return db.query(
        `SELECT * FROM ai_abstention_log
         WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [patientId, limit],
      );
    }
    return db.query(
      `SELECT * FROM ai_abstention_log ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
  }
}
