import { Injectable, NotFoundException } from '@nestjs/common';

// S274 — Patient Safety Incident Reporting & RCA. General-purpose incident register
// + root-cause-analysis workflow, distinct from the module-specific near-miss tracking
// that already existed (oncology_near_miss_events, workplace_incidents). See
// docs/SOUTHERN-AFRICA-HOSPITAL-READINESS-ROADMAP.md.

const RCA_REQUIRED_HARM_LEVELS = new Set(['moderate_harm', 'severe_harm', 'death']);

@Injectable()
export class PatientSafetyIncidentService {
  async reportIncident(db: any, tenantId: string, reportedBy: string, body: any): Promise<any> {
    const requiresRca = RCA_REQUIRED_HARM_LEVELS.has(body.harmLevel);
    const rows = await db.query(
      `INSERT INTO patient_safety_incidents
         (tenant_id, incident_type, harm_level, patient_id, staff_involved, location,
          incident_date, description, immediate_actions_taken, reported_by, requires_rca)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        tenantId,
        body.incidentType,
        body.harmLevel ?? 'near_miss',
        body.patientId ?? null,
        JSON.stringify(body.staffInvolved ?? []),
        body.location ?? null,
        body.incidentDate,
        body.description,
        body.immediateActionsTaken ?? null,
        reportedBy,
        requiresRca,
      ],
    );
    return rows[0];
  }

  async listIncidents(db: any, tenantId: string, filters: any = {}): Promise<any> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
    if (filters.incidentType) { conditions.push(`incident_type = $${idx++}`); params.push(filters.incidentType); }
    if (filters.harmLevel) { conditions.push(`harm_level = $${idx++}`); params.push(filters.harmLevel); }
    if (filters.patientId) { conditions.push(`patient_id = $${idx++}`); params.push(filters.patientId); }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
    const offset = Math.max(Number(filters.offset || 0), 0);

    const rows = await db.query(
      `SELECT * FROM patient_safety_incidents ${whereSql} ORDER BY incident_date DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );

    const [summary] = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status <> 'closed')::int AS open_count,
         COUNT(*) FILTER (WHERE requires_rca AND status <> 'closed')::int AS rca_pending_count
       FROM patient_safety_incidents ${whereSql}`,
      params,
    );

    return {
      incidents: rows,
      summary: {
        total: Number(summary?.total || 0),
        openCount: Number(summary?.open_count || 0),
        rcaPendingCount: Number(summary?.rca_pending_count || 0),
      },
      paging: { limit, offset },
    };
  }

  async getIncident(db: any, tenantId: string, incidentId: string): Promise<any> {
    const [incident] = await db.query(
      `SELECT * FROM patient_safety_incidents WHERE id = $1 AND tenant_id = $2`,
      [incidentId, tenantId],
    );
    if (!incident) throw new NotFoundException('Incident not found');

    const rcas = await db.query(
      `SELECT * FROM incident_root_cause_analyses WHERE incident_id = $1 ORDER BY created_at DESC`,
      [incidentId],
    );
    const actions = await db.query(
      `SELECT * FROM incident_corrective_actions WHERE incident_id = $1 ORDER BY due_date NULLS LAST, created_at`,
      [incidentId],
    );

    return { ...incident, rootCauseAnalyses: rcas, correctiveActions: actions };
  }

  async updateIncidentStatus(db: any, tenantId: string, incidentId: string, status: string): Promise<any> {
    const rows = await db.query(
      `UPDATE patient_safety_incidents SET status = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [incidentId, tenantId, status],
    );
    if (!rows[0]) throw new NotFoundException('Incident not found');
    return rows[0];
  }

  async startRca(db: any, tenantId: string, incidentId: string, body: any): Promise<any> {
    const [incident] = await db.query(
      `SELECT id FROM patient_safety_incidents WHERE id = $1 AND tenant_id = $2`,
      [incidentId, tenantId],
    );
    if (!incident) throw new NotFoundException('Incident not found');

    const rows = await db.query(
      `INSERT INTO incident_root_cause_analyses
         (incident_id, tenant_id, method, contributing_factors, conducted_by)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       RETURNING *`,
      [incidentId, tenantId, body.method ?? 'five_whys', JSON.stringify(body.contributingFactors ?? []), body.conductedBy ?? null],
    );

    await db.query(
      `UPDATE patient_safety_incidents SET status = 'rca_in_progress', updated_at = now() WHERE id = $1`,
      [incidentId],
    );

    return rows[0];
  }

  async updateRca(db: any, tenantId: string, rcaId: string, body: any): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (body.contributingFactors !== undefined) { fields.push(`contributing_factors = $${idx++}::jsonb`); params.push(JSON.stringify(body.contributingFactors)); }
    if (body.rootCause !== undefined) { fields.push(`root_cause = $${idx++}`); params.push(body.rootCause); }
    if (body.analysisNotes !== undefined) { fields.push(`analysis_notes = $${idx++}`); params.push(body.analysisNotes); }
    if (body.status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(body.status);
      if (body.status === 'completed') { fields.push(`conducted_at = now()`); }
    }
    fields.push(`updated_at = now()`);

    params.push(rcaId, tenantId);
    const rows = await db.query(
      `UPDATE incident_root_cause_analyses SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('RCA not found');
    return rows[0];
  }

  async addCorrectiveAction(db: any, tenantId: string, incidentId: string, body: any): Promise<any> {
    const [incident] = await db.query(
      `SELECT id FROM patient_safety_incidents WHERE id = $1 AND tenant_id = $2`,
      [incidentId, tenantId],
    );
    if (!incident) throw new NotFoundException('Incident not found');

    const rows = await db.query(
      `INSERT INTO incident_corrective_actions
         (incident_id, rca_id, tenant_id, action_description, owner_user_id, due_date)
       VALUES ($1,$2,$3,$4,$5,$6::date)
       RETURNING *`,
      [incidentId, body.rcaId ?? null, tenantId, body.actionDescription, body.ownerUserId ?? null, body.dueDate ?? null],
    );
    return rows[0];
  }

  async updateCorrectiveAction(db: any, tenantId: string, actionId: string, body: any): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (body.status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(body.status);
      if (body.status === 'completed') {
        fields.push(`completed_at = now()`);
        fields.push(`completed_by = $${idx++}`);
        params.push(body.completedBy ?? null);
      }
    }
    if (body.dueDate !== undefined) { fields.push(`due_date = $${idx++}::date`); params.push(body.dueDate); }
    fields.push(`updated_at = now()`);

    params.push(actionId, tenantId);
    const rows = await db.query(
      `UPDATE incident_corrective_actions SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Corrective action not found');
    return rows[0];
  }

  async closeIncident(db: any, tenantId: string, incidentId: string): Promise<any> {
    // Closing requires every corrective action to be resolved — otherwise the incident
    // record would claim closure while real follow-up work is still outstanding.
    const openActions = await db.query(
      `SELECT COUNT(*)::int AS n FROM incident_corrective_actions
       WHERE incident_id = $1 AND status IN ('open','in_progress')`,
      [incidentId],
    );
    if (Number(openActions[0]?.n || 0) > 0) {
      throw new NotFoundException('Cannot close incident: open corrective actions remain');
    }
    return this.updateIncidentStatus(db, tenantId, incidentId, 'closed');
  }

  /** Facility-wide trend dashboard — counts by category/ward/severity over a period. */
  async getDashboard(db: any, tenantId: string, sinceDate?: string): Promise<any> {
    const since = sinceDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const byType = await db.query(
      `SELECT incident_type, COUNT(*)::int AS n
       FROM patient_safety_incidents
       WHERE tenant_id = $1 AND incident_date >= $2
       GROUP BY incident_type ORDER BY n DESC`,
      [tenantId, since],
    );
    const byLocation = await db.query(
      `SELECT COALESCE(location, 'Unspecified') AS location, COUNT(*)::int AS n
       FROM patient_safety_incidents
       WHERE tenant_id = $1 AND incident_date >= $2
       GROUP BY location ORDER BY n DESC`,
      [tenantId, since],
    );
    const bySeverity = await db.query(
      `SELECT harm_level, COUNT(*)::int AS n
       FROM patient_safety_incidents
       WHERE tenant_id = $1 AND incident_date >= $2
       GROUP BY harm_level ORDER BY n DESC`,
      [tenantId, since],
    );
    const overdueActions = await db.query(
      `SELECT ica.*, psi.incident_type, psi.harm_level
       FROM incident_corrective_actions ica
       JOIN patient_safety_incidents psi ON psi.id = ica.incident_id
       WHERE ica.tenant_id = $1 AND ica.status IN ('open','in_progress') AND ica.due_date < CURRENT_DATE
       ORDER BY ica.due_date ASC`,
      [tenantId],
    );

    return {
      since,
      byType: byType.map((r: any) => ({ incidentType: r.incident_type, count: r.n })),
      byLocation: byLocation.map((r: any) => ({ location: r.location, count: r.n })),
      bySeverity: bySeverity.map((r: any) => ({ harmLevel: r.harm_level, count: r.n })),
      overdueActions,
    };
  }
}
