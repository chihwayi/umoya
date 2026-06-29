import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class MdsrService {
  constructor(private readonly tenantService: TenantService) {}

  async recordMaternalDeath(tenantId: string, deliveryId: string, dto: any): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.query(
      `UPDATE maternity_deliveries SET
         maternal_outcome = $1, death_date = $2, death_cause_primary = $3,
         death_cause_secondary = $4, death_setting = $5,
         notified_to_mohcc = $6, mohcc_notification_date = $7
       WHERE id = $8 AND tenant_id = $9`,
      [
        dto.maternal_outcome ?? 'deceased_postpartum',
        dto.death_date,
        dto.death_cause_primary,
        dto.death_cause_secondary ?? null,
        dto.death_setting ?? null,
        dto.notified_to_mohcc ?? false,
        dto.mohcc_notification_date ?? null,
        deliveryId,
        tenantId,
      ],
    );
  }

  async saveMdsrReview(tenantId: string, dto: any): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (dto.id) {
      await db.query(
        `UPDATE mdsr_reviews SET
           review_date=$1, review_committee=$2,
           delay_1_recognition=$3, delay_1_notes=$4,
           delay_2_reaching=$5, delay_2_notes=$6,
           delay_3_receiving=$7, delay_3_notes=$8,
           preventable=$9, preventability_level=$10, preventability_notes=$11,
           avoidability_factors=$12, primary_factor=$13, primary_factor_notes=$14,
           reviewed_by=$15, approved_by=$16, status=$17, updated_at=NOW()
         WHERE id=$18 AND tenant_id=$19`,
        [
          dto.review_date, dto.review_committee ?? null,
          dto.delay_1_recognition ?? false, dto.delay_1_notes ?? null,
          dto.delay_2_reaching ?? false, dto.delay_2_notes ?? null,
          dto.delay_3_receiving ?? false, dto.delay_3_notes ?? null,
          dto.preventable ?? null, dto.preventability_level ?? null, dto.preventability_notes ?? null,
          dto.avoidability_factors ?? [], dto.primary_factor ?? null, dto.primary_factor_notes ?? null,
          dto.reviewed_by, dto.approved_by ?? null, dto.status ?? 'draft',
          dto.id, tenantId,
        ],
      );
      const [row] = await db.query(`SELECT * FROM mdsr_reviews WHERE id=$1`, [dto.id]);
      return row;
    }
    const result = await db.query(
      `INSERT INTO mdsr_reviews
         (tenant_id, delivery_id, patient_id, review_date, review_committee,
          delay_1_recognition, delay_1_notes, delay_2_reaching, delay_2_notes,
          delay_3_receiving, delay_3_notes, preventable, preventability_level,
          preventability_notes, avoidability_factors, primary_factor,
          primary_factor_notes, reviewed_by, approved_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        tenantId, dto.delivery_id, dto.patient_id, dto.review_date,
        dto.review_committee ?? null,
        dto.delay_1_recognition ?? false, dto.delay_1_notes ?? null,
        dto.delay_2_reaching ?? false, dto.delay_2_notes ?? null,
        dto.delay_3_receiving ?? false, dto.delay_3_notes ?? null,
        dto.preventable ?? null, dto.preventability_level ?? null,
        dto.preventability_notes ?? null,
        dto.avoidability_factors ?? [], dto.primary_factor ?? null,
        dto.primary_factor_notes ?? null, dto.reviewed_by,
        dto.approved_by ?? null, dto.status ?? 'draft',
      ],
    );
    return result[0];
  }

  async addActionItem(tenantId: string, reviewId: string, dto: any): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const result = await db.query(
      `INSERT INTO mdsr_action_items
         (tenant_id, review_id, action, responsible_for, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [tenantId, reviewId, dto.action, dto.responsible_for, dto.due_date, dto.status ?? 'open'],
    );
    return result[0];
  }

  async updateActionItem(tenantId: string, actionId: string, dto: any): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    await db.query(
      `UPDATE mdsr_action_items SET
         status=$1, completed_at=$2, completion_notes=$3
       WHERE id=$4 AND tenant_id=$5`,
      [
        dto.status,
        dto.status === 'completed' ? (dto.completed_at ?? new Date().toISOString()) : null,
        dto.completion_notes ?? null,
        actionId,
        tenantId,
      ],
    );
  }

  async getMdsrSummary(tenantId: string, year: number): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    const [deathRow] = await db.query(
      `SELECT COUNT(*) AS total_deaths FROM maternity_deliveries
       WHERE tenant_id=$1 AND maternal_outcome IN ('deceased_during_delivery','deceased_postpartum','deceased_42day')
         AND EXTRACT(YEAR FROM death_date) = $2`,
      [tenantId, year],
    );

    const [birthRow] = await db.query(
      `SELECT COUNT(*) AS live_births FROM maternity_deliveries
       WHERE tenant_id=$1 AND EXTRACT(YEAR FROM delivery_date) = $2
         AND (baby_outcome = 'alive' OR baby_outcome IS NULL)`,
      [tenantId, year],
    );

    const causeRows = await db.query(
      `SELECT death_cause_primary AS cause, COUNT(*) AS cnt
       FROM maternity_deliveries
       WHERE tenant_id=$1 AND death_cause_primary IS NOT NULL
         AND EXTRACT(YEAR FROM death_date) = $2
       GROUP BY death_cause_primary ORDER BY cnt DESC`,
      [tenantId, year],
    );

    const [delayRow] = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE r.delay_1_recognition) AS delay1,
         COUNT(*) FILTER (WHERE r.delay_2_reaching) AS delay2,
         COUNT(*) FILTER (WHERE r.delay_3_receiving) AS delay3,
         COUNT(*) FILTER (WHERE r.preventable = true) AS preventable,
         COUNT(*) FILTER (WHERE r.preventable = false) AS not_preventable,
         COUNT(*) FILTER (WHERE r.preventable IS NULL) AS unknown_prev,
         COUNT(*) FILTER (WHERE r.status = 'closed' OR r.status = 'committee_reviewed') AS reviews_completed,
         COUNT(*) FILTER (WHERE r.status IN ('draft','submitted_to_committee')) AS reviews_pending
       FROM mdsr_reviews r
       WHERE r.tenant_id=$1 AND EXTRACT(YEAR FROM r.review_date) = $2`,
      [tenantId, year],
    );

    const [actionRow] = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('open','in_progress')) AS open_items,
         COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND due_date < NOW()) AS overdue_items
       FROM mdsr_action_items WHERE tenant_id=$1`,
      [tenantId],
    );

    const factorRows = await db.query(
      `SELECT primary_factor, COUNT(*) AS cnt
       FROM mdsr_reviews WHERE tenant_id=$1 AND primary_factor IS NOT NULL
         AND EXTRACT(YEAR FROM review_date) = $2
       GROUP BY primary_factor ORDER BY cnt DESC`,
      [tenantId, year],
    );

    const monthRows = await db.query(
      `SELECT TO_CHAR(d.death_date,'YYYY-MM') AS month, COUNT(*) AS deaths,
              COUNT(r.id) FILTER (WHERE r.preventable = true) AS preventable
       FROM maternity_deliveries d
       LEFT JOIN mdsr_reviews r ON r.delivery_id = d.id AND r.tenant_id = d.tenant_id
       WHERE d.tenant_id=$1 AND EXTRACT(YEAR FROM d.death_date) = $2
         AND d.maternal_outcome IN ('deceased_during_delivery','deceased_postpartum','deceased_42day')
       GROUP BY month ORDER BY month`,
      [tenantId, year],
    );

    // Prior year comparison
    const [priorRow] = await db.query(
      `SELECT COUNT(*) AS total FROM maternity_deliveries
       WHERE tenant_id=$1 AND maternal_outcome IN ('deceased_during_delivery','deceased_postpartum','deceased_42day')
         AND EXTRACT(YEAR FROM death_date) = $2`,
      [tenantId, year - 1],
    );

    const totalDeaths = Number(deathRow?.total_deaths ?? 0);
    const liveBirths = Number(birthRow?.live_births ?? 1);
    const priorDeaths = Number(priorRow?.total ?? 0);

    const byCause: Record<string, number> = {};
    causeRows.forEach((r: any) => { byCause[r.cause] = Number(r.cnt); });

    const byPrimaryFactor: Record<string, number> = {};
    factorRows.forEach((r: any) => { byPrimaryFactor[r.primary_factor] = Number(r.cnt); });

    return {
      total_maternal_deaths: totalDeaths,
      mmr: liveBirths > 0 ? Math.round((totalDeaths / liveBirths) * 100000) : 0,
      by_cause: byCause,
      by_delay: {
        delay1: Number(delayRow?.delay1 ?? 0),
        delay2: Number(delayRow?.delay2 ?? 0),
        delay3: Number(delayRow?.delay3 ?? 0),
      },
      preventable: Number(delayRow?.preventable ?? 0),
      not_preventable: Number(delayRow?.not_preventable ?? 0),
      unknown_preventability: Number(delayRow?.unknown_prev ?? 0),
      reviews_completed: Number(delayRow?.reviews_completed ?? 0),
      reviews_pending: Number(delayRow?.reviews_pending ?? 0),
      action_items_open: Number(actionRow?.open_items ?? 0),
      action_items_overdue: Number(actionRow?.overdue_items ?? 0),
      by_month: monthRows.map((r: any) => ({
        month: r.month,
        deaths: Number(r.deaths),
        preventable: Number(r.preventable),
      })),
      by_primary_factor: byPrimaryFactor,
      trend_vs_prior_year: priorDeaths > 0
        ? Number((((totalDeaths - priorDeaths) / priorDeaths) * 100).toFixed(1)) : null,
    };
  }

  async getDeathsRegister(tenantId: string, year: number): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.query(
      `SELECT d.id, d.patient_id, d.death_date, d.death_cause_primary,
              d.death_cause_secondary, d.death_setting, d.maternal_outcome,
              d.notified_to_mohcc, d.mohcc_notification_date,
              r.id AS review_id, r.status AS review_status,
              r.preventability_level, r.preventable
       FROM maternity_deliveries d
       LEFT JOIN mdsr_reviews r ON r.delivery_id = d.id AND r.tenant_id = d.tenant_id
       WHERE d.tenant_id=$1
         AND d.maternal_outcome IN ('deceased_during_delivery','deceased_postpartum','deceased_42day')
         AND EXTRACT(YEAR FROM d.death_date) = $2
       ORDER BY d.death_date DESC`,
      [tenantId, year],
    );
  }

  async getReviewDetails(tenantId: string, reviewId: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const [review] = await db.query(
      `SELECT * FROM mdsr_reviews WHERE id=$1 AND tenant_id=$2`,
      [reviewId, tenantId],
    );
    const actions = await db.query(
      `SELECT * FROM mdsr_action_items WHERE review_id=$1 AND tenant_id=$2 ORDER BY due_date`,
      [reviewId, tenantId],
    );
    return { ...review, action_items: actions };
  }

  async getOverdueActionItems(tenantId: string): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.query(
      `SELECT a.*, r.delivery_id, r.patient_id
       FROM mdsr_action_items a
       JOIN mdsr_reviews r ON r.id = a.review_id
       WHERE a.tenant_id=$1 AND a.status IN ('open','in_progress') AND a.due_date < NOW()
       ORDER BY a.due_date ASC`,
      [tenantId],
    );
  }

  async generateMohccReport(tenantId: string, year: number, quarter: number): Promise<any> {
    const summary = await this.getMdsrSummary(tenantId, year);
    const qStartMonth = (quarter - 1) * 3 + 1;
    const qMonths = [`${year}-${String(qStartMonth).padStart(2, '0')}`, `${year}-${String(qStartMonth + 1).padStart(2, '0')}`, `${year}-${String(qStartMonth + 2).padStart(2, '0')}`];
    const quarterData = summary.by_month.filter((m: any) => qMonths.includes(m.month));
    return {
      report_type: 'MOHCC_MDSR_QUARTERLY',
      year,
      quarter,
      quarter_label: `Q${quarter} ${year}`,
      total_deaths_quarter: quarterData.reduce((s: number, m: any) => s + m.deaths, 0),
      total_deaths_year: summary.total_maternal_deaths,
      mmr: summary.mmr,
      by_cause: summary.by_cause,
      three_delay_analysis: summary.by_delay,
      preventability: {
        preventable: summary.preventable,
        not_preventable: summary.not_preventable,
        unknown: summary.unknown_preventability,
      },
      reviews_completed: summary.reviews_completed,
      reviews_pending: summary.reviews_pending,
      action_items_open: summary.action_items_open,
      action_items_overdue: summary.action_items_overdue,
      generated_at: new Date().toISOString(),
    };
  }
}
