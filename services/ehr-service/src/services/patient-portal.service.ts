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

    const recordRepository = connection.getRepository(MedicalRecord);
    const queryBuilder = recordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.patient', 'patient')
      .leftJoinAndSelect('record.provider', 'provider')
      .where('record.patientId = :patientId', { patientId });

    if (filters?.startDate) {
      queryBuilder.andWhere('record.recordDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      queryBuilder.andWhere('record.recordDate <= :endDate', { endDate: filters.endDate });
    }
    if (filters?.type) {
      queryBuilder.andWhere('record.type = :type', { type: filters.type });
    }

    const records = await queryBuilder.orderBy('record.recordDate', 'DESC').getMany();

    return records.map((record) => ({
      id: record.id,
      recordDate: record.recordDate,
      type: record.type,
      chiefComplaint: record.chiefComplaint,
      assessment: record.assessment,
      plan: record.plan,
      diagnoses: record.diagnoses || [],
      provider: record.provider ? {
        id: record.provider.id,
        firstName: record.provider.firstName,
        lastName: record.provider.lastName,
        specialization: record.provider.specialization,
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

    const prescriptionRepository = connection.getRepository(Prescription);
    const queryBuilder = prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.patient', 'patient')
      .leftJoinAndSelect('prescription.prescriber', 'prescriber')
      .where('prescription.patientId = :patientId', { patientId });

    if (filters?.activeOnly) {
      queryBuilder.andWhere('prescription.status = :status', { status: 'active' });
    }

    const prescriptions = await queryBuilder.orderBy('prescription.createdAt', 'DESC').getMany();

    return prescriptions.map((prescription) => ({
      id: prescription.id,
      prescribedDate: prescription.createdAt,
      status: prescription.status,
      medicationName: prescription.medicationName,
      genericName: prescription.genericName,
      strength: prescription.strength,
      form: prescription.form,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      route: prescription.route,
      quantity: prescription.quantity,
      refills: prescription.refills,
      startDate: prescription.startDate,
      endDate: prescription.endDate,
      instructions: prescription.instructions,
      indication: prescription.indication,
      prescriber: prescription.prescriber ? {
        id: prescription.prescriber.id,
        firstName: prescription.prescriber.firstName,
        lastName: prescription.prescriber.lastName,
      } : null,
    }));
  }

  // Bills
  async getPatientBills(patientId: string, tenantId: string, filters?: { startDate?: string; endDate?: string; status?: string }): Promise<any[]> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }

    const billRepository = connection.getRepository(Bill);
    const queryBuilder = billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.patient', 'patient')
      .where('bill.patientId = :patientId', { patientId });

    if (filters?.startDate) {
      queryBuilder.andWhere('bill.billDate >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      queryBuilder.andWhere('bill.billDate <= :endDate', { endDate: filters.endDate });
    }
    if (filters?.status) {
      queryBuilder.andWhere('bill.paymentStatus = :status', { status: filters.status });
    }

    const bills = await queryBuilder.orderBy('bill.billDate', 'DESC').getMany();

    return bills.map((bill) => ({
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      totalAmount: bill.totalAmount,
      status: bill.status,
      paymentStatus: bill.paymentStatus,
      items: bill.items || [],
      dueDate: bill.dueDate,
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
      paymentStatus: bill.paymentStatus,
      items: bill.items || [],
      dueDate: bill.dueDate,
      notes: bill.notes,
    };
  }
}
