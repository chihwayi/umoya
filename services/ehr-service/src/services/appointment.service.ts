import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';

@Injectable()
export class AppointmentService {
  
  async create(createAppointmentDto: any, tenantDb: DataSource, createdById: string): Promise<Appointment> {
    const appointmentRepository = tenantDb.getRepository(Appointment);
    
    const appointmentCount = await appointmentRepository.count();
    const appointmentNumber = `A${String(appointmentCount + 1).padStart(6, '0')}`;
    
    const appointment = appointmentRepository.create({
      ...createAppointmentDto,
      appointmentNumber,
      createdById,
      scheduledDateTime: new Date(createAppointmentDto.scheduledDateTime)
    });
    
    return appointmentRepository.save(appointment);
  }

  async findAll(query: any, tenantDb: DataSource): Promise<any> {
    const appointmentRepository = tenantDb.getRepository(Appointment);
    const { page = 1, limit = 10, status, doctorId, patientId, date } = query;
    
    let queryBuilder = appointmentRepository.createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor');
    
    if (status) {
      queryBuilder.andWhere('appointment.status = :status', { status });
    }
    
    if (doctorId) {
      queryBuilder.andWhere('appointment.doctorId = :doctorId', { doctorId });
    }
    
    if (patientId) {
      queryBuilder.andWhere('appointment.patientId = :patientId', { patientId });
    }
    
    if (date) {
      queryBuilder.andWhere('DATE(appointment.scheduledDateTime) = :date', { date });
    }
    
    const [appointments, total]: [any[], number] = await queryBuilder
      .orderBy('appointment.scheduledDateTime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    
    return {
      appointments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(id: string, tenantDb: DataSource): Promise<Appointment> {
    const appointmentRepository = tenantDb.getRepository(Appointment);
    
    const appointment = await appointmentRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'createdBy']
    });
    
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    
    return appointment;
  }

  async updateStatus(id: string, status: string, tenantDb: DataSource): Promise<Appointment> {
    const appointmentRepository = tenantDb.getRepository(Appointment);
    
    const appointment = await this.findById(id, tenantDb);
    appointment.status = status as AppointmentStatus;
    
    if (status === AppointmentStatus.IN_PROGRESS) {
      appointment.startedAt = new Date();
    } else if (status === AppointmentStatus.COMPLETED) {
      appointment.completedAt = new Date();
    }
    
    return appointmentRepository.save(appointment);
  }
}