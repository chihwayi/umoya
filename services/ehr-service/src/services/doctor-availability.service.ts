import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { DoctorAvailability } from '../entities/doctor-availability.entity';
import { CreateDoctorAvailabilityDto, UpdateDoctorAvailabilityDto, DoctorAvailabilityQueryDto } from '../dto/doctor-availability.dto';
import { TenantService } from './tenant.service';

@Injectable()
export class DoctorAvailabilityService {
  constructor(private tenantService: TenantService) {}

  private async getAvailabilityRepository(tenantId: string): Promise<Repository<DoctorAvailability>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(DoctorAvailability);
  }

  async create(createDto: CreateDoctorAvailabilityDto, userId: string, tenantId: string): Promise<DoctorAvailability> {
    const repository = await this.getAvailabilityRepository(tenantId);
    
    // Validate dates
    const startDate = new Date(createDto.startDate);
    const endDate = createDto.endDate ? new Date(createDto.endDate) : null;
    
    if (endDate && endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const availability = repository.create({
      ...createDto,
      startDate,
      endDate: endDate || startDate,
      createdBy: userId,
    });

    return repository.save(availability);
  }

  async findAll(query: DoctorAvailabilityQueryDto, tenantId: string): Promise<{ availabilities: DoctorAvailability[]; total: number }> {
    const repository = await this.getAvailabilityRepository(tenantId);
    const queryBuilder = repository.createQueryBuilder('availability');

    if (query.doctorId) {
      queryBuilder.andWhere('availability.doctorId = :doctorId', { doctorId: query.doctorId });
    }

    if (query.date) {
      const queryDate = new Date(query.date);
      queryBuilder.andWhere(
        '(availability.startDate <= :queryDate AND (availability.endDate IS NULL OR availability.endDate >= :queryDate))',
        { queryDate }
      );
    }

    if (query.isUnavailable !== undefined) {
      queryBuilder.andWhere('availability.isUnavailable = :isUnavailable', { isUnavailable: query.isUnavailable });
    }

    queryBuilder.orderBy('availability.startDate', 'ASC');
    
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    
    queryBuilder.skip(skip).take(limit);
    
    const [availabilities, total] = await queryBuilder.getManyAndCount();
    return { availabilities, total };
  }

  async findOne(id: string, tenantId: string): Promise<DoctorAvailability> {
    const repository = await this.getAvailabilityRepository(tenantId);
    const availability = await repository.findOne({ where: { id } });
    
    if (!availability) {
      throw new NotFoundException(`Availability with ID ${id} not found`);
    }
    
    return availability;
  }

  async update(id: string, updateDto: UpdateDoctorAvailabilityDto, userId: string, tenantId: string): Promise<DoctorAvailability> {
    const repository = await this.getAvailabilityRepository(tenantId);
    const availability = await this.findOne(id, tenantId);

    // Validate dates if provided
    if (updateDto.startDate && updateDto.endDate) {
      const startDate = new Date(updateDto.startDate);
      const endDate = new Date(updateDto.endDate);
      if (endDate < startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    Object.assign(availability, {
      ...updateDto,
      startDate: updateDto.startDate ? new Date(updateDto.startDate) : availability.startDate,
      endDate: updateDto.endDate ? new Date(updateDto.endDate) : availability.endDate,
      updatedBy: userId,
    });

    return repository.save(availability);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const repository = await this.getAvailabilityRepository(tenantId);
    const availability = await this.findOne(id, tenantId);
    await repository.remove(availability);
  }

  async checkDoctorUnavailable(
    doctorId: string,
    appointmentDate: Date,
    durationMinutes: number,
    tenantId: string
  ): Promise<boolean> {
    const repository = await this.getAvailabilityRepository(tenantId);
    const appointmentEnd = new Date(appointmentDate);
    appointmentEnd.setMinutes(appointmentEnd.getMinutes() + durationMinutes);

    const appointmentDateOnly = new Date(appointmentDate);
    appointmentDateOnly.setHours(0, 0, 0, 0);

    // Find all unavailability records that overlap with the appointment
    const unavailabilities = await repository
      .createQueryBuilder('availability')
      .where('availability.doctorId = :doctorId', { doctorId })
      .andWhere('availability.isUnavailable = true')
      .andWhere('availability.startDate <= :appointmentDate', { appointmentDate: appointmentDateOnly })
      .andWhere('(availability.endDate IS NULL OR availability.endDate >= :appointmentDate)', { appointmentDate: appointmentDateOnly })
      .getMany();

    for (const unavailability of unavailabilities) {
      // If it's all day, doctor is unavailable
      if (unavailability.isAllDay) {
        return true;
      }

      // Check time overlap
      if (unavailability.startTime && unavailability.endTime) {
        const [startHour, startMin] = unavailability.startTime.split(':').map(Number);
        const [endHour, endMin] = unavailability.endTime.split(':').map(Number);
        
        const unavailStart = new Date(appointmentDate);
        unavailStart.setHours(startHour, startMin, 0, 0);
        
        const unavailEnd = new Date(appointmentDate);
        unavailEnd.setHours(endHour, endMin, 0, 0);

        // Check if appointment overlaps with unavailable time
        if (appointmentDate < unavailEnd && appointmentEnd > unavailStart) {
          return true;
        }
      }
    }

    return false;
  }
}

