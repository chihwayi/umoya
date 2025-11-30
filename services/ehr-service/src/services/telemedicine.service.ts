import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TelemedicineVideoService } from './telemedicine-video.service';
import { BillingService } from './billing.service';
import { NotificationsService } from './notifications.service';
import {
  CreateTelemedicineConsultationDto,
  UpdateTelemedicineConsultationDto,
  JoinConsultationDto,
  RecordSatisfactionDto,
  TelemedicineConsultationQueryDto,
} from '../dto/telemedicine.dto';

@Injectable()
export class TelemedicineService {
  private readonly logger = new Logger(TelemedicineService.name);

  constructor(
    private readonly videoService: TelemedicineVideoService,
    private readonly billingService: BillingService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

    // TODO: Send notification to patient about scheduled consultation
    // Notification can be sent via SMS using notificationsService.sendSms()
    this.logger.log(`Telemedicine consultation ${result[0].id} scheduled for ${dto.scheduledStartTime}`);

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
   * Update consultation status
   */
  async updateConsultationStatus(
    tenantDb: DataSource,
    id: string,
    status: string,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const params: any[] = [status];

    if (userId) {
      updates.push('updated_by = $2');
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
   * Join consultation
   */
  async joinConsultation(
    tenantDb: DataSource,
    consultationId: string,
    dto: JoinConsultationDto,
  ) {
    this.ensureTenantDb(tenantDb);

    const consultation = await this.getConsultation(tenantDb, consultationId);

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
    }

    if (updates.length === 0) {
      throw new BadRequestException('Invalid role');
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
        : 30.0; // Default telehealth fee

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

      // TODO: Send notification to patient about bill
      // Notification can be sent via SMS using notificationsService.sendSms()
      this.logger.log(`Bill created for consultation ${id}: ${bill.id}`);
    } catch (error) {
      this.logger.error(`Failed to create bill for consultation ${id}:`, error);
      // Don't fail the consultation completion if billing fails
    }

    // TODO: Send completion notification
    // Notification can be sent via SMS using notificationsService.sendSms()
    this.logger.log(`Consultation ${id} completed successfully`);

    return result[0];
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
}

