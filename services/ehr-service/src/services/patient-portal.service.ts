import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Prescription } from '../entities/prescription.entity';
import { Bill } from '../entities/billing.entity';
import { Patient } from '../entities/patient.entity';
import { Vitals } from '../entities/vitals.entity';

@Injectable()
export class PatientPortalService {
  private readonly logger = new Logger(PatientPortalService.name);

  constructor(private tenantService: TenantService) {}

  private async getPatientRepository(tenantId: string): Promise<Repository<Patient>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(Patient);
  }

  // Verify patient owns the resource
  private async verifyPatientAccess(patientId: string, resourcePatientId: string, tenantId: string): Promise<void> {
    if (patientId !== resourcePatientId) {
      throw new ForbiddenException('You do not have access to this resource');
    }
  }

  // Appointments
  async getPatientAppointments(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; status?: string }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Use raw SQL query to ensure proper column mapping
    let query = `
      SELECT 
        a.id,
        a.appointment_date as "appointmentDate",
        a.duration_minutes as "durationMinutes",
        a.appointment_type as "appointmentType",
        a.status,
        a.reason,
        a.notes,
        a.patient_instructions as "patientInstructions",
        a.priority_level as "priorityLevel",
        a.virtual_meeting_url as "virtualMeetingUrl",
        a.is_telehealth as "isTelehealth",
        a.fee_amount as "feeAmount",
        a.payment_status as "paymentStatus",
        u.id as doctor_id,
        u.first_name as doctor_first_name,
        u.last_name as doctor_last_name,
        u.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN users u ON a.doctor_id = u.id
      WHERE a.patient_id = $1
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND a.appointment_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND a.appointment_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    if (filters?.status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    
    query += ` ORDER BY a.appointment_date DESC`;
    
    const rawAppointments = await connection.query(query, params);

    return rawAppointments.map((apt: any) => ({
      id: apt.id,
      appointmentDate: apt.appointmentDate || apt.appointment_date,
      durationMinutes: apt.durationMinutes || apt.duration_minutes,
      appointmentType: apt.appointmentType || apt.appointment_type,
      status: apt.status,
      reason: apt.reason,
      notes: apt.notes,
      patientInstructions: apt.patientInstructions || apt.patient_instructions,
      priorityLevel: apt.priorityLevel || apt.priority_level,
      virtualMeetingUrl: apt.virtualMeetingUrl || apt.virtual_meeting_url,
      isTelehealth: apt.isTelehealth || apt.is_telehealth,
      feeAmount: apt.feeAmount || apt.fee_amount,
      paymentStatus: apt.paymentStatus || apt.payment_status,
      doctor: apt.doctor_id ? {
        id: apt.doctor_id,
        firstName: apt.doctor_first_name,
        lastName: apt.doctor_last_name,
        specialization: apt.doctor_specialization,
      } : null,
    }));
  }

  async getPatientAppointment(patientId: string, appointmentId: string, tenantId: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const appointmentRepository = connection.getRepository(AppointmentSimple);
    const appointment = await appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: ['patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.verifyPatientAccess(patientId, appointment.patientId, tenantId);

    return {
      id: appointment.id,
      appointmentDate: appointment.appointmentDate,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      reason: appointment.reason,
      notes: appointment.notes,
      doctor: appointment.doctor ? {
        id: appointment.doctor.id,
        firstName: appointment.doctor.firstName,
        lastName: appointment.doctor.lastName,
        specialization: appointment.doctor.specialization,
      } : null,
    };
  }

  async requestAppointment(patientId: string, appointmentData: any, tenantId: string): Promise<any> {
    // This would typically go through a booking system
    // For now, return a placeholder
    return {
      success: true,
      message: 'Appointment request submitted. You will receive a confirmation once approved.',
      appointmentRequest: {
        patientId,
        ...appointmentData,
        status: 'pending',
      },
    };
  }

  async cancelAppointment(patientId: string, appointmentId: string, tenantId: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const appointmentRepository = connection.getRepository(AppointmentSimple);
    const appointment = await appointmentRepository.findOne({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    await this.verifyPatientAccess(patientId, appointment.patientId, tenantId);

    if (appointment.status === 'cancelled') {
      throw new ForbiddenException('Appointment is already cancelled');
    }

    appointment.status = 'cancelled';
    await appointmentRepository.save(appointment);

    return {
      success: true,
      message: 'Appointment cancelled successfully',
    };
  }

  // Medical Records
  async getPatientRecords(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; type?: string }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Use raw SQL query to avoid TypeORM column name mapping issues
    // Note: medical_records table uses visit_date, not record_date, and has diagnosis_codes array
    let query = `
      SELECT 
        mr.id,
        mr.visit_date as "recordDate",
        mr.chief_complaint as "chiefComplaint",
        mr.history_present_illness as "historyPresentIllness",
        mr.physical_examination as "physicalExamination",
        mr.assessment,
        mr.plan,
        mr.diagnosis_codes as "diagnosisCodes",
        mr.vital_signs as "vitalSigns",
        u.id as provider_id,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        u.specialization as provider_specialization
      FROM medical_records mr
      LEFT JOIN users u ON mr.doctor_id = u.id
      WHERE mr.patient_id = $1
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND mr.visit_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND mr.visit_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    // Note: medical_records table doesn't have a 'type' column, so we skip that filter
    
    query += ` ORDER BY mr.visit_date DESC`;
    
    const rawRecords = await connection.query(query, params);

    return rawRecords.map((record: any) => ({
      id: record.id,
      recordDate: record.recordDate || record.visit_date,
      type: 'consultation', // Default type since table doesn't have type column
      chiefComplaint: record.chiefComplaint || record.chief_complaint,
      historyPresentIllness: record.historyPresentIllness || record.history_present_illness,
      physicalExamination: record.physicalExamination || record.physical_examination,
      assessment: record.assessment,
      plan: record.plan,
      diagnoses: record.diagnosisCodes || record.diagnosis_codes || [],
      vitalSigns: record.vitalSigns || record.vital_signs,
      provider: record.provider_id ? {
        id: record.provider_id,
        firstName: record.provider_first_name,
        lastName: record.provider_last_name,
        specialization: record.provider_specialization,
      } : null,
    }));
  }

  // Lab Results
  async getPatientLabResults(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const labOrderRepository = connection.getRepository(LabOrder);
    const queryBuilder = labOrderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.patient', 'patient')
      .where('order.patientId = :patientId', { patientId })
      .andWhere('order.status = :status', { status: 'completed' });

    if (filters?.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const orders = await queryBuilder.orderBy('order.createdAt', 'DESC').getMany();

    return orders.map((order) => ({
      id: order.id,
      orderDate: order.createdAt,
      orderNumber: order.orderNumber,
      status: order.status,
      results: order.results || [],
      interpretation: order.interpretation,
    }));
  }

  // Prescriptions
  async getPatientPrescriptions(patientId: string, tenantId: string, filters?: { activeOnly?: boolean }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Use raw SQL query to avoid TypeORM column name mapping issues
    // Note: Only select columns that actually exist in the database
    let query = `
      SELECT 
        p.id,
        p.prescribed_date as "prescribedDate",
        p.created_at as "createdAt",
        p.status,
        p.medication_name as "medicationName",
        p.dosage,
        p.frequency,
        p.duration,
        p.quantity,
        p.instructions,
        u.id as prescriber_id,
        u.first_name as prescriber_first_name,
        u.last_name as prescriber_last_name
      FROM prescriptions p
      LEFT JOIN users u ON p.doctor_id = u.id
      WHERE p.patient_id = $1
    `;
    
    const params: any[] = [patientId];
    
    if (filters?.activeOnly) {
      query += ` AND p.status = $2`;
      params.push('active');
    }
    
    query += ` ORDER BY p.created_at DESC`;
    
    const rawPrescriptions = await connection.query(query, params);
    
    return rawPrescriptions.map((prescription: any) => ({
      id: prescription.id,
      prescribedDate: prescription.prescribedDate || prescription.prescribed_date || prescription.createdAt || prescription.created_at,
      status: prescription.status,
      medicationName: prescription.medicationName || prescription.medication_name,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      quantity: prescription.quantity,
      instructions: prescription.instructions,
      prescriber: prescription.prescriber_id ? {
        id: prescription.prescriber_id,
        firstName: prescription.prescriber_first_name,
        lastName: prescription.prescriber_last_name,
      } : null,
    }));
  }

  // Bills
  async getPatientBills(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; status?: string }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Use raw SQL query to avoid TypeORM column name mapping issues
    let query = `
      SELECT 
        b.id,
        b.invoice_number as "billNumber",
        b.invoice_date as "billDate",
        b.due_date as "dueDate",
        b.total_amount as "totalAmount",
        b.status,
        b.subtotal,
        b.tax_amount as "taxAmount",
        b.discount_amount as "discountAmount",
        b.notes
      FROM billing b
      WHERE b.patient_id = $1
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND b.invoice_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND b.invoice_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    if (filters?.status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    
    query += ` ORDER BY b.invoice_date DESC`;
    
    const rawBills = await connection.query(query, params);

    return rawBills.map((bill: any) => ({
      id: bill.id,
      billNumber: bill.billNumber || bill.invoice_number,
      billDate: bill.billDate || bill.invoice_date,
      totalAmount: bill.totalAmount || bill.total_amount,
      status: bill.status,
      paymentStatus: bill.status, // Map status to paymentStatus for frontend
      items: [], // Items are not stored in billing table
      dueDate: bill.dueDate || bill.due_date,
      subtotal: bill.subtotal,
      taxAmount: bill.taxAmount || bill.tax_amount,
      discountAmount: bill.discountAmount || bill.discount_amount,
      notes: bill.notes,
    }));
  }

  async getPatientBill(patientId: string, billId: string, tenantId: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const billRepository = connection.getRepository(Bill);
    const bill = await billRepository.findOne({
      where: { id: billId },
      relations: ['patient'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    await this.verifyPatientAccess(patientId, bill.patientId, tenantId);

    return {
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      totalAmount: bill.totalAmount,
      status: bill.status,
      paymentStatus: bill.status,
      items: bill.items || [],
      dueDate: bill.dueDate,
      notes: bill.notes,
    };
  }

  // Vitals
  async getPatientVitals(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Use raw SQL query to get vitals
    let query = `
      SELECT 
        v.id,
        v.blood_pressure as "bloodPressure",
        v.heart_rate as "heartRate",
        v.temperature,
        v.oxygen_saturation as "oxygenSaturation",
        v.respiratory_rate as "respiratoryRate",
        v.weight,
        v.height,
        v.bmi,
        v.pain_level as "painLevel",
        v.blood_glucose as "bloodGlucose",
        v.notes,
        v.recorded_at as "recordedAt",
        u.id as recorded_by_id,
        u.first_name as recorded_by_first_name,
        u.last_name as recorded_by_last_name
      FROM vitals v
      LEFT JOIN users u ON v.recorded_by = u.id
      WHERE v.patient_id = $1
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND v.recorded_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND v.recorded_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    
    query += ` ORDER BY v.recorded_at DESC`;
    
    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    } else {
      query += ` LIMIT 100`; // Default limit
    }
    
    const rawVitals = await connection.query(query, params);

    return rawVitals.map((vital: any) => ({
      id: vital.id,
      bloodPressure: vital.bloodPressure || vital.blood_pressure,
      heartRate: vital.heartRate || vital.heart_rate,
      temperature: vital.temperature,
      oxygenSaturation: vital.oxygenSaturation || vital.oxygen_saturation,
      respiratoryRate: vital.respiratoryRate || vital.respiratory_rate,
      weight: vital.weight,
      height: vital.height,
      bmi: vital.bmi,
      painLevel: vital.painLevel || vital.pain_level,
      bloodGlucose: vital.bloodGlucose || vital.blood_glucose,
      notes: vital.notes,
      recordedAt: vital.recordedAt || vital.recorded_at,
      recordedBy: vital.recorded_by_id ? {
        id: vital.recorded_by_id,
        firstName: vital.recorded_by_first_name,
        lastName: vital.recorded_by_last_name,
      } : null,
    }));
  }

  // Dashboard Summary
  async getDashboardSummary(patientId: string, tenantId: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get counts for dashboard
    const [appointmentsCount] = await connection.query(
      `SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1`,
      [patientId]
    );
    
    const [prescriptionsCount] = await connection.query(
      `SELECT COUNT(*) as count FROM prescriptions WHERE patient_id = $1 AND status = 'active'`,
      [patientId]
    );
    
    const [recordsCount] = await connection.query(
      `SELECT COUNT(*) as count FROM medical_records WHERE patient_id = $1`,
      [patientId]
    );
    
    const [billsCount] = await connection.query(
      `SELECT COUNT(*) as count FROM billing WHERE patient_id = $1 AND status != 'paid'`,
      [patientId]
    );
    
    const [vitalsCount] = await connection.query(
      `SELECT COUNT(*) as count FROM vitals WHERE patient_id = $1`,
      [patientId]
    );

    // Get upcoming appointment
    const [upcomingAppointment] = await connection.query(
      `SELECT id, appointment_date, status, reason 
       FROM appointments 
       WHERE patient_id = $1 AND appointment_date >= NOW() AND status IN ('scheduled', 'confirmed')
       ORDER BY appointment_date ASC 
       LIMIT 1`,
      [patientId]
    );

    // Get latest vitals
    const [latestVitals] = await connection.query(
      `SELECT id, blood_pressure, heart_rate, temperature, recorded_at
       FROM vitals 
       WHERE patient_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 1`,
      [patientId]
    );

    return {
      summary: {
        appointments: parseInt(appointmentsCount?.count || '0'),
        activePrescriptions: parseInt(prescriptionsCount?.count || '0'),
        medicalRecords: parseInt(recordsCount?.count || '0'),
        pendingBills: parseInt(billsCount?.count || '0'),
        vitalsRecords: parseInt(vitalsCount?.count || '0'),
      },
      upcomingAppointment: upcomingAppointment ? {
        id: upcomingAppointment.id,
        appointmentDate: upcomingAppointment.appointment_date,
        status: upcomingAppointment.status,
        reason: upcomingAppointment.reason,
      } : null,
      latestVitals: latestVitals ? {
        id: latestVitals.id,
        bloodPressure: latestVitals.blood_pressure,
        heartRate: latestVitals.heart_rate,
        temperature: latestVitals.temperature,
        recordedAt: latestVitals.recorded_at,
      } : null,
    };
  }
}
