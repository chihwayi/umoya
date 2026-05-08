import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TelemedicineVideoService } from './telemedicine-video.service';
import { BillingService } from './billing.service';
import { NotificationsService } from './notifications.service';
import { TenantService } from './tenant.service';
import { TelemedicineGateway } from '../gateways/telemedicine.gateway';
import { TelemedicinePostVisitBridgeService } from './telemedicine-postvisit-bridge.service';
import { TelemedicineConsentService } from './telemedicine-consent.service';
import {
  CreateTelemedicineConsultationDto,
  UpdateTelemedicineConsultationDto,
  JoinConsultationDto,
  RecordSatisfactionDto,
  TelemedicineConsultationQueryDto,
} from '../dto/telemedicine.dto';

// Valid status transitions — any other move throws BadRequestException
const STATUS_TRANSITIONS: Record<string, string[]> = {
  scheduled:       ['in_progress', 'cancelled'],
  in_progress:     ['completed', 'technical_issue', 'cancelled'],
  technical_issue: ['in_progress', 'cancelled'],
  completed:       [],
  cancelled:       [],
  no_show:         [],
};

@Injectable()
export class TelemedicineService {
  private readonly logger = new Logger(TelemedicineService.name);

  constructor(
    private readonly videoService: TelemedicineVideoService,
    private readonly billingService: BillingService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly tenantService?: TenantService,
    @Optional() private readonly teleGateway?: TelemedicineGateway,
    @Optional() private readonly postVisitBridge?: TelemedicinePostVisitBridgeService,
    @Optional() private readonly consentService?: TelemedicineConsentService,
  ) {}

  // ── 15-minute reminder cron ──────────────────────────────────────────────────

  /**
   * Runs every 5 minutes. Finds consultations starting in 10–20 min
   * that haven't had a reminder sent yet and fires an SMS to the patient.
   */
  @Cron('*/5 * * * *')
  async sendUpcomingConsultationReminders() {
    const tenants = await this.tenantService?.getAllActiveTenants?.().catch(() => []) ?? [];
    for (const subdomain of tenants) {
      const tenantDb = await this.tenantService?.getTenantDatabase(subdomain).catch(() => null);
      if (!tenantDb) continue;
      await this.sendRemindersForTenant(tenantDb).catch(e =>
        this.logger.warn(`Reminder cron failed for ${subdomain}: ${e?.message}`),
      );
    }
  }

  private async sendRemindersForTenant(tenantDb: DataSource): Promise<void> {
    const upcoming = await tenantDb.query(`
      SELECT tc.id, tc.patient_id, tc.doctor_id, tc.scheduled_start_time,
             p.phone_number, p.first_name,
             u.first_name || ' ' || u.last_name AS doctor_name
      FROM telemedicine_consultations tc
      JOIN patients p ON p.id = tc.patient_id
      LEFT JOIN users u ON u.id = tc.doctor_id
      WHERE tc.status = 'scheduled'
        AND tc.scheduled_start_time BETWEEN NOW() + INTERVAL '10 minutes'
                                        AND NOW() + INTERVAL '20 minutes'
        AND tc.reminder_sent_at IS NULL
    `).catch(() => []);

    for (const row of upcoming) {
      if (!row.phone_number) continue;

      const time = new Date(row.scheduled_start_time).toLocaleString('en-ZW', {
        timeStyle: 'short', timeZone: 'Africa/Harare',
      });

      await this.notificationsService.sendSms({
        phone: row.phone_number,
        message:
          `Reminder: Your telemedicine consultation with ${row.doctor_name ?? 'your doctor'} ` +
          `starts at ${time} — in about 15 minutes. Log in to your patient portal now to join.`,
      }).catch(e => this.logger.warn(`Reminder SMS failed for patient ${row.patient_id}: ${e?.message}`));

      await tenantDb.query(
        `UPDATE telemedicine_consultations SET reminder_sent_at = NOW() WHERE id = $1`,
        [row.id],
      ).catch(() => {});
    }
  }

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Create a new telemedicine consultation
   */
  async createConsultation(
    tenantDb: DataSource,
    dto: CreateTelemedicineConsultationDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    // Generate a UUID for the consultation
    const [consultationIdResult] = await tenantDb.query(`SELECT gen_random_uuid() as id`);
    const consultationId = consultationIdResult.id;

    // Create meeting room
    const { meetingRoomId, meetingUrl, meetingPassword } = await this.videoService.createMeetingRoom(
      consultationId,
      dto.patientId,
      dto.doctorId,
    );

    // Create consultation record
    const result = await tenantDb.query(
      `INSERT INTO telemedicine_consultations (
        id, appointment_id, patient_id, doctor_id, consultation_type,
        meeting_room_id, meeting_url, meeting_password, scheduled_start_time,
        status, patient_consent, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', false, $10, NOW(), NOW())
      RETURNING *`,
      [
        consultationId,
        dto.appointmentId ?? null,
        dto.patientId,
        dto.doctorId,
        dto.consultationType ?? 'video',
        meetingRoomId,
        meetingUrl,
        meetingPassword ?? null,
        dto.scheduledStartTime,
        userId ?? null,
      ],
    );

    // SMS: notify patient of scheduled consultation
    const scheduledTime = new Date(dto.scheduledStartTime).toLocaleString('en-ZW', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Harare',
    });
    this.sendSmsToPatient(tenantDb, dto.patientId,
      `Your telemedicine consultation has been scheduled for ${scheduledTime}. ` +
      `You will receive a reminder 15 minutes before. Log in to your patient portal to join.`,
    );

    this.logger.log(`Telemedicine consultation ${result[0].id} scheduled for ${dto.scheduledStartTime}`);

    return result[0];
  }

  /**
   * Full update of editable consultation fields (scheduled time, type, notes).
   * Status changes must go through updateConsultationStatus to enforce the state machine.
   */
  async updateConsultation(
    tenantDb: DataSource,
    id: string,
    dto: UpdateTelemedicineConsultationDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];

    if (dto.scheduledStartTime !== undefined) {
      params.push(dto.scheduledStartTime);
      updates.push(`scheduled_start_time = $${params.length}`);
    }
    if (dto.consultationType !== undefined) {
      params.push(dto.consultationType);
      updates.push(`consultation_type = $${params.length}`);
    }
    if (dto.notes !== undefined) {
      params.push(dto.notes);
      updates.push(`notes = $${params.length}`);
    }
    if (dto.recordingEnabled !== undefined) {
      params.push(dto.recordingEnabled);
      updates.push(`recording_enabled = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      updates.push(`updated_by = $${params.length}`);
    }
    // Status changes routed through state machine
    if (dto.status !== undefined) {
      return this.updateConsultationStatus(tenantDb, id, dto.status, userId);
    }

    params.push(id);
    const result = await tenantDb.query(
      `UPDATE telemedicine_consultations
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params,
    );

    if (!result.length) {
      throw new NotFoundException(`Telemedicine consultation ${id} not found`);
    }

    return result[0];
  }

  /**
   * Get consultation by ID
   */
  async getConsultation(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);

    const [consultation] = await tenantDb.query(
      `SELECT tc.*,
              p.first_name || ' ' || p.last_name as patient_name,
              p.patient_number,
              u.first_name || ' ' || u.last_name as doctor_name,
              a.appointment_date
       FROM telemedicine_consultations tc
       LEFT JOIN patients p ON p.id = tc.patient_id
       LEFT JOIN users u ON u.id = tc.doctor_id
       LEFT JOIN appointments a ON a.id = tc.appointment_id
       WHERE tc.id = $1`,
      [id],
    );

    if (!consultation) {
      throw new NotFoundException(`Telemedicine consultation ${id} not found`);
    }

    // Get technical logs
    const technicalLogs = await tenantDb.query(
      `SELECT * FROM telemedicine_technical_logs WHERE consultation_id = $1 ORDER BY created_at DESC`,
      [id],
    );

    return {
      ...consultation,
      technicalLogs,
    };
  }

  /**
   * Update consultation status — validates state machine transitions.
   */
  async updateConsultationStatus(
    tenantDb: DataSource,
    id: string,
    status: string,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const consultation = await this.getConsultation(tenantDb, id);
    const currentStatus: string = consultation.status;
    const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Invalid status transition: ${currentStatus} → ${status}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }

    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: any[] = [status];

    if (userId) {
      updates.push(`updated_by = $${params.length + 1}`);
      params.push(userId);
    }

    params.push(id);

    const result = await tenantDb.query(
      `UPDATE telemedicine_consultations
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params,
    );

    if (!result.length) {
      throw new NotFoundException(`Telemedicine consultation ${id} not found`);
    }

    return result[0];
  }

  /**
   * Join consultation — updates DB and broadcasts tele:participant_joined via WebSocket.
   */
  async joinConsultation(
    tenantDb: DataSource,
    consultationId: string,
    dto: JoinConsultationDto,
  ) {
    this.ensureTenantDb(tenantDb);

    const consultation = await this.getConsultation(tenantDb, consultationId);

    if (consultation.status === 'completed' || consultation.status === 'cancelled') {
      throw new BadRequestException(`Cannot join a ${consultation.status} consultation`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.role === 'patient') {
      updates.push('patient_joined = true', 'patient_join_time = NOW()');
      if (!consultation.actual_start_time) {
        updates.push('actual_start_time = NOW()', "status = 'in_progress'");
      }
    } else if (dto.role === 'doctor') {
      updates.push('doctor_joined = true', 'doctor_join_time = NOW()');
      if (!consultation.actual_start_time) {
        updates.push('actual_start_time = NOW()', "status = 'in_progress'");
      }
    } else {
      throw new BadRequestException('Invalid role — must be patient or doctor');
    }

    updates.push('updated_at = NOW()');
    params.push(consultationId);

    const result = await tenantDb.query(
      `UPDATE telemedicine_consultations
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params,
    );

    // Broadcast join event — other participant sees this in real time
    this.teleGateway?.broadcastToConsultation(consultationId, 'tele:participant_joined', {
      userId: dto.userId,
      role: dto.role,
      timestamp: new Date().toISOString(),
    });

    return result[0];
  }

  /**
   * End consultation
   */
  async endConsultation(tenantDb: DataSource, id: string, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const consultation = await this.getConsultation(tenantDb, id);

    if (consultation.status === 'completed') {
      throw new ConflictException('Consultation is already completed');
    }

    const actualEndTime = new Date();
    const actualStartTime = consultation.actual_start_time ? new Date(consultation.actual_start_time) : actualEndTime;
    const durationMinutes = Math.floor((actualEndTime.getTime() - actualStartTime.getTime()) / 60000);

    const updates: string[] = [
      "status = 'completed'",
      'actual_end_time = NOW()',
      `duration_minutes = ${durationMinutes}`,
      'updated_at = NOW()',
    ];
    const params: any[] = [];

    if (userId) {
      updates.push('updated_by = $1');
      params.push(userId);
    }

    params.push(id);

    const result = await tenantDb.query(
      `UPDATE telemedicine_consultations 
       SET ${updates.join(', ')} 
       WHERE id = $${params.length} 
       RETURNING *`,
      params,
    );

    // End meeting room
    if (consultation.meeting_room_id) {
      await this.videoService.endMeeting(id, consultation.meeting_room_id);
    }

    // Create bill for completed consultation
    try {
      const telehealthFee = process.env.TELEHEALTH_CONSULTATION_FEE
        ? parseFloat(process.env.TELEHEALTH_CONSULTATION_FEE)
        : 30.0;

      const bill = await this.billingService.createBill(
        {
          patientId: consultation.patient_id,
          appointmentId: consultation.appointment_id || null,
          items: [
            {
              description: `Telemedicine Consultation (${consultation.consultation_type})`,
              billingCode: 'TELEHEALTH',
              unitPrice: telehealthFee,
              quantity: 1,
              totalPrice: telehealthFee,
            },
          ],
          subtotal: telehealthFee,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: telehealthFee,
          status: 'pending',
          notes: `Telemedicine consultation completed. Duration: ${durationMinutes} minutes`,
        },
        tenantDb,
        userId || consultation.doctor_id,
      );

      this.logger.log(`Bill created for consultation ${id}: ${bill.id}`);

      // SMS: notify patient a bill has been raised
      this.sendSmsToPatient(tenantDb, consultation.patient_id,
        `Your telemedicine consultation is complete (${durationMinutes} min). ` +
        `A bill of $${telehealthFee.toFixed(2)} has been raised. View it in your patient portal.`,
      );
    } catch (error) {
      this.logger.error(`Failed to create bill for consultation ${id}:`, error);
      // Don't fail consultation completion if billing fails
    }

    // Broadcast consultation_ended to both participants via WebSocket
    this.teleGateway?.broadcastToConsultation(id, 'tele:consultation_ended', {
      consultationId: id,
      endedAt: actualEndTime.toISOString(),
      durationMinutes,
    });

    // SMS: completion confirmation to patient
    this.sendSmsToPatient(tenantDb, consultation.patient_id,
      `Your telemedicine consultation with ${consultation.doctor_name ?? 'your doctor'} has ended. ` +
      `Duration: ${durationMinutes} minute(s). Your post-visit summary will be ready shortly.`,
    );

    // Bridge → auto-create post-visit session + attach recording (async, non-blocking)
    this.postVisitBridge?.onConsultationEnded(tenantDb, {
      ...result[0],
      doctor_name: consultation.doctor_name,
      patient_name: consultation.patient_name,
    }).catch(e => this.logger.error(`Post-visit bridge error for ${id}: ${e?.message}`));

    this.logger.log(`Consultation ${id} completed (${durationMinutes} min)`);

    return result[0];
  }

  /**
   * Fire-and-forget SMS to patient — looks up phone number from patients table.
   * Swallows errors so it never fails the parent operation.
   */
  private sendSmsToPatient(tenantDb: DataSource, patientId: string, message: string): void {
    tenantDb.query(
      `SELECT phone_number FROM patients WHERE id = $1`,
      [patientId],
    ).then(rows => {
      const phone: string | undefined = rows[0]?.phone_number;
      if (phone) {
        this.notificationsService.sendSms({ phone, message }).catch(e =>
          this.logger.warn(`SMS to patient ${patientId} failed: ${e?.message}`),
        );
      }
    }).catch(() => {/* no-op */});
  }

  /**
   * List consultations with filters
   */
  async listConsultations(tenantDb: DataSource, filters: TelemedicineConsultationQueryDto) {
    this.ensureTenantDb(tenantDb);

    const where: string[] = [];
    const params: any[] = [];

    if (filters.patientId) {
      where.push(`tc.patient_id = $${params.length + 1}`);
      params.push(filters.patientId);
    }

    if (filters.doctorId) {
      where.push(`tc.doctor_id = $${params.length + 1}`);
      params.push(filters.doctorId);
    }

    if (filters.status) {
      where.push(`tc.status = $${params.length + 1}`);
      params.push(filters.status);
    }

    if (filters.dateFrom) {
      where.push(`tc.scheduled_start_time >= $${params.length + 1}`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      where.push(`tc.scheduled_start_time <= $${params.length + 1}`);
      params.push(filters.dateTo);
    }

    if (filters.appointmentId) {
      where.push(`tc.appointment_id = $${params.length + 1}`);
      params.push(filters.appointmentId);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const consultations = await tenantDb.query(
      `SELECT tc.*,
              p.first_name || ' ' || p.last_name as patient_name,
              p.patient_number,
              u.first_name || ' ' || u.last_name as doctor_name
       FROM telemedicine_consultations tc
       LEFT JOIN patients p ON p.id = tc.patient_id
       LEFT JOIN users u ON u.id = tc.doctor_id
       ${whereClause}
       ORDER BY tc.scheduled_start_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const [totalResult] = await tenantDb.query(
      `SELECT COUNT(*)::int as count FROM telemedicine_consultations tc ${whereClause}`,
      params.slice(0, params.length - 2),
    );

    return {
      consultations,
      total: totalResult?.count ?? consultations.length,
      page,
      limit,
    };
  }

  /**
   * Update connection quality
   */
  async updateConnectionQuality(
    tenantDb: DataSource,
    consultationId: string,
    quality: string,
    role: 'patient' | 'doctor',
  ) {
    this.ensureTenantDb(tenantDb);

    const column = role === 'patient' ? 'connection_quality' : 'doctor_connection_quality';

    const result = await tenantDb.query(
      `UPDATE telemedicine_consultations 
       SET ${column} = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [quality, consultationId],
    );

    if (!result.length) {
      throw new NotFoundException(`Telemedicine consultation ${consultationId} not found`);
    }

    return result[0];
  }

  /**
   * Record technical issue
   */
  async recordTechnicalIssue(
    tenantDb: DataSource,
    consultationId: string,
    logType: string,
    severity: string,
    description: string,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO telemedicine_technical_logs (
        consultation_id, log_type, severity, description, resolved, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      RETURNING *`,
      [consultationId, logType, severity, description],
    );

    // Update consultation with technical issues
    await tenantDb.query(
      `UPDATE telemedicine_consultations 
       SET technical_issues = COALESCE(technical_issues || E'\\n', '') || $1,
           status = CASE WHEN status != 'completed' THEN 'technical_issue' ELSE status END,
           updated_at = NOW()
       WHERE id = $2`,
      [`[${new Date().toISOString()}] ${description}`, consultationId],
    );

    return result[0];
  }

  /**
   * Record patient satisfaction
   */
  async recordSatisfaction(
    tenantDb: DataSource,
    consultationId: string,
    dto: RecordSatisfactionDto,
  ) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `UPDATE telemedicine_consultations 
       SET satisfaction_rating = $1, 
           satisfaction_feedback = $2,
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [dto.rating, dto.feedback ?? null, consultationId],
    );

    if (!result.length) {
      throw new NotFoundException(`Telemedicine consultation ${consultationId} not found`);
    }

    return result[0];
  }

  /**
   * Get meeting URL
   */
  async getMeetingUrl(tenantDb: DataSource, consultationId: string) {
    this.ensureTenantDb(tenantDb);

    const consultation = await this.getConsultation(tenantDb, consultationId);

    if (!consultation.meeting_room_id) {
      throw new BadRequestException('Meeting room not created for this consultation');
    }

    return {
      meetingUrl: consultation.meeting_url,
      meetingPassword: consultation.meeting_password,
      meetingRoomId: consultation.meeting_room_id,
    };
  }

  /**
   * Get a signed Daily.co meeting token for a participant.
   * Validates the user is the patient or doctor on this consultation before issuing.
   */
  async getMeetingToken(
    tenantDb: DataSource,
    consultationId: string,
    userId: string,
    role: 'doctor' | 'patient',
  ) {
    this.ensureTenantDb(tenantDb);

    const consultation = await this.getConsultation(tenantDb, consultationId);

    if (!consultation.meeting_room_id) {
      throw new BadRequestException('Meeting room not created for this consultation');
    }

    if (consultation.status === 'completed' || consultation.status === 'cancelled') {
      throw new BadRequestException(`Cannot join a ${consultation.status} consultation`);
    }

    // Authorisation: ensure the requesting user is the patient or doctor on record
    if (role === 'doctor' && consultation.doctor_id !== userId) {
      throw new BadRequestException('Requesting user is not the assigned doctor for this consultation');
    }
    if (role === 'patient' && consultation.patient_id !== userId) {
      throw new BadRequestException('Requesting user is not the patient for this consultation');
    }

    // Enforce patient consent before issuing a meeting token
    if (role === 'patient' && this.consentService) {
      const hasConsent = await this.consentService.checkConsent(tenantDb, consultation.patient_id);
      if (!hasConsent) {
        throw new BadRequestException(
          'Patient has not granted telehealth consent. Use POST /telemedicine/consultations/:id/consent to grant consent before joining.',
        );
      }
    }

    const displayName = role === 'doctor' ? consultation.doctor_name : consultation.patient_name;
    const token = await this.videoService.getMeetingToken(
      consultation.meeting_room_id,
      userId,
      role,
      displayName,
    );

    return {
      token,
      meetingUrl: consultation.meeting_url,
      meetingRoomId: consultation.meeting_room_id,
      role,
      expiresInSeconds: 7200,
    };
  }

  /**
   * Get live room status from Daily.co (real participant count).
   */
  async getRoomStatus(tenantDb: DataSource, consultationId: string) {
    this.ensureTenantDb(tenantDb);

    const consultation = await this.getConsultation(tenantDb, consultationId);

    if (!consultation.meeting_room_id) {
      return { isActive: false, participants: 0, meetingRoomId: null };
    }

    const status = await this.videoService.getMeetingStatus(consultationId, consultation.meeting_room_id);
    return { ...status, meetingRoomId: consultation.meeting_room_id };
  }
}
