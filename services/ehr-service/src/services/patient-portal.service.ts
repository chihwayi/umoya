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

    this.logger.log(`[getPatientRecords] Querying medical records for patientId: ${patientId}, tenantId: ${tenantId}`);
    
    // Verify patient exists
    const patientCheck = await connection.query(
      `SELECT id, first_name, last_name, patient_number FROM patients WHERE id = $1`,
      [patientId]
    );
    
    if (!patientCheck || patientCheck.length === 0) {
      this.logger.warn(`[getPatientRecords] Patient not found: ${patientId}`);
      return [];
    }
    
    this.logger.log(`[getPatientRecords] Patient found: ${patientCheck[0].first_name} ${patientCheck[0].last_name} (${patientCheck[0].patient_number})`);
    
    // Debug: Check which database we're connected to
    const dbName = await connection.query(`SELECT current_database() as db_name`);
    this.logger.log(`[getPatientRecords] Connected to database: ${JSON.stringify(dbName)}`);
    
    // Debug: Check record count directly
    const directCount = await connection.query(
      `SELECT COUNT(*) as count FROM medical_records WHERE patient_id = $1`,
      [patientId]
    );
    this.logger.log(`[getPatientRecords] Direct count query result: ${JSON.stringify(directCount)}`);
    
    // Debug: Get all records for this patient without joins
    const directRecords = await connection.query(
      `SELECT id, patient_id, visit_date, chief_complaint FROM medical_records WHERE patient_id = $1`,
      [patientId]
    );
    this.logger.log(`[getPatientRecords] Direct records query result: ${JSON.stringify(directRecords)}`);
    
    // If direct query finds records but main query doesn't, there's a join issue
    if (directRecords && directRecords.length > 0) {
      this.logger.warn(`[getPatientRecords] Direct query found ${directRecords.length} records but main query may fail due to JOIN`);
    }

    // Use raw SQL query - EXACT same pattern as getPatientAppointments which works
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
    
    this.logger.log(`[getPatientRecords] Executing query with patientId: ${patientId}`);
    const rawRecords = await connection.query(query, params);
    
    this.logger.log(`[getPatientRecords] Found ${rawRecords.length} medical records for patient ${patientId}`);

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

    this.logger.debug(`getPatientPrescriptions: patientId=${patientId}, tenantId=${tenantId}, activeOnly=${filters?.activeOnly}`);

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
    
    query += ` ORDER BY p.prescribed_date DESC NULLS LAST, p.created_at DESC`;
    
    this.logger.debug(`Prescriptions query: ${query}, params: ${JSON.stringify(params)}`);
    const rawPrescriptions = await connection.query(query, params);
    this.logger.debug(`Prescriptions query returned ${rawPrescriptions.length} results`);
    
    // Get diabetes medications (if patient has diabetes registry)
    let diabetesMedications: any[] = [];
    try {
      const [registry] = await connection.query(
        `SELECT id FROM diabetes_registry WHERE patient_id = $1`,
        [patientId]
      );
      
      if (registry) {
        let diabetesQuery = `
          SELECT 
            dm.id,
            dm.start_date as "prescribedDate",
            dm.created_at as "createdAt",
            dm.status,
            dm.medication_name as "medicationName",
            dm.dosage,
            dm.frequency,
            NULL as duration,
            NULL as quantity,
            dm.notes as instructions,
            u.id as prescriber_id,
            u.first_name as prescriber_first_name,
            u.last_name as prescriber_last_name
          FROM diabetes_medications dm
          LEFT JOIN users u ON dm.prescribed_by = u.id
          WHERE dm.diabetes_registry_id = $1
        `;
        
        const diabetesParams: any[] = [registry.id];
        
        if (filters?.activeOnly) {
          diabetesQuery += ` AND dm.status = $2`;
          diabetesParams.push('active');
        }
        
        diabetesQuery += ` ORDER BY dm.start_date DESC NULLS LAST, dm.created_at DESC`;
        
        diabetesMedications = await connection.query(diabetesQuery, diabetesParams);
        this.logger.debug(`Diabetes medications query returned ${diabetesMedications.length} results`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to fetch diabetes medications: ${error.message}`);
    }
    
    // Map regular prescriptions
    const mappedPrescriptions = rawPrescriptions.map((prescription: any) => ({
      id: prescription.id,
      prescribedDate: prescription.prescribedDate || prescription.prescribed_date || prescription.createdAt || prescription.created_at,
      status: prescription.status,
      medicationName: prescription.medicationName || prescription.medication_name,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      quantity: prescription.quantity,
      instructions: prescription.instructions,
      isDiabetesMedication: false, // Flag to identify diabetes medications
      prescriber: prescription.prescriber_id ? {
        id: prescription.prescriber_id,
        firstName: prescription.prescriber_first_name,
        lastName: prescription.prescriber_last_name,
      } : null,
    }));
    
    // Map diabetes medications and add flag
    const mappedDiabetesMeds = diabetesMedications.map((dm: any) => ({
      id: dm.id,
      prescribedDate: dm.prescribedDate || dm.start_date || dm.createdAt || dm.created_at,
      status: dm.status === 'discontinued' ? 'discontinued' : (dm.status || 'active'),
      medicationName: dm.medicationName || dm.medication_name,
      dosage: dm.dosage,
      frequency: dm.frequency,
      duration: dm.duration,
      quantity: dm.quantity,
      instructions: dm.instructions,
      isDiabetesMedication: true, // Flag to identify diabetes medications
      prescriber: dm.prescriber_id ? {
        id: dm.prescriber_id,
        firstName: dm.prescriber_first_name,
        lastName: dm.prescriber_last_name,
      } : null,
    }));
    
    // Merge and sort by date (most recent first)
    const allPrescriptions = [...mappedPrescriptions, ...mappedDiabetesMeds];
    allPrescriptions.sort((a, b) => {
      const dateA = new Date(a.prescribedDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.prescribedDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    
    this.logger.debug(`Returning ${allPrescriptions.length} total prescriptions (${mappedPrescriptions.length} regular + ${mappedDiabetesMeds.length} diabetes)`);
    return allPrescriptions;
  }

  // Bills
  async getPatientBills(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; status?: string }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    this.logger.debug(`getPatientBills: patientId=${patientId}, tenantId=${tenantId}, filters=${JSON.stringify(filters)}`);

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
    
    this.logger.debug(`Bills query: ${query}, params: ${JSON.stringify(params)}`);
    const rawBills = await connection.query(query, params);
    this.logger.debug(`Bills query returned ${rawBills.length} results`);

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
  // Chronic Disease Management - Diabetes
  async getPatientDiabetesRegistry(patientId: string, tenantId: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const [registry] = await connection.query(
      `SELECT 
        dr.*,
        u1.first_name || ' ' || u1.last_name as primary_care_provider_name,
        u2.first_name || ' ' || u2.last_name as endocrinologist_name,
        u3.first_name || ' ' || u3.last_name as diabetes_educator_name
      FROM diabetes_registry dr
      LEFT JOIN users u1 ON dr.primary_care_provider_id = u1.id
      LEFT JOIN users u2 ON dr.endocrinologist_id = u2.id
      LEFT JOIN users u3 ON dr.diabetes_educator_id = u3.id
      WHERE dr.patient_id = $1`,
      [patientId],
    );

    return registry || null;
  }

  async getPatientGlucoseHistory(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get glucose data from vitals table (primary source) and glucose_monitoring (secondary)
    // This ensures we show glucose data even if patient doesn't have a diabetes registry yet
    let query = `
      SELECT 
        id,
        blood_glucose as "glucoseValue",
        'mg/dL' as "glucoseUnit",
        'random' as "measurementType",
        recorded_at as "measurementTime",
        notes,
        created_at as "createdAt"
      FROM vitals
      WHERE patient_id = $1 AND blood_glucose IS NOT NULL AND blood_glucose > 0
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND recorded_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND recorded_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    
    // Also get from glucose_monitoring if registry exists
    const [registry] = await connection.query(
      `SELECT id FROM diabetes_registry WHERE patient_id = $1`,
      [patientId],
    );

    if (registry) {
      query += `
        UNION ALL
        SELECT 
          id,
          glucose_value as "glucoseValue",
          COALESCE(glucose_unit, 'mg/dL') as "glucoseUnit",
          COALESCE(reading_type, 'random') as "measurementType",
          recorded_at as "measurementTime",
          notes,
          created_at as "createdAt"
        FROM glucose_monitoring
        WHERE diabetes_registry_id = $${paramIndex}
      `;
      params.push(registry.id);
      paramIndex++;
      
      if (filters?.startDate) {
        query += ` AND recorded_at >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }
      if (filters?.endDate) {
        query += ` AND recorded_at <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }
    }
    
    query += ` ORDER BY "measurementTime" DESC`;
    
    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    } else {
      query += ` LIMIT 100`;
    }
    
    return await connection.query(query, params);
  }

  async getPatientDiabetesCarePlan(patientId: string, tenantId: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get registry first
    const [registry] = await connection.query(
      `SELECT id, care_plan as "carePlan" FROM diabetes_registry WHERE patient_id = $1`,
      [patientId],
    );

    if (!registry) {
      return null;
    }

    // Get latest care bundle
    const [careBundle] = await connection.query(
      `SELECT 
        id,
        bundle_date as "bundleDate",
        hba1c_checked as "hba1cChecked",
        hba1c_value as "hba1cValue",
        hba1c_date as "hba1cDate",
        blood_pressure_checked as "bloodPressureChecked",
        systolic_bp as "systolicBp",
        diastolic_bp as "diastolicBp",
        bp_date as "bpDate",
        lipid_profile_checked as "lipidProfileChecked",
        lipid_profile_date as "lipidProfileDate",
        foot_exam_checked as "footExamChecked",
        foot_exam_date as "footExamDate",
        foot_exam_result as "footExamResult",
        eye_exam_checked as "eyeExamChecked",
        eye_exam_date as "eyeExamDate",
        eye_exam_result as "eyeExamResult",
        urine_acr_checked as "urineAcrChecked",
        urine_acr_value as "urineAcrValue",
        urine_acr_date as "urineAcrDate",
        diabetes_education_documented as "diabetesEducationDocumented",
        education_date as "educationDate",
        medication_review_completed as "medicationReviewCompleted",
        medication_review_date as "medicationReviewDate",
        bundle_completion_percentage as "completionPercentage",
        created_at as "createdAt"
      FROM diabetes_care_bundle
      WHERE diabetes_registry_id = $1
      ORDER BY bundle_date DESC
      LIMIT 1`,
      [registry.id],
    );

    // Get active medications
    const medications = await connection.query(
      `SELECT 
        id,
        medication_name as "medicationName",
        medication_type as "medicationType",
        dosage,
        frequency,
        start_date as "startDate",
        end_date as "endDate",
        status,
        notes
      FROM diabetes_medications
      WHERE diabetes_registry_id = $1 AND status = 'active'
      ORDER BY start_date DESC`,
      [registry.id],
    );

    return {
      careBundle: careBundle || null,
      medications,
      registry: {
        id: registry.id,
        carePlan: registry.carePlan,
      },
    };
  }

  async getPatientDiabetesMedications(patientId: string, tenantId: string): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get registry first
    const [registry] = await connection.query(
      `SELECT id FROM diabetes_registry WHERE patient_id = $1`,
      [patientId],
    );

    if (!registry) {
      return [];
    }

    return await connection.query(
      `SELECT 
        id,
        medication_name as "medicationName",
        medication_type as "medicationType",
        dosage,
        frequency,
        start_date as "startDate",
        end_date as "endDate",
        status,
        notes,
        adherence_percentage as "adherencePercentage"
      FROM diabetes_medications
      WHERE diabetes_registry_id = $1
      ORDER BY start_date DESC`,
      [registry.id],
    );
  }

  // Chronic Disease Management - Cardiology/Hypertension
  async getPatientCardiologyEncounters(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let query = `
      SELECT 
        ce.id,
        ce.encounter_date as "encounterDate",
        ce.visit_reason as "chiefComplaint",
        ce.hemodynamics->>'systolic_bp' as "bloodPressureSystolic",
        ce.hemodynamics->>'diastolic_bp' as "bloodPressureDiastolic",
        ce.hemodynamics->>'heart_rate' as "heartRate",
        ce.risk_score as "riskScore",
        ce.care_status as "careStatus",
        ce.payment_status as "paymentStatus",
        ce.care_plan as "notes",
        u.first_name || ' ' || u.last_name as cardiologist_name,
        ce.created_at as "createdAt"
      FROM cardiology_encounters ce
      LEFT JOIN users u ON ce.cardiologist_id = u.id
      WHERE ce.patient_id = $1
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND ce.encounter_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND ce.encounter_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    
    query += ` ORDER BY ce.encounter_date DESC`;
    
    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    } else {
      query += ` LIMIT 50`;
    }
    
    return await connection.query(query, params);
  }

  async getPatientBloodPressureTrends(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Get BP data from vitals table (primary source) and cardiology encounters (secondary)
    // Parse blood_pressure string format "120/80" into systolic and diastolic
    let query = `
      SELECT 
        recorded_at as "date",
        CASE 
          WHEN blood_pressure ~ '^[0-9]+/[0-9]+$' THEN
            (regexp_split_to_array(blood_pressure, '/'))[1]::integer
          ELSE NULL
        END as "systolic",
        CASE 
          WHEN blood_pressure ~ '^[0-9]+/[0-9]+$' THEN
            (regexp_split_to_array(blood_pressure, '/'))[2]::integer
          ELSE NULL
        END as "diastolic",
        heart_rate as "heartRate"
      FROM vitals
      WHERE patient_id = $1 AND blood_pressure IS NOT NULL AND blood_pressure != ''
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND recorded_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND recorded_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    
    query += ` 
      UNION ALL
      SELECT 
        encounter_date as "date",
        (hemodynamics->>'systolic_bp')::integer as "systolic",
        (hemodynamics->>'diastolic_bp')::integer as "diastolic",
        (hemodynamics->>'heart_rate')::integer as "heartRate"
      FROM cardiology_encounters
      WHERE patient_id = $1 AND hemodynamics->>'systolic_bp' IS NOT NULL
    `;
    
    if (filters?.startDate) {
      query += ` AND encounter_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND encounter_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    
    query += ` ORDER BY "date" DESC`;
    
    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    } else {
      query += ` LIMIT 100`;
    }
    
    return await connection.query(query, params);
  }

  async getPatientDashboardSummary(patientId: string, tenantId: string): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    this.logger.debug(`Dashboard summary for patientId: ${patientId}, tenantId: ${tenantId}`);
    
    // Get counts for dashboard
    const appointmentsResult = await connection.query(
      `SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1`,
      [patientId]
    );
    this.logger.debug(`Appointments query result: ${JSON.stringify(appointmentsResult)}, patientId used: ${patientId}`);
    const appointmentsCount = appointmentsResult?.[0]?.count || '0';
    this.logger.debug(`Appointments count extracted: ${appointmentsCount}`);
    
    // Count regular prescriptions
    const prescriptionsResult = await connection.query(
      `SELECT COUNT(*) as count FROM prescriptions WHERE patient_id = $1 AND status = 'active'`,
      [patientId]
    );
    let prescriptionsCount = parseInt(prescriptionsResult[0]?.count || '0', 10);
    
    // Also count diabetes medications (if patient has diabetes registry)
    try {
      const [registry] = await connection.query(
        `SELECT id FROM diabetes_registry WHERE patient_id = $1`,
        [patientId]
      );
      
      if (registry) {
        const diabetesMedsResult = await connection.query(
          `SELECT COUNT(*) as count FROM diabetes_medications WHERE diabetes_registry_id = $1 AND status = 'active'`,
          [registry.id]
        );
        const diabetesMedsCount = parseInt(diabetesMedsResult[0]?.count || '0', 10);
        prescriptionsCount += diabetesMedsCount;
      }
    } catch (error: any) {
      this.logger.warn(`Failed to count diabetes medications for dashboard: ${error.message}`);
    }
    
    const recordsResult = await connection.query(
      `SELECT COUNT(*) as count FROM medical_records WHERE patient_id = $1`,
      [patientId]
    );
    const recordsCount = recordsResult[0]?.count || '0';
    
    const billsResult = await connection.query(
      `SELECT COUNT(*) as count FROM billing WHERE patient_id = $1 AND status != 'paid'`,
      [patientId]
    );
    const billsCount = billsResult[0]?.count || '0';
    
    const vitalsResult = await connection.query(
      `SELECT COUNT(*) as count FROM vitals WHERE patient_id = $1`,
      [patientId]
    );
    const vitalsCount = vitalsResult[0]?.count || '0';

    // Get upcoming appointment
    const upcomingAppointmentResult = await connection.query(
      `SELECT id, appointment_date, status, reason 
       FROM appointments 
       WHERE patient_id = $1 AND appointment_date >= NOW() AND status IN ('scheduled', 'confirmed')
       ORDER BY appointment_date ASC 
       LIMIT 1`,
      [patientId]
    );
    const upcomingAppointment = upcomingAppointmentResult[0] || null;

    // Get latest vitals
    const latestVitalsResult = await connection.query(
      `SELECT id, blood_pressure, heart_rate, temperature, oxygen_saturation, recorded_at
       FROM vitals 
       WHERE patient_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 1`,
      [patientId]
    );
    const latestVitals = latestVitalsResult[0] || null;

    return {
      summary: {
        appointments: parseInt(appointmentsCount || '0', 10),
        activePrescriptions: prescriptionsCount,
        medicalRecords: parseInt(recordsCount || '0', 10),
        pendingBills: parseInt(billsCount || '0', 10),
        vitalsRecords: parseInt(vitalsCount || '0', 10),
      },
      upcomingAppointment: upcomingAppointment ? {
        id: upcomingAppointment.id,
        appointmentDate: upcomingAppointment.appointment_date || upcomingAppointment.appointmentDate,
        status: upcomingAppointment.status,
        reason: upcomingAppointment.reason,
        doctorName: upcomingAppointment.doctor_name || null,
      } : null,
      latestVitals: latestVitals ? {
        id: latestVitals.id,
        bloodPressure: latestVitals.blood_pressure || latestVitals.bloodPressure,
        heartRate: latestVitals.heart_rate || latestVitals.heartRate,
        temperature: latestVitals.temperature,
        oxygenSaturation: latestVitals.oxygen_saturation || latestVitals.oxygenSaturation,
        recordedAt: latestVitals.recorded_at || latestVitals.recordedAt,
      } : null,
    };
  }

  // ============================================
  // MEDICATION MANAGEMENT - REFILL REQUESTS
  // ============================================

  async createRefillRequest(patientId: string, tenantId: string, prescriptionId: string, data: { requestedQuantity?: number; reason?: string; urgency?: string }): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Verify prescription belongs to patient
    const [prescription] = await connection.query(
      `SELECT id, patient_id, medication_name, refills FROM prescriptions WHERE id = $1 AND patient_id = $2`,
      [prescriptionId, patientId],
    );

    if (!prescription) {
      throw new NotFoundException('Prescription not found or does not belong to you');
    }

    // Check for existing pending request
    const [existingRequest] = await connection.query(
      `SELECT id FROM prescription_refill_requests WHERE prescription_id = $1 AND patient_id = $2 AND status = 'pending'`,
      [prescriptionId, patientId],
    );

    if (existingRequest) {
      throw new Error('You already have a pending refill request for this prescription');
    }

    // Create refill request
    const result = await connection.query(
      `INSERT INTO prescription_refill_requests (
        prescription_id, patient_id, requested_quantity, reason, urgency
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        prescription_id as "prescriptionId",
        patient_id as "patientId",
        request_date as "requestDate",
        status,
        requested_quantity as "requestedQuantity",
        reason,
        urgency,
        reviewed_by as "reviewedBy",
        reviewed_at as "reviewedAt",
        review_notes as "reviewNotes",
        approved_quantity as "approvedQuantity",
        created_at as "createdAt"
      `,
      [
        prescriptionId,
        patientId,
        data.requestedQuantity || null,
        data.reason || null,
        data.urgency || 'normal',
      ],
    );

    return result[0];
  }

  async getRefillRequests(patientId: string, tenantId: string, filters?: { status?: string }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let query = `
      SELECT 
        r.id,
        r.prescription_id as "prescriptionId",
        r.patient_id as "patientId",
        r.request_date as "requestDate",
        r.status,
        r.requested_quantity as "requestedQuantity",
        r.reason,
        r.urgency,
        r.reviewed_by as "reviewedBy",
        r.reviewed_at as "reviewedAt",
        r.review_notes as "reviewNotes",
        r.approved_quantity as "approvedQuantity",
        p.medication_name as "medicationName",
        p.dosage,
        p.frequency,
        r.created_at as "createdAt"
      FROM prescription_refill_requests r
      JOIN prescriptions p ON r.prescription_id = p.id
      WHERE r.patient_id = $1
    `;

    const params: any[] = [patientId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY r.request_date DESC`;

    return await connection.query(query, params);
  }

  async cancelRefillRequest(patientId: string, tenantId: string, requestId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Verify request belongs to patient and is pending
    const [request] = await connection.query(
      `SELECT id, status FROM prescription_refill_requests WHERE id = $1 AND patient_id = $2`,
      [requestId, patientId],
    );

    if (!request) {
      throw new NotFoundException('Refill request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Only pending requests can be cancelled');
    }

    await connection.query(
      `UPDATE prescription_refill_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [requestId],
    );
  }

  // ============================================
  // MEDICATION MANAGEMENT - REMINDERS
  // ============================================

  async createMedicationReminder(patientId: string, tenantId: string, prescriptionId: string, data: { reminderTime: string; reminderDays: number[]; reminderType?: string; timezone?: string }): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Verify prescription belongs to patient
    const [prescription] = await connection.query(
      `SELECT id, patient_id, medication_name FROM prescriptions WHERE id = $1 AND patient_id = $2`,
      [prescriptionId, patientId],
    );

    if (!prescription) {
      throw new NotFoundException('Prescription not found or does not belong to you');
    }

    // Calculate next send time
    const nextSendAt = this.calculateNextReminderTime(data.reminderTime, data.reminderDays, data.timezone);

    const result = await connection.query(
      `INSERT INTO medication_reminders (
        prescription_id, patient_id, medication_name, reminder_time, reminder_days, reminder_type, timezone, next_send_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        prescription_id as "prescriptionId",
        patient_id as "patientId",
        medication_name as "medicationName",
        reminder_time as "reminderTime",
        reminder_days as "reminderDays",
        reminder_type as "reminderType",
        is_active as "isActive",
        timezone,
        last_sent_at as "lastSentAt",
        next_send_at as "nextSendAt",
        sent_count as "sentCount",
        acknowledged_count as "acknowledgedCount",
        created_at as "createdAt"
      `,
      [
        prescriptionId,
        patientId,
        prescription.medication_name,
        data.reminderTime,
        data.reminderDays,
        data.reminderType || 'notification',
        data.timezone || 'Africa/Harare',
        nextSendAt,
      ],
    );

    return result[0];
  }

  async getMedicationReminders(patientId: string, tenantId: string, filters?: { activeOnly?: boolean }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let query = `
      SELECT 
        m.id,
        m.prescription_id as "prescriptionId",
        m.patient_id as "patientId",
        m.medication_name as "medicationName",
        m.reminder_time as "reminderTime",
        m.reminder_days as "reminderDays",
        m.reminder_type as "reminderType",
        m.is_active as "isActive",
        m.timezone,
        m.last_sent_at as "lastSentAt",
        m.next_send_at as "nextSendAt",
        m.sent_count as "sentCount",
        m.acknowledged_count as "acknowledgedCount",
        p.dosage,
        p.frequency,
        m.created_at as "createdAt"
      FROM medication_reminders m
      JOIN prescriptions p ON m.prescription_id = p.id
      WHERE m.patient_id = $1
    `;

    const params: any[] = [patientId];
    let paramIndex = 2;

    if (filters?.activeOnly) {
      query += ` AND m.is_active = $${paramIndex}`;
      params.push(true);
      paramIndex++;
    }

    query += ` ORDER BY m.created_at DESC`;

    return await connection.query(query, params);
  }

  async updateMedicationReminder(patientId: string, tenantId: string, reminderId: string, data: { reminderTime?: string; reminderDays?: number[]; reminderType?: string; isActive?: boolean }): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Verify reminder belongs to patient
    const [reminder] = await connection.query(
      `SELECT id, patient_id FROM medication_reminders WHERE id = $1 AND patient_id = $2`,
      [reminderId, patientId],
    );

    if (!reminder) {
      throw new NotFoundException('Medication reminder not found');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.reminderTime !== undefined) {
      updates.push(`reminder_time = $${paramIndex}`);
      params.push(data.reminderTime);
      paramIndex++;
    }
    if (data.reminderDays !== undefined) {
      updates.push(`reminder_days = $${paramIndex}`);
      params.push(data.reminderDays);
      paramIndex++;
    }
    if (data.reminderType !== undefined) {
      updates.push(`reminder_type = $${paramIndex}`);
      params.push(data.reminderType);
      paramIndex++;
    }
    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(data.isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    // Recalculate next_send_at if reminder time or days changed
    if (data.reminderTime || data.reminderDays) {
      const [currentReminder] = await connection.query(
        `SELECT reminder_time, reminder_days, timezone FROM medication_reminders WHERE id = $1`,
        [reminderId],
      );
      const nextSendAt = this.calculateNextReminderTime(
        data.reminderTime || currentReminder.reminder_time,
        data.reminderDays || currentReminder.reminder_days,
        currentReminder.timezone,
      );
      updates.push(`next_send_at = $${paramIndex}`);
      params.push(nextSendAt);
      paramIndex++;
    }

    updates.push(`updated_at = NOW()`);
    params.push(reminderId);

    const query = `UPDATE medication_reminders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await connection.query(query, params);
    return result[0];
  }

  async deleteMedicationReminder(patientId: string, tenantId: string, reminderId: string): Promise<void> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Verify reminder belongs to patient
    const [reminder] = await connection.query(
      `SELECT id FROM medication_reminders WHERE id = $1 AND patient_id = $2`,
      [reminderId, patientId],
    );

    if (!reminder) {
      throw new NotFoundException('Medication reminder not found');
    }

    await connection.query(`DELETE FROM medication_reminders WHERE id = $1`, [reminderId]);
  }

  // ============================================
  // MEDICATION MANAGEMENT - ADHERENCE TRACKING
  // ============================================

  async logMedicationAdherence(patientId: string, tenantId: string, prescriptionId: string, data: { scheduledTime: string; taken: boolean; takenTime?: string; missedReason?: string; notes?: string }): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    // Verify prescription belongs to patient
    const [prescription] = await connection.query(
      `SELECT id, patient_id, medication_name FROM prescriptions WHERE id = $1 AND patient_id = $2`,
      [prescriptionId, patientId],
    );

    if (!prescription) {
      throw new NotFoundException('Prescription not found or does not belong to you');
    }

    const result = await connection.query(
      `INSERT INTO patient_medication_adherence_logs (
        prescription_id, patient_id, medication_name, scheduled_time, taken_time, taken, missed_reason, notes, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'patient_portal')
      RETURNING 
        id,
        prescription_id as "prescriptionId",
        patient_id as "patientId",
        medication_name as "medicationName",
        scheduled_time as "scheduledTime",
        taken_time as "takenTime",
        taken,
        missed_reason as "missedReason",
        notes,
        reminder_sent as "reminderSent",
        reminder_sent_at as "reminderSentAt",
        source,
        created_at as "createdAt"
      `,
      [
        prescriptionId,
        patientId,
        prescription.medication_name,
        data.scheduledTime,
        data.taken ? (data.takenTime || new Date().toISOString()) : null,
        data.taken,
        data.missedReason || null,
        data.notes || null,
      ],
    );

    return result[0];
  }

  async getMedicationAdherenceSummary(patientId: string, tenantId: string, prescriptionId?: string, filters?: { startDate?: string; endDate?: string }): Promise<any> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let query = `
      SELECT 
        prescription_id as "prescriptionId",
        COUNT(*) as "totalDoses",
        SUM(CASE WHEN taken = true THEN 1 ELSE 0 END) as "takenDoses",
        SUM(CASE WHEN taken = false THEN 1 ELSE 0 END) as "missedDoses",
        ROUND(
          (SUM(CASE WHEN taken = true THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
          2
        ) as "adherencePercentage"
      FROM patient_medication_adherence_logs
      WHERE patient_id = $1
    `;

    const params: any[] = [patientId];
    let paramIndex = 2;

    if (prescriptionId) {
      query += ` AND prescription_id = $${paramIndex}`;
      params.push(prescriptionId);
      paramIndex++;
    }

    if (filters?.startDate) {
      query += ` AND scheduled_time >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND scheduled_time <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` GROUP BY prescription_id`;

    return await connection.query(query, params);
  }

  async getMedicationAdherenceLogs(patientId: string, tenantId: string, prescriptionId?: string, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    let query = `
      SELECT 
        id,
        prescription_id as "prescriptionId",
        patient_id as "patientId",
        medication_name as "medicationName",
        scheduled_time as "scheduledTime",
        taken_time as "takenTime",
        taken,
        missed_reason as "missedReason",
        notes,
        reminder_sent as "reminderSent",
        reminder_sent_at as "reminderSentAt",
        source,
        created_at as "createdAt"
      FROM patient_medication_adherence_logs
      WHERE patient_id = $1
    `;

    const params: any[] = [patientId];
    let paramIndex = 2;

    if (prescriptionId) {
      query += ` AND prescription_id = $${paramIndex}`;
      params.push(prescriptionId);
      paramIndex++;
    }

    if (filters?.startDate) {
      query += ` AND scheduled_time >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters?.endDate) {
      query += ` AND scheduled_time <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY scheduled_time DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    } else {
      query += ` LIMIT 100`;
    }

    return await connection.query(query, params);
  }

  // Helper method to calculate next reminder time
  private calculateNextReminderTime(reminderTime: string, reminderDays: number[], timezone: string = 'Africa/Harare'): Date {
    const now = new Date();
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Find next day in reminderDays array
    let daysUntilNext = 0;
    for (let i = 0; i < 7; i++) {
      const checkDay = (currentDay + i) % 7;
      if (reminderDays.includes(checkDay)) {
        if (i === 0) {
          // Today is in the list, check if time has passed
          const reminderToday = new Date(now);
          reminderToday.setHours(hours, minutes, 0, 0);
          if (reminderToday > now) {
            return reminderToday; // Reminder is later today
          }
        } else {
          daysUntilNext = i;
          break;
        }
      }
    }

    // If no day found in next 7 days, use first day in list
    if (daysUntilNext === 0 && reminderDays.length > 0) {
      daysUntilNext = (reminderDays[0] - currentDay + 7) % 7 || 7;
    }

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntilNext);
    nextDate.setHours(hours, minutes, 0, 0);

    return nextDate;
  }
}
