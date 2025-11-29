import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository, LessThanOrEqual } from 'typeorm';
import { AppointmentWaitlist } from '../entities/appointment-waitlist.entity';
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from '../dto/appointment.dto';

export interface CreateWaitlistEntryDto {
  patientId: string;
  doctorId?: string;
  appointmentType?: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  reason?: string;
  notes?: string;
}

export interface UpdateWaitlistEntryDto {
  doctorId?: string;
  appointmentType?: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  reason?: string;
  notes?: string;
  status?: 'pending' | 'notified' | 'scheduled' | 'cancelled' | 'expired';
}

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(private appointmentService: AppointmentService) {}

  private waitlistRepository(tenantDb: DataSource): Repository<AppointmentWaitlist> {
    return tenantDb.getRepository(AppointmentWaitlist);
  }

  async getWaitlistEntries(
    tenantDb: DataSource,
    filters?: {
      status?: string;
      priority?: string;
      doctorId?: string;
      patientId?: string;
    },
  ): Promise<AppointmentWaitlist[]> {
    const repository = this.waitlistRepository(tenantDb);
    const query = repository.createQueryBuilder('waitlist').leftJoinAndSelect('waitlist.patient', 'patient').leftJoinAndSelect('waitlist.doctor', 'doctor').orderBy('waitlist.priority', 'DESC').addOrderBy('waitlist.createdAt', 'ASC');

    if (filters?.status) {
      query.andWhere('waitlist.status = :status', { status: filters.status });
    }

    if (filters?.priority) {
      query.andWhere('waitlist.priority = :priority', { priority: filters.priority });
    }

    if (filters?.doctorId) {
      query.andWhere('waitlist.doctorId = :doctorId', { doctorId: filters.doctorId });
    }

    if (filters?.patientId) {
      query.andWhere('waitlist.patientId = :patientId', { patientId: filters.patientId });
    }

    return query.getMany();
  }

  async getWaitlistEntry(tenantDb: DataSource, id: string): Promise<AppointmentWaitlist> {
    const repository = this.waitlistRepository(tenantDb);
    const entry = await repository.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'scheduledAppointment'],
    });

    if (!entry) {
      throw new NotFoundException(`Waitlist entry with ID ${id} not found`);
    }

    return entry;
  }

  async createWaitlistEntry(
    tenantDb: DataSource,
    dto: CreateWaitlistEntryDto,
    createdBy: string,
  ): Promise<AppointmentWaitlist> {
    const repository = this.waitlistRepository(tenantDb);

    const entry = repository.create({
      ...dto,
      preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
      priority: dto.priority || 'normal',
      status: 'pending',
      createdBy,
    });

    return repository.save(entry);
  }

  async updateWaitlistEntry(
    tenantDb: DataSource,
    id: string,
    dto: UpdateWaitlistEntryDto,
  ): Promise<AppointmentWaitlist> {
    const entry = await this.getWaitlistEntry(tenantDb, id);
    const repository = this.waitlistRepository(tenantDb);

    Object.assign(entry, {
      ...dto,
      preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : entry.preferredDate,
    });

    return repository.save(entry);
  }

  async deleteWaitlistEntry(tenantDb: DataSource, id: string): Promise<void> {
    const entry = await this.getWaitlistEntry(tenantDb, id);
    const repository = this.waitlistRepository(tenantDb);
    await repository.remove(entry);
  }

  async scheduleFromWaitlist(
    tenantDb: DataSource,
    waitlistId: string,
    appointmentDate: string,
    userId: string,
    tenantId: string,
  ): Promise<{ waitlistEntry: AppointmentWaitlist; appointment: any }> {
    const waitlistEntry = await this.getWaitlistEntry(tenantDb, waitlistId);

    if (waitlistEntry.status === 'scheduled') {
      throw new BadRequestException('This waitlist entry has already been scheduled');
    }

    if (waitlistEntry.status === 'cancelled' || waitlistEntry.status === 'expired') {
      throw new BadRequestException(`Cannot schedule from ${waitlistEntry.status} waitlist entry`);
    }

    // Create appointment from waitlist entry
    const appointmentDto: CreateAppointmentDto = {
      patientId: waitlistEntry.patientId,
      doctorId: waitlistEntry.doctorId,
      appointmentDate,
      appointmentType: waitlistEntry.appointmentType || 'consultation',
      reason: waitlistEntry.reason,
      notes: waitlistEntry.notes,
      durationMinutes: 30, // Default
    };

    const appointment = await this.appointmentService.create(appointmentDto, userId, tenantId);

    // Update waitlist entry
    const repository = this.waitlistRepository(tenantDb);
    waitlistEntry.status = 'scheduled';
    waitlistEntry.scheduledAppointmentId = appointment.id;
    waitlistEntry.notifiedAt = new Date();
    await repository.save(waitlistEntry);

    return { waitlistEntry, appointment };
  }

  async notifyWaitlistEntry(tenantDb: DataSource, id: string): Promise<AppointmentWaitlist> {
    const entry = await this.getWaitlistEntry(tenantDb, id);
    const repository = this.waitlistRepository(tenantDb);

    entry.status = 'notified';
    entry.notifiedAt = new Date();

    return repository.save(entry);
  }

  async checkAvailableSlotsAndNotify(
    tenantDb: DataSource,
    doctorId: string,
    date: string,
    tenantId: string,
  ): Promise<{ notified: number; entries: AppointmentWaitlist[] }> {
    // Get available slots for the doctor on this date
    const availableSlots = await this.appointmentService.getAvailableSlots(doctorId, date, tenantId);

    if (availableSlots.length === 0) {
      return { notified: 0, entries: [] };
    }

    // Find pending waitlist entries for this doctor
    const repository = this.waitlistRepository(tenantDb);
    const waitlistEntries = await repository.find({
      where: {
        doctorId,
        status: 'pending',
        preferredDate: LessThanOrEqual(new Date(date)),
      },
      relations: ['patient'],
      order: { priority: 'DESC', createdAt: 'ASC' },
      take: availableSlots.length, // Only notify for available slots
    });

    // Notify entries
    const notifiedEntries: AppointmentWaitlist[] = [];
    for (const entry of waitlistEntries) {
      entry.status = 'notified';
      entry.notifiedAt = new Date();
      await repository.save(entry);
      notifiedEntries.push(entry);
    }

    return { notified: notifiedEntries.length, entries: notifiedEntries };
  }

  async expireOldEntries(tenantDb: DataSource, daysOld: number = 30): Promise<number> {
    const repository = this.waitlistRepository(tenantDb);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await repository
      .createQueryBuilder()
      .update(AppointmentWaitlist)
      .set({ status: 'expired' })
      .where('status = :status', { status: 'pending' })
      .andWhere('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}

