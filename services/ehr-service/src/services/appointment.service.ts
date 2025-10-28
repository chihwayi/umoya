import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, Between, Not } from 'typeorm';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { CreateAppointmentDto, UpdateAppointmentDto, AppointmentQueryDto } from '../dto/appointment.dto';
import { TenantSimpleService } from './tenant-simple.service';

@Injectable()
export class AppointmentService {
  constructor(
    private tenantService: TenantSimpleService,
  ) {}

  private async getAppointmentRepository(tenantId: string): Promise<Repository<AppointmentSimple>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(AppointmentSimple);
  }

  async create(createAppointmentDto: CreateAppointmentDto, userId: string, tenantId: string): Promise<AppointmentSimple> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    // Check for conflicts
    await this.checkForConflicts(
      createAppointmentDto.doctorId,
      createAppointmentDto.appointmentDate,
      createAppointmentDto.durationMinutes || 30,
      tenantId
    );

    const appointment = appointmentRepository.create({
      ...createAppointmentDto,
      appointmentType: createAppointmentDto.appointmentType || 'consultation',
      durationMinutes: createAppointmentDto.durationMinutes || 30,
      createdBy: userId,
    });

    return appointmentRepository.save(appointment);
  }

  async findAll(query: AppointmentQueryDto, tenantId: string): Promise<{ appointments: any[]; total: number }> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    // Build query
    const queryBuilder = appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('appointment.createdByUser', 'createdByUser');

    // Apply filters
    if (query.date) {
      const startDate = new Date(query.date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      queryBuilder.andWhere('appointment.appointmentDate >= :startDate', { startDate })
                  .andWhere('appointment.appointmentDate < :endDate', { endDate });
    }

    if (query.status && query.status !== 'all') {
      queryBuilder.andWhere('appointment.status = :status', { status: query.status });
    }

    if (query.doctorId) {
      queryBuilder.andWhere('appointment.doctorId = :doctorId', { doctorId: query.doctorId });
    }

    // Note: patientId filter not available in AppointmentQueryDto

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    // Apply sorting
    queryBuilder.orderBy('appointment.appointmentDate', 'ASC');

    // Get appointments and total count
    const [appointments, total] = await queryBuilder.getManyAndCount();

    return {
      appointments: appointments.map(apt => ({
        id: apt.id,
        patient: {
          id: apt.patient?.id,
          firstName: apt.patient?.firstName,
          lastName: apt.patient?.lastName,
          patientNumber: apt.patient?.patientNumber
        },
        doctor: {
          id: apt.doctor?.id,
          firstName: apt.doctor?.firstName,
          lastName: apt.doctor?.lastName
        },
        appointmentDate: apt.appointmentDate,
        appointmentType: apt.appointmentType,
        status: apt.status,
        reason: apt.reason,
        durationMinutes: apt.durationMinutes,
        notes: apt.notes,
        createdBy: apt.createdBy,
        createdAt: apt.createdAt,
        updatedAt: apt.updatedAt
      })),
      total
    };
  }

  async findOne(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    const appointment = await appointmentRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);

    // Check for conflicts if date is being changed
    if (updateAppointmentDto.appointmentDate) {
      const doctorId = updateAppointmentDto.doctorId || appointment.doctorId;
      const duration = updateAppointmentDto.durationMinutes || appointment.durationMinutes;

      await this.checkForConflicts(doctorId, updateAppointmentDto.appointmentDate, duration, tenantId, id);
    }

    Object.assign(appointment, updateAppointmentDto);
    return appointmentRepository.save(appointment);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    appointment.status = 'cancelled';
    await appointmentRepository.save(appointment);
  }

  async updateStatus(id: string, status: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    appointment.status = status;
    return appointmentRepository.save(appointment);
  }

  async checkInPatient(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    appointment.status = 'confirmed';
    return appointmentRepository.save(appointment);
  }

  async startAppointment(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    appointment.status = 'in_progress';
    return appointmentRepository.save(appointment);
  }

  async completeAppointment(id: string, tenantId: string): Promise<AppointmentSimple> {
    const appointment = await this.findOne(id, tenantId);
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    
    appointment.status = 'completed';
    return appointmentRepository.save(appointment);
  }

  async getWaitTimes(doctorId: string, date: string, tenantId: string): Promise<{ average: number; current: number[] }> {
    const appointments = await this.getDoctorSchedule(doctorId, date, tenantId);
    
    // Simplified wait times calculation since we don't have wait time tracking
    const average = 0;
    const current: number[] = [];
    
    return { average, current };
  }

  async createRecurringAppointments(baseAppointment: CreateAppointmentDto, pattern: string, endDate: Date, tenantId: string): Promise<AppointmentSimple[]> {
    const appointments = [];
    const startDate = new Date(baseAppointment.appointmentDate);
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const appointment = await this.create({
        ...baseAppointment,
        appointmentDate: currentDate.toISOString(),
        recurringPattern: pattern,
      }, baseAppointment.patientId, tenantId);
      
      appointments.push(appointment);
      
      // Increment based on pattern
      if (pattern === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (pattern === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
    
    return appointments;
  }

  async getDoctorSchedule(doctorId: string, date: string, tenantId: string): Promise<AppointmentSimple[]> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    return appointmentRepository.find({
      where: {
        doctorId,
        appointmentDate: Between(startDate, endDate),
        status: Not('cancelled'),
      },
      relations: ['patient'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async getAvailableSlots(doctorId: string, date: string, tenantId: string): Promise<string[]> {
    const existingAppointments = await this.getDoctorSchedule(doctorId, date, tenantId);
    const workingHours = this.getWorkingHours();
    const allSlots = this.generateTimeSlots(workingHours.start, workingHours.end, 30);

    // Remove booked slots
    const bookedSlots = existingAppointments.map(apt => {
      const time = new Date(apt.appointmentDate);
      return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    });
    return allSlots.filter(slot => !bookedSlots.includes(slot));
  }

  private async checkForConflicts(
    doctorId: string,
    appointmentDate: string,
    duration: number,
    tenantId: string,
    excludeId?: string
  ): Promise<void> {
    const appointmentRepository = await this.getAppointmentRepository(tenantId);
    const startDate = new Date(appointmentDate);
    const endDate = new Date(appointmentDate);
    endDate.setDate(endDate.getDate() + 1);

    const queryBuilder = appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.appointmentDate >= :startDate', { startDate })
      .andWhere('appointment.appointmentDate < :endDate', { endDate })
      .andWhere('appointment.status != :cancelledStatus', { cancelledStatus: 'cancelled' });

    if (excludeId) {
      queryBuilder.andWhere('appointment.id != :excludeId', { excludeId });
    }

    const existingAppointments = await queryBuilder.getMany();

    const newAppointmentTime = new Date(appointmentDate);
    for (const existing of existingAppointments) {
      if (this.hasTimeConflict(newAppointmentTime, duration, existing.appointmentDate, existing.durationMinutes)) {
        throw new ConflictException('Doctor is not available at this time');
      }
    }
  }

  private hasTimeConflict(newTime: Date, newDuration: number, existingTime: Date, existingDuration: number): boolean {
    const newStart = newTime.getTime();
    const newEnd = newStart + (newDuration * 60000); // Convert minutes to milliseconds
    const existingStart = existingTime.getTime();
    const existingEnd = existingStart + (existingDuration * 60000);

    return (newStart < existingEnd && newEnd > existingStart);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }



  private getWorkingHours() {
    return { start: '08:00', end: '17:00' };
  }

  private generateTimeSlots(start: string, end: string, intervalMinutes: number): string[] {
    const slots = [];
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    }

    return slots;
  }
}