import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new Error('Tenant database connection is required');
    }
  }

  // ==================== CREATE & UPDATE ====================

  async createReferral(patientId: string, referralData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO referrals (
        patient_id, referring_provider_id, referring_facility_name,
        referred_to_provider_id, referred_to_facility_name, referred_to_facility_address,
        referred_to_facility_phone, referred_to_facility_email, referral_type, specialty,
        priority, urgency, reason, clinical_summary, relevant_history,
        current_medications, allergies, diagnostic_tests_ordered, requested_services,
        referral_date, requested_appointment_date, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW())
      RETURNING *`,
      [
        patientId,
        userId,
        referralData.referringFacilityName || null,
        referralData.referredToProviderId || null,
        referralData.referredToFacilityName,
        referralData.referredToFacilityAddress || null,
        referralData.referredToFacilityPhone || null,
        referralData.referredToFacilityEmail || null,
        referralData.referralType,
        referralData.specialty || null,
        referralData.priority || 'normal',
        referralData.urgency || 'routine',
        referralData.reason,
        referralData.clinicalSummary || null,
        referralData.relevantHistory || null,
        referralData.currentMedications || null,
        referralData.allergies || null,
        referralData.diagnosticTestsOrdered || null,
        referralData.requestedServices || null,
        referralData.referralDate || new Date().toISOString().split('T')[0],
        referralData.requestedAppointmentDate || null,
        referralData.status || 'draft',
      ],
    );

    const referral = result[0];

    // Create initial status history
    await this.addStatusHistory(referral.id, null, referral.status, userId, 'Referral created', tenantDb);

    return referral;
  }

  async updateReferral(referralId: string, updates: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(`SELECT * FROM referrals WHERE id = $1`, [referralId]);
    if (existing.length === 0) {
      throw new NotFoundException('Referral not found');
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      referredToProviderId: 'referred_to_provider_id',
      referredToFacilityName: 'referred_to_facility_name',
      referredToFacilityAddress: 'referred_to_facility_address',
      referredToFacilityPhone: 'referred_to_facility_phone',
      referredToFacilityEmail: 'referred_to_facility_email',
      referralType: 'referral_type',
      clinicalSummary: 'clinical_summary',
      relevantHistory: 'relevant_history',
      currentMedications: 'current_medications',
      diagnosticTestsOrdered: 'diagnostic_tests_ordered',
      requestedServices: 'requested_services',
      referralDate: 'referral_date',
      requestedAppointmentDate: 'requested_appointment_date',
      responseNotes: 'response_notes',
      outcomeSummary: 'outcome_summary',
      cancellationReason: 'cancellation_reason',
      rejectionReason: 'rejection_reason',
    };

    for (const [key, dbColumn] of Object.entries(fieldMappings)) {
      if (updates[key] !== undefined) {
        updateFields.push(`${dbColumn} = $${paramIndex++}`);
        values.push(updates[key]);
      }
    }

    // Handle simple fields
    const simpleFields = ['specialty', 'priority', 'urgency', 'reason', 'allergies', 'status'];
    for (const field of simpleFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return existing[0];
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(referralId);

    const result = await tenantDb.query(
      `UPDATE referrals SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    // If status changed, add to history
    if (updates.status && updates.status !== existing[0].status) {
      await this.addStatusHistory(
        referralId,
        existing[0].status,
        updates.status,
        userId,
        updates.statusNotes || 'Status updated',
        tenantDb,
      );
    }

    return result[0];
  }

  async deleteReferral(referralId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`DELETE FROM referrals WHERE id = $1 RETURNING *`, [referralId]);
    if (result.length === 0) {
      throw new NotFoundException('Referral not found');
    }

    return { success: true, message: 'Referral deleted' };
  }

  // ==================== RETRIEVE ====================

  async getReferrals(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `
      SELECT r.*, 
        p.first_name as patient_first_name, p.last_name as patient_last_name,
        u.first_name as referring_provider_first_name, u.last_name as referring_provider_last_name
      FROM referrals r
      LEFT JOIN patients p ON r.patient_id = p.id
      LEFT JOIN users u ON r.referring_provider_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filters.patientId) {
      query += ` AND r.patient_id = $${paramIndex++}`;
      params.push(filters.patientId);
    }

    if (filters.referringProviderId) {
      query += ` AND r.referring_provider_id = $${paramIndex++}`;
      params.push(filters.referringProviderId);
    }

    if (filters.status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.referralType) {
      query += ` AND r.referral_type = $${paramIndex++}`;
      params.push(filters.referralType);
    }

    if (filters.specialty) {
      query += ` AND r.specialty = $${paramIndex++}`;
      params.push(filters.specialty);
    }

    if (filters.priority) {
      query += ` AND r.priority = $${paramIndex++}`;
      params.push(filters.priority);
    }

    if (filters.startDate) {
      query += ` AND r.referral_date >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND r.referral_date <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    query += ` ORDER BY r.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    return tenantDb.query(query, params);
  }

  async getReferralById(referralId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT r.*, 
        p.first_name as patient_first_name, p.last_name as patient_last_name, p.date_of_birth as patient_dob,
        u.first_name as referring_provider_first_name, u.last_name as referring_provider_last_name,
        u2.first_name as referred_to_provider_first_name, u2.last_name as referred_to_provider_last_name
      FROM referrals r
      LEFT JOIN patients p ON r.patient_id = p.id
      LEFT JOIN users u ON r.referring_provider_id = u.id
      LEFT JOIN users u2 ON r.referred_to_provider_id = u2.id
      WHERE r.id = $1`,
      [referralId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Referral not found');
    }

    return result[0];
  }

  // ==================== STATUS MANAGEMENT ====================

  async updateReferralStatus(referralId: string, status: string, notes: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await this.getReferralById(referralId, tenantDb);
    
    const result = await tenantDb.query(
      `UPDATE referrals SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, referralId],
    );

    await this.addStatusHistory(referralId, existing.status, status, userId, notes, tenantDb);

    // Update date fields based on status
    if (status === 'sent') {
      await tenantDb.query(`UPDATE referrals SET response_received_date = NULL WHERE id = $1`, [referralId]);
    } else if (status === 'acknowledged') {
      await tenantDb.query(`UPDATE referrals SET response_received_date = CURRENT_DATE WHERE id = $1`, [referralId]);
    } else if (status === 'scheduled') {
      await tenantDb.query(`UPDATE referrals SET appointment_scheduled_date = CURRENT_DATE WHERE id = $1`, [referralId]);
    } else if (status === 'completed') {
      await tenantDb.query(`UPDATE referrals SET appointment_completed_date = CURRENT_DATE WHERE id = $1`, [referralId]);
    }

    return result[0];
  }

  async sendReferral(referralId: string, method: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const referral = await this.getReferralById(referralId, tenantDb);

    if (referral.status !== 'draft' && referral.status !== 'pending') {
      throw new BadRequestException('Only draft or pending referrals can be sent');
    }

    // TODO: Implement actual sending logic (email/fax/API)
    this.logger.log(`Sending referral ${referralId} via ${method}`);

    return this.updateReferralStatus(referralId, 'sent', `Referral sent via ${method}`, userId, tenantDb);
  }

  async acknowledgeReferral(referralId: string, responseData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    await tenantDb.query(
      `UPDATE referrals 
       SET status = 'acknowledged', 
           response_received_date = CURRENT_DATE,
           response_notes = $1,
           external_referral_id = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [responseData.notes || null, responseData.externalReferralId || null, referralId],
    );

    await this.addStatusHistory(
      referralId,
      'sent',
      'acknowledged',
      userId,
      responseData.notes || 'Referral acknowledged by facility',
      tenantDb,
    );

    return this.getReferralById(referralId, tenantDb);
  }

  async scheduleAppointment(referralId: string, appointmentData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    await tenantDb.query(
      `UPDATE referrals 
       SET status = 'scheduled', 
           appointment_scheduled_date = $1,
           response_notes = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [appointmentData.appointmentDate, appointmentData.notes || null, referralId],
    );

    await this.addStatusHistory(
      referralId,
      null,
      'scheduled',
      userId,
      `Appointment scheduled for ${appointmentData.appointmentDate}`,
      tenantDb,
    );

    return this.getReferralById(referralId, tenantDb);
  }

  async completeReferral(referralId: string, outcomeData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    await tenantDb.query(
      `UPDATE referrals 
       SET status = 'completed', 
           appointment_completed_date = CURRENT_DATE,
           outcome_summary = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [outcomeData.outcomeSummary || null, referralId],
    );

    await this.addStatusHistory(
      referralId,
      null,
      'completed',
      userId,
      outcomeData.notes || 'Referral completed',
      tenantDb,
    );

    return this.getReferralById(referralId, tenantDb);
  }

  async cancelReferral(referralId: string, reason: string, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    await tenantDb.query(
      `UPDATE referrals 
       SET status = 'cancelled', 
           cancellation_reason = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [reason, referralId],
    );

    await this.addStatusHistory(referralId, null, 'cancelled', userId, reason, tenantDb);

    return this.getReferralById(referralId, tenantDb);
  }

  // ==================== STATUS HISTORY ====================

  private async addStatusHistory(
    referralId: string,
    oldStatus: string | null,
    newStatus: string,
    userId: string,
    notes: string,
    tenantDb: DataSource,
  ) {
    await tenantDb.query(
      `INSERT INTO referral_status_history (referral_id, old_status, new_status, changed_by, notes, change_date, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [referralId, oldStatus, newStatus, userId, notes],
    );
  }

  async getReferralStatusHistory(referralId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT rsh.*, u.first_name, u.last_name
       FROM referral_status_history rsh
       LEFT JOIN users u ON rsh.changed_by = u.id
       WHERE rsh.referral_id = $1
       ORDER BY rsh.change_date DESC`,
      [referralId],
    );
  }

  // ==================== ATTACHMENTS ====================

  async addAttachment(referralId: string, attachmentData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO referral_attachments (
        referral_id, document_type, document_name, file_path, file_url,
        file_size, mime_type, description, uploaded_by, uploaded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        referralId,
        attachmentData.documentType,
        attachmentData.documentName,
        attachmentData.filePath || null,
        attachmentData.fileUrl || null,
        attachmentData.fileSize || null,
        attachmentData.mimeType || null,
        attachmentData.description || null,
        userId,
      ],
    );

    return result[0];
  }

  async getReferralAttachments(referralId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT ra.*, u.first_name, u.last_name
       FROM referral_attachments ra
       LEFT JOIN users u ON ra.uploaded_by = u.id
       WHERE ra.referral_id = $1
       ORDER BY ra.uploaded_at DESC`,
      [referralId],
    );
  }

  async deleteAttachment(attachmentId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `DELETE FROM referral_attachments WHERE id = $1 RETURNING *`,
      [attachmentId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Attachment not found');
    }

    return { success: true, message: 'Attachment deleted' };
  }

  // ==================== ANALYTICS ====================

  async getReferralAnalytics(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const stats = await tenantDb.query(`
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_referrals,
        AVG(CASE 
          WHEN appointment_completed_date IS NOT NULL AND referral_date IS NOT NULL 
          THEN appointment_completed_date - referral_date 
        END) as avg_completion_days
      FROM referrals
      WHERE 1=1
      ${filters.startDate ? `AND referral_date >= '${filters.startDate}'` : ''}
      ${filters.endDate ? `AND referral_date <= '${filters.endDate}'` : ''}
    `);

    const byType = await tenantDb.query(`
      SELECT referral_type, COUNT(*) as count
      FROM referrals
      WHERE 1=1
      ${filters.startDate ? `AND referral_date >= '${filters.startDate}'` : ''}
      ${filters.endDate ? `AND referral_date <= '${filters.endDate}'` : ''}
      GROUP BY referral_type
      ORDER BY count DESC
    `);

    const bySpecialty = await tenantDb.query(`
      SELECT specialty, COUNT(*) as count
      FROM referrals
      WHERE specialty IS NOT NULL
      ${filters.startDate ? `AND referral_date >= '${filters.startDate}'` : ''}
      ${filters.endDate ? `AND referral_date <= '${filters.endDate}'` : ''}
      GROUP BY specialty
      ORDER BY count DESC
      LIMIT 10
    `);

    return {
      summary: stats[0],
      byType,
      bySpecialty,
    };
  }
}


