import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

// S276 — Staff Duty Rostering. Ward-level shift roster + on-call status + shift
// handover notes, with double-booking conflict detection. Deliberately scoped to
// record-keeping and conflict checks, not a full rostering optimizer.
// See docs/SOUTHERN-AFRICA-HOSPITAL-READINESS-ROADMAP.md.

@Injectable()
export class StaffDutyRosteringService {
  private async findOverlaps(db: any, tenantId: string, userId: string, shiftDate: string, startTime: string, endTime: string, excludeShiftId?: string): Promise<any[]> {
    const params: any[] = [tenantId, userId, shiftDate, startTime, endTime];
    let exclusion = '';
    if (excludeShiftId) {
      params.push(excludeShiftId);
      exclusion = `AND id <> $${params.length}`;
    }
    return db.query(
      `SELECT * FROM staff_duty_shifts
       WHERE tenant_id = $1 AND user_id = $2 AND shift_date = $3 AND status = 'scheduled'
         AND start_time < $5 AND end_time > $4
         ${exclusion}`,
      params,
    );
  }

  async createShift(db: any, tenantId: string, createdBy: string, body: any): Promise<any> {
    const overlaps = await this.findOverlaps(db, tenantId, body.userId, body.shiftDate, body.startTime, body.endTime);
    if (overlaps.length > 0) {
      throw new ConflictException(
        `Staff member is already rostered on ward "${overlaps[0].ward}" from ${overlaps[0].start_time} to ${overlaps[0].end_time} on ${body.shiftDate}`,
      );
    }

    const rows = await db.query(
      `INSERT INTO staff_duty_shifts
         (tenant_id, user_id, ward, shift_date, shift_type, start_time, end_time, on_call, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        tenantId, body.userId, body.ward, body.shiftDate, body.shiftType ?? 'day',
        body.startTime, body.endTime, body.onCall ?? false, createdBy,
      ],
    );
    return rows[0];
  }

  async listShifts(db: any, tenantId: string, filters: any = {}): Promise<any> {
    const conditions: string[] = ['sds.tenant_id = $1'];
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.ward) { conditions.push(`sds.ward = $${idx++}`); params.push(filters.ward); }
    if (filters.userId) { conditions.push(`sds.user_id = $${idx++}`); params.push(filters.userId); }
    if (filters.fromDate) { conditions.push(`sds.shift_date >= $${idx++}`); params.push(filters.fromDate); }
    if (filters.toDate) { conditions.push(`sds.shift_date <= $${idx++}`); params.push(filters.toDate); }
    if (filters.status) { conditions.push(`sds.status = $${idx++}`); params.push(filters.status); }

    return db.query(
      `SELECT sds.*, u.first_name, u.last_name, u.role
       FROM staff_duty_shifts sds
       JOIN users u ON u.id = sds.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sds.shift_date ASC, sds.start_time ASC`,
      params,
    );
  }

  async getOnCallStaff(db: any, tenantId: string, shiftDate: string, ward?: string): Promise<any> {
    const conditions: string[] = ["sds.tenant_id = $1", "sds.shift_date = $2", "sds.on_call = true", "sds.status = 'scheduled'"];
    const params: any[] = [tenantId, shiftDate];
    if (ward) { conditions.push(`sds.ward = $3`); params.push(ward); }

    return db.query(
      `SELECT sds.*, u.first_name, u.last_name, u.role
       FROM staff_duty_shifts sds
       JOIN users u ON u.id = sds.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sds.start_time ASC`,
      params,
    );
  }

  async updateShiftStatus(db: any, tenantId: string, shiftId: string, status: string): Promise<any> {
    const rows = await db.query(
      `UPDATE staff_duty_shifts SET status = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [shiftId, tenantId, status],
    );
    if (!rows[0]) throw new NotFoundException('Shift not found');
    return rows[0];
  }

  async rescheduleShift(db: any, tenantId: string, shiftId: string, body: any): Promise<any> {
    const [shift] = await db.query(
      `SELECT * FROM staff_duty_shifts WHERE id = $1 AND tenant_id = $2`,
      [shiftId, tenantId],
    );
    if (!shift) throw new NotFoundException('Shift not found');

    const shiftDate = body.shiftDate ?? shift.shift_date;
    const startTime = body.startTime ?? shift.start_time;
    const endTime = body.endTime ?? shift.end_time;

    const overlaps = await this.findOverlaps(db, tenantId, shift.user_id, shiftDate, startTime, endTime, shiftId);
    if (overlaps.length > 0) {
      throw new ConflictException(
        `Staff member is already rostered on ward "${overlaps[0].ward}" from ${overlaps[0].start_time} to ${overlaps[0].end_time} on ${shiftDate}`,
      );
    }

    const rows = await db.query(
      `UPDATE staff_duty_shifts
       SET ward = $3, shift_date = $4, start_time = $5, end_time = $6, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [shiftId, tenantId, body.ward ?? shift.ward, shiftDate, startTime, endTime],
    );
    return rows[0];
  }

  async addHandoverNote(db: any, tenantId: string, fromUserId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO shift_handover_notes (tenant_id, shift_id, ward, from_user_id, to_user_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [tenantId, body.shiftId ?? null, body.ward, fromUserId, body.toUserId ?? null, body.notes],
    );
    return rows[0];
  }

  async listHandoverNotes(db: any, tenantId: string, ward: string, limit = 20): Promise<any> {
    return db.query(
      `SELECT shn.*, fu.first_name AS from_first_name, fu.last_name AS from_last_name,
              tu.first_name AS to_first_name, tu.last_name AS to_last_name
       FROM shift_handover_notes shn
       JOIN users fu ON fu.id = shn.from_user_id
       LEFT JOIN users tu ON tu.id = shn.to_user_id
       WHERE shn.tenant_id = $1 AND shn.ward = $2
       ORDER BY shn.created_at DESC
       LIMIT $3`,
      [tenantId, ward, limit],
    );
  }
}
