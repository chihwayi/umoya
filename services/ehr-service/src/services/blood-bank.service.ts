import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BloodDonor } from '../entities/blood-donor.entity';
import { BloodInventory } from '../entities/blood-inventory.entity';
import { BloodTransfusion } from '../entities/blood-transfusion.entity';

@Injectable()
export class BloodBankService {
  private readonly logger = new Logger(BloodBankService.name);

  constructor() {}

  // ==================== DONORS ====================

  async registerDonor(
    donorData: any,
    tenantDb: DataSource,
  ): Promise<BloodDonor> {
    const repository = tenantDb.getRepository(BloodDonor);
    const donor = repository.create(donorData);
    return await repository.save(donor);
  }

  async getDonors(
    filters: any,
    tenantDb: DataSource,
  ): Promise<BloodDonor[]> {
    const repository = tenantDb.getRepository(BloodDonor);
    return await repository.find({
      where: filters,
      order: { lastName: 'ASC' },
    });
  }

  // ==================== INVENTORY ====================

  async getInventory(
    filters: any,
    tenantDb: DataSource,
  ): Promise<BloodInventory[]> {
    const repository = tenantDb.getRepository(BloodInventory);
    
    const query = repository.createQueryBuilder('inventory')
      .where('inventory.status = :status', { status: filters.status || 'available' });

    if (filters.componentType) {
      query.andWhere('inventory.componentType = :componentType', { componentType: filters.componentType });
    }

    if (filters.bloodGroup) {
      query.andWhere('inventory.bloodGroup = :bloodGroup', { bloodGroup: filters.bloodGroup });
    }

    return await query.orderBy('inventory.expiryDate', 'ASC').getMany();
  }

  async getInventoryStats(
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(BloodInventory);

    const stats = await repository
      .createQueryBuilder('inventory')
      .select('inventory.componentType', 'component')
      .addSelect('inventory.bloodGroup', 'bloodGroup')
      .addSelect('COUNT(*)', 'count')
      .where('inventory.status = :status', { status: 'available' })
      .andWhere('inventory.expiryDate > :today', { today: new Date() })
      .groupBy('inventory.componentType')
      .addGroupBy('inventory.bloodGroup')
      .getRawMany();

    return stats;
  }

  async reserveUnit(
    unitId: string,
    patientId: string,
    tenantDb: DataSource,
  ): Promise<BloodInventory> {
    const repository = tenantDb.getRepository(BloodInventory);

    const unit = await repository.findOne({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException('Blood unit not found');
    }

    if (unit.status !== 'available') {
      throw new Error('Blood unit not available');
    }

    unit.status = 'reserved';
    return await repository.save(unit);
  }

  // ==================== TRANSFUSIONS ====================

  async orderTransfusion(
    transfusionData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = repository.create({
      ...transfusionData,
      orderedById: userId,
      orderDate: new Date(),
      transfusionStatus: 'ordered',
    });

    return await repository.save(transfusion);
  }

  async startTransfusion(
    id: string,
    userId: string,
    preVitals: any,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = await repository.findOne({ where: { id } });
    if (!transfusion) {
      throw new NotFoundException('Transfusion not found');
    }

    transfusion.startTime = new Date();
    transfusion.administeredById = userId;
    transfusion.preTransfusionVitals = preVitals;
    transfusion.transfusionStatus = 'in_progress';

    return await repository.save(transfusion);
  }

  async recordTransfusionVitals(
    id: string,
    vitals: any,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = await repository.findOne({ where: { id } });
    if (!transfusion) {
      throw new NotFoundException('Transfusion not found');
    }

    const vitalsLog = transfusion.transfusionVitals || [];
    vitalsLog.push({
      ...vitals,
      time: new Date().toISOString(),
    });

    transfusion.transfusionVitals = vitalsLog;
    return await repository.save(transfusion);
  }

  async completeTransfusion(
    id: string,
    completionData: any,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = await repository.findOne({ where: { id } });
    if (!transfusion) {
      throw new NotFoundException('Transfusion not found');
    }

    transfusion.endTime = new Date();
    transfusion.volumeTransfused = completionData.volumeTransfused;
    transfusion.completionNotes = completionData.notes;
    transfusion.transfusionStatus = 'completed';

    return await repository.save(transfusion);
  }

  async getActiveTransfusions(
    tenantDb: DataSource,
  ): Promise<BloodTransfusion[]> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    return await repository.find({
      where: { transfusionStatus: 'in_progress' },
      relations: ['patient', 'administeredBy', 'inventory'],
      order: { startTime: 'ASC' },
    });
  }
}

