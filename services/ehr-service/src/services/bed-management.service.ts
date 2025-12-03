import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bed } from '../entities/bed.entity';
import { Admission } from '../entities/admission.entity';
import { Discharge } from '../entities/discharge.entity';
import { PatientTransfer } from '../entities/patient-transfer.entity';

@Injectable()
export class BedManagementService {
  private readonly logger = new Logger(BedManagementService.name);

  async getBeds(
    filters: {
      wardName?: string;
      bedType?: string;
      status?: string;
      floor?: string;
    },
    tenantDb: DataSource,
  ): Promise<Bed[]> {
    const repository = tenantDb.getRepository(Bed);
    const queryBuilder = repository
      .createQueryBuilder('bed')
      .leftJoinAndSelect('bed.currentPatient', 'patient');

    if (filters.wardName) {
      queryBuilder.andWhere('bed.wardName = :wardName', { wardName: filters.wardName });
    }

    if (filters.bedType) {
      queryBuilder.andWhere('bed.bedType = :bedType', { bedType: filters.bedType });
    }

    if (filters.status) {
      queryBuilder.andWhere('bed.status = :status', { status: filters.status });
    }

    if (filters.floor) {
      queryBuilder.andWhere('bed.floor = :floor', { floor: filters.floor });
    }

    queryBuilder.andWhere('bed.isActive = :isActive', { isActive: true });
    queryBuilder.orderBy('bed.wardName', 'ASC').addOrderBy('bed.bedNumber', 'ASC');

    return await queryBuilder.getMany();
  }

  async getAvailableBeds(
    bedType?: string,
    wardName?: string,
    tenantDb?: DataSource,
  ): Promise<Bed[]> {
    return await this.getBeds(
      {
        status: 'available',
        bedType,
        wardName,
      },
      tenantDb,
    );
  }

  async assignBed(
    bedId: string,
    patientId: string,
    admissionId: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<Bed> {
    const repository = tenantDb.getRepository(Bed);
    const bed = await repository.findOne({ where: { id: bedId } });

    if (!bed) {
      throw new NotFoundException(`Bed not found: ${bedId}`);
    }

    if (bed.status !== 'available') {
      throw new ConflictException(`Bed ${bed.bedNumber} is not available (status: ${bed.status})`);
    }

    // Update bed status
    bed.status = 'occupied';
    bed.currentPatientId = patientId;
    bed.currentAdmissionId = admissionId;
    bed.occupiedSince = new Date();

    const updated = await repository.save(bed);

    // Log bed assignment
    await tenantDb.query(
      `
      INSERT INTO bed_assignments (
        bed_id, patient_id, admission_id, assigned_date, assigned_time, assigned_by, is_active
      ) VALUES ($1, $2, $3, NOW(), NOW(), $4, true)
    `,
      [bedId, patientId, admissionId, userId],
    );

    // Log status change
    await this.logBedStatusChange(bedId, 'available', 'occupied', null, patientId, userId, tenantDb);

    this.logger.log(`Bed assigned: ${bed.bedNumber} to patient ${patientId}`);
    return updated;
  }

  async releaseBed(
    bedId: string,
    userId: string,
    reason: string,
    tenantDb: DataSource,
  ): Promise<Bed> {
    const repository = tenantDb.getRepository(Bed);
    const bed = await repository.findOne({ where: { id: bedId } });

    if (!bed) {
      throw new NotFoundException(`Bed not found: ${bedId}`);
    }

    const previousPatientId = bed.currentPatientId;

    // Update bed status
    bed.status = 'cleaning';
    bed.currentPatientId = null;
    bed.currentAdmissionId = null;

    const updated = await repository.save(bed);

    // Update bed assignment
    await tenantDb.query(
      `
      UPDATE bed_assignments
      SET released_date = NOW(), released_time = NOW(), released_by = $1, is_active = false
      WHERE bed_id = $2 AND is_active = true
    `,
      [userId, bedId],
    );

    // Log status change
    await this.logBedStatusChange(bedId, 'occupied', 'cleaning', previousPatientId, null, userId, tenantDb);

    this.logger.log(`Bed released: ${bed.bedNumber}, reason: ${reason}`);
    return updated;
  }

  async markBedCleaned(
    bedId: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<Bed> {
    const repository = tenantDb.getRepository(Bed);
    const bed = await repository.findOne({ where: { id: bedId } });

    if (!bed) {
      throw new NotFoundException(`Bed not found: ${bedId}`);
    }

    bed.status = 'available';
    bed.lastCleanedAt = new Date();
    bed.lastCleanedBy = userId;

    const updated = await repository.save(bed);

    // Log status change
    await this.logBedStatusChange(bedId, 'cleaning', 'available', null, null, userId, tenantDb);

    this.logger.log(`Bed cleaned and available: ${bed.bedNumber}`);
    return updated;
  }

  async getBedOccupancy(
    wardName?: string,
    tenantDb?: DataSource,
  ): Promise<{
    totalBeds: number;
    occupied: number;
    available: number;
    cleaning: number;
    blocked: number;
    occupancyRate: number;
  }> {
    const stats = {
      totalBeds: 0,
      occupied: 0,
      available: 0,
      cleaning: 0,
      blocked: 0,
      occupancyRate: 0,
    };

    try {
      const query = wardName
        ? `SELECT status, COUNT(*) as count FROM beds WHERE ward_name = $1 AND is_active = true GROUP BY status`
        : `SELECT status, COUNT(*) as count FROM beds WHERE is_active = true GROUP BY status`;

      const params = wardName ? [wardName] : [];
      const results = await tenantDb.query(query, params);

      results.forEach((row: any) => {
        const count = parseInt(row.count);
        stats.totalBeds += count;
        
        switch (row.status) {
          case 'occupied':
            stats.occupied = count;
            break;
          case 'available':
            stats.available = count;
            break;
          case 'cleaning':
            stats.cleaning = count;
            break;
          case 'blocked':
          case 'maintenance':
          case 'out_of_service':
            stats.blocked += count;
            break;
        }
      });

      stats.occupancyRate = stats.totalBeds > 0 ? (stats.occupied / stats.totalBeds) * 100 : 0;
    } catch (error) {
      this.logger.warn(`Failed to fetch bed occupancy: ${error.message}`);
      // Return empty stats if beds table doesn't exist or query fails
    }

    return stats;
  }

  private async logBedStatusChange(
    bedId: string,
    previousStatus: string,
    newStatus: string,
    previousPatientId: string | null,
    newPatientId: string | null,
    userId: string,
    tenantDb: DataSource,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO bed_status_log (
        bed_id, previous_status, new_status, previous_patient_id, new_patient_id, changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [bedId, previousStatus, newStatus, previousPatientId, newPatientId, userId],
    );
  }

  async getWardsList(tenantDb: DataSource): Promise<string[]> {
    const results = await tenantDb.query(
      `SELECT DISTINCT ward_name FROM beds WHERE is_active = true ORDER BY ward_name`,
    );
    return results.map((r: any) => r.ward_name);
  }
}

