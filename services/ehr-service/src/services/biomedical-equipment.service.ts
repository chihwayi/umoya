import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

// S277 — Biomedical Equipment Register. Clinical equipment inventory with
// calibration due-dates, out-of-service flagging, and a maintenance history log.
// See docs/SOUTHERN-AFRICA-HOSPITAL-READINESS-ROADMAP.md.

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BiomedicalEquipmentService {
  async registerEquipment(db: any, tenantId: string, body: any): Promise<any> {
    const interval = body.calibrationIntervalDays ?? 365;
    const nextDue = body.lastCalibrationDate ? addDays(body.lastCalibrationDate, interval) : null;

    const rows = await db.query(
      `INSERT INTO biomedical_equipment
         (tenant_id, equipment_type, name, manufacturer, model, serial_number, location,
          purchase_date, last_calibration_date, calibration_interval_days, next_calibration_due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        tenantId, body.equipmentType, body.name, body.manufacturer ?? null, body.model ?? null,
        body.serialNumber ?? null, body.location ?? null, body.purchaseDate ?? null,
        body.lastCalibrationDate ?? null, interval, nextDue,
      ],
    );
    return rows[0];
  }

  async listEquipment(db: any, tenantId: string, filters: any = {}): Promise<any> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
    if (filters.equipmentType) { conditions.push(`equipment_type = $${idx++}`); params.push(filters.equipmentType); }
    if (filters.location) { conditions.push(`location = $${idx++}`); params.push(filters.location); }
    if (filters.overdueOnly) { conditions.push(`next_calibration_due_date < CURRENT_DATE AND status = 'in_service'`); }

    return db.query(
      `SELECT * FROM biomedical_equipment WHERE ${conditions.join(' AND ')} ORDER BY next_calibration_due_date ASC NULLS LAST`,
      params,
    );
  }

  async getEquipment(db: any, tenantId: string, equipmentId: string): Promise<any> {
    const [equipment] = await db.query(
      `SELECT * FROM biomedical_equipment WHERE id = $1 AND tenant_id = $2`,
      [equipmentId, tenantId],
    );
    if (!equipment) throw new NotFoundException('Equipment not found');

    const log = await db.query(
      `SELECT beml.*, u.first_name, u.last_name
       FROM biomedical_equipment_maintenance_log beml
       LEFT JOIN users u ON u.id = beml.performed_by
       WHERE beml.equipment_id = $1 ORDER BY beml.performed_at DESC`,
      [equipmentId],
    );
    return { ...equipment, maintenanceLog: log };
  }

  async logMaintenanceEvent(db: any, tenantId: string, equipmentId: string, performedBy: string, body: any): Promise<any> {
    const [equipment] = await db.query(
      `SELECT * FROM biomedical_equipment WHERE id = $1 AND tenant_id = $2`,
      [equipmentId, tenantId],
    );
    if (!equipment) throw new NotFoundException('Equipment not found');

    if (!['calibration', 'repair', 'inspection', 'out_of_service', 'returned_to_service', 'decommission'].includes(body.eventType)) {
      throw new BadRequestException('Invalid event type');
    }

    const logRows = await db.query(
      `INSERT INTO biomedical_equipment_maintenance_log
         (equipment_id, tenant_id, event_type, performed_by, notes, next_due_date)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [equipmentId, tenantId, body.eventType, performedBy, body.notes ?? null, body.nextDueDate ?? null],
    );

    if (body.eventType === 'calibration') {
      const nextDue = body.nextDueDate ?? addDays(new Date().toISOString().slice(0, 10), equipment.calibration_interval_days);
      await db.query(
        `UPDATE biomedical_equipment SET last_calibration_date = CURRENT_DATE, next_calibration_due_date = $3, updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [equipmentId, tenantId, nextDue],
      );
    } else if (body.eventType === 'out_of_service') {
      await db.query(
        `UPDATE biomedical_equipment SET status = 'out_of_service', out_of_service_reason = $3, updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [equipmentId, tenantId, body.notes ?? null],
      );
    } else if (body.eventType === 'returned_to_service') {
      await db.query(
        `UPDATE biomedical_equipment SET status = 'in_service', out_of_service_reason = NULL, updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [equipmentId, tenantId],
      );
    } else if (body.eventType === 'decommission') {
      await db.query(
        `UPDATE biomedical_equipment SET status = 'decommissioned', updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [equipmentId, tenantId],
      );
    }

    return logRows[0];
  }

  /** Facility dashboard: counts by type/status and the overdue-calibration list. */
  async getDashboard(db: any, tenantId: string): Promise<any> {
    const byType = await db.query(
      `SELECT equipment_type, COUNT(*)::int AS n FROM biomedical_equipment
       WHERE tenant_id = $1 GROUP BY equipment_type ORDER BY n DESC`,
      [tenantId],
    );
    const byStatus = await db.query(
      `SELECT status, COUNT(*)::int AS n FROM biomedical_equipment
       WHERE tenant_id = $1 GROUP BY status ORDER BY n DESC`,
      [tenantId],
    );
    const overdue = await db.query(
      `SELECT * FROM biomedical_equipment
       WHERE tenant_id = $1 AND status = 'in_service' AND next_calibration_due_date < CURRENT_DATE
       ORDER BY next_calibration_due_date ASC`,
      [tenantId],
    );
    const dueSoon = await db.query(
      `SELECT * FROM biomedical_equipment
       WHERE tenant_id = $1 AND status = 'in_service'
         AND next_calibration_due_date >= CURRENT_DATE AND next_calibration_due_date <= CURRENT_DATE + INTERVAL '30 days'
       ORDER BY next_calibration_due_date ASC`,
      [tenantId],
    );

    return {
      byType: byType.map((r: any) => ({ equipmentType: r.equipment_type, count: r.n })),
      byStatus: byStatus.map((r: any) => ({ status: r.status, count: r.n })),
      overdueCalibration: overdue,
      dueWithin30Days: dueSoon,
    };
  }
}
