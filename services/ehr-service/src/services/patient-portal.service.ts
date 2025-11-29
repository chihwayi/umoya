import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Prescription } from '../entities/prescription.entity';
import { Bill } from '../entities/billing.entity';
import { Patient } from '../entities/patient.entity';

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

    const appointmentRepository = connection.getRepository(AppointmentSimple);
    const queryBuilder = appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .where('appointment.patientId = :patientId', { patientId });

    if (filters?.startDate) {
      queryBuilder.andWhere('appointment.appointmentDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      queryBuilder.andWhere('appointment.appointmentDate <= :endDate', { endDate: filters.endDate });
    }
    if (filters?.status) {
      queryBuilder.andWhere('appointment.status = :status', { status: filters.status });
    }

    const appointments = await queryBuilder.orderBy('appointment.appointmentDate', 'DESC').getMany();

    return appointments.map((apt) => ({
      id: apt.id,
      appointmentDate: apt.appointmentDate,
      durationMinutes: apt.durationMinutes,
      status: apt.status,
      reason: apt.reason,
      notes: apt.notes,
      doctor: apt.doctor ? {
        id: apt.doctor.id,
        firstName: apt.doctor.firstName,
        lastName: apt.doctor.lastName,
        specialization: apt.doctor.specialization,
      } : null,
      patient: {
        id: apt.patient?.id,
        firstName: apt.patient?.firstName,
        lastName: apt.patient?.lastName,
      },
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
    let query = `
      SELECT 
        mr.id,
        mr.record_date as "recordDate",
        mr.type,
        mr.chief_complaint as "chiefComplaint",
        mr.assessment,
        mr.plan,
        mr.diagnoses,
        u.id as provider_id,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        u.specialization as provider_specialization
      FROM medical_records mr
      LEFT JOIN users u ON mr.provider_id = u.id
      WHERE mr.patient_id = $1
    `;
    
    const params: any[] = [patientId];
    let paramIndex = 2;
    
    if (filters?.startDate) {
      query += ` AND mr.record_date >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      query += ` AND mr.record_date <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }
    if (filters?.type) {
      query += ` AND mr.type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }
    
    query += ` ORDER BY mr.record_date DESC`;
    
    const rawRecords = await connection.query(query, params);

    return rawRecords.map((record: any) => ({
      id: record.id,
      recordDate: record.recordDate || record.record_date,
      type: record.type,
      chiefComplaint: record.chiefComplaint || record.chief_complaint,
      assessment: record.assessment,
      plan: record.plan,
      diagnoses: record.diagnoses || [],
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
}
