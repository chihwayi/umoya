import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource, Repository, Between } from 'typeorm';
import { AppointmentResource, AppointmentResourceBooking } from '../entities/appointment-resource.entity';
import { TenantService } from './tenant.service';

export interface CreateResourceDto {
  name: string;
  type: 'room' | 'equipment';
  description?: string;
  capacity?: number;
  location?: string;
}

export interface UpdateResourceDto {
  name?: string;
  description?: string;
  capacity?: number;
  location?: string;
  isActive?: boolean;
}

export interface BookResourceDto {
  appointmentId: string;
  resourceId: string;
  bookingStart: string;
  bookingEnd: string;
  notes?: string;
}

@Injectable()
export class AppointmentResourceService {
  private readonly logger = new Logger(AppointmentResourceService.name);

  constructor(private tenantService: TenantService) {}

  private async getResourceRepository(tenantId: string): Promise<Repository<AppointmentResource>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(AppointmentResource);
  }

  private async getBookingRepository(tenantId: string): Promise<Repository<AppointmentResourceBooking>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(AppointmentResourceBooking);
  }

  async createResource(dto: CreateResourceDto, tenantId: string): Promise<AppointmentResource> {
    const repository = await this.getResourceRepository(tenantId);
    const resource = repository.create(dto);
    return repository.save(resource);
  }

  async findAllResources(tenantId: string, type?: 'room' | 'equipment'): Promise<AppointmentResource[]> {
    const repository = await this.getResourceRepository(tenantId);
    const query = repository.createQueryBuilder('resource').where('resource.isActive = :isActive', { isActive: true });

    if (type) {
      query.andWhere('resource.type = :type', { type });
    }

    return query.orderBy('resource.name', 'ASC').getMany();
  }

  async findOneResource(id: string, tenantId: string): Promise<AppointmentResource> {
    const repository = await this.getResourceRepository(tenantId);
    const resource = await repository.findOne({ where: { id } });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    return resource;
  }

  async updateResource(id: string, dto: UpdateResourceDto, tenantId: string): Promise<AppointmentResource> {
    const resource = await this.findOneResource(id, tenantId);
    const repository = await this.getResourceRepository(tenantId);

    Object.assign(resource, dto);
    return repository.save(resource);
  }

  async deleteResource(id: string, tenantId: string): Promise<void> {
    const resource = await this.findOneResource(id, tenantId);
    const repository = await this.getResourceRepository(tenantId);

    // Soft delete
    resource.isActive = false;
    await repository.save(resource);
  }

  async checkResourceAvailability(
    resourceId: string,
    startTime: Date,
    endTime: Date,
    tenantId: string,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    const bookingRepository = await this.getBookingRepository(tenantId);

    const query = bookingRepository
      .createQueryBuilder('booking')
      .where('booking.resourceId = :resourceId', { resourceId })
      .andWhere(
        '(booking.bookingStart < :endTime AND booking.bookingEnd > :startTime)',
        { startTime, endTime },
      );

    if (excludeAppointmentId) {
      query.andWhere('booking.appointmentId != :excludeAppointmentId', { excludeAppointmentId });
    }

    const conflictingBookings = await query.getMany();
    return conflictingBookings.length === 0;
  }

  async bookResource(dto: BookResourceDto, tenantId: string): Promise<AppointmentResourceBooking> {
    const bookingRepository = await this.getBookingRepository(tenantId);
    const startTime = new Date(dto.bookingStart);
    const endTime = new Date(dto.bookingEnd);

    // Check availability
    const isAvailable = await this.checkResourceAvailability(
      dto.resourceId,
      startTime,
      endTime,
      tenantId,
      dto.appointmentId,
    );

    if (!isAvailable) {
      throw new ConflictException('Resource is not available at the requested time');
    }

    const booking = bookingRepository.create({
      appointmentId: dto.appointmentId,
      resourceId: dto.resourceId,
      bookingStart: startTime,
      bookingEnd: endTime,
      notes: dto.notes,
    });

    return bookingRepository.save(booking);
  }

  async getResourceBookings(resourceId: string, startDate: Date, endDate: Date, tenantId: string): Promise<AppointmentResourceBooking[]> {
    const bookingRepository = await this.getBookingRepository(tenantId);

    return bookingRepository.find({
      where: {
        resourceId,
        bookingStart: Between(startDate, endDate),
      },
      order: {
        bookingStart: 'ASC',
      },
    });
  }

  async getAppointmentResources(appointmentId: string, tenantId: string): Promise<AppointmentResourceBooking[]> {
    const bookingRepository = await this.getBookingRepository(tenantId);

    return bookingRepository.find({
      where: { appointmentId },
      relations: ['resource'],
    });
  }

  async cancelResourceBooking(bookingId: string, tenantId: string): Promise<void> {
    const bookingRepository = await this.getBookingRepository(tenantId);
    const booking = await bookingRepository.findOne({ where: { id: bookingId } });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    await bookingRepository.remove(booking);
  }
}

