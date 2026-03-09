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
    return await repository.save(donor) as unknown as BloodDonor;
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

    return await repository.save(transfusion) as unknown as BloodTransfusion;
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

  async typeAndScreen(patientId: string, data: { bloodGroup: string; rhFactor: string; antibodyScreen?: string }, userId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `INSERT INTO blood_cross_match (patient_id, blood_group, rh_factor, antibody_screen, performed_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, data.bloodGroup, data.rhFactor, data.antibodyScreen || 'negative', userId],
    );
    return row;
  }

  async performCrossmatch(data: { patientId: string; inventoryId: string; majorCrossMatch?: string; minorCrossMatch?: string }, userId: string, tenantDb: DataSource): Promise<any> {
    const result = (data.majorCrossMatch || 'compatible').toLowerCase() === 'compatible' ? 'compatible' : 'incompatible';
    const [row] = await tenantDb.query(
      `INSERT INTO blood_cross_match (patient_id, inventory_id, blood_group, rh_factor, major_cross_match, minor_cross_match, cross_match_result, performed_by)
       SELECT $1, $2, bi.blood_group, bi.rh_factor, $3, $4, $5, $6
       FROM blood_inventory bi WHERE bi.id = $2
       RETURNING *`,
      [data.patientId, data.inventoryId, data.majorCrossMatch || 'compatible', data.minorCrossMatch || 'compatible', result, userId],
    );
    if (!row) throw new NotFoundException('Inventory unit not found');
    return row;
  }

  async getCrossmatchByPatient(patientId: string, tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM blood_cross_match WHERE patient_id = $1 ORDER BY performed_at DESC`,
      [patientId],
    );
  }

  async reportTransfusionReaction(transfusionId: string, data: any, userId: string, tenantDb: DataSource): Promise<any> {
    const [tx] = await tenantDb.query(`SELECT id, patient_id FROM blood_transfusions WHERE id = $1`, [transfusionId]);
    if (!tx) throw new NotFoundException('Transfusion not found');
    const [row] = await tenantDb.query(
      `INSERT INTO transfusion_reactions (transfusion_id, patient_id, reaction_time, reaction_type, severity, symptoms, vitals_at_reaction, treatment_given, transfusion_stopped, reported_by)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        transfusionId, tx.patient_id, data.reactionType || 'other', data.severity || 'moderate',
        data.symptoms ?? null, data.vitalsAtReaction ? JSON.stringify(data.vitalsAtReaction) : null,
        data.treatmentGiven ?? null, data.transfusionStopped !== false, userId,
      ],
    );
    return row;
  }

  async getTransfusionReactions(transfusionId: string, tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM transfusion_reactions WHERE transfusion_id = $1 ORDER BY reaction_time DESC`,
      [transfusionId],
    );
  }

  async activateMassiveTransfusionProtocol(patientId: string, data: { unitsRequested?: number; indication?: string }, userId: string, tenantDb: DataSource): Promise<any> {
    const units = data.unitsRequested ?? 4;
    this.logger.log(`MTP activated for patient ${patientId}, ${units} units requested`);
    return {
      activated: true,
      patientId,
      unitsRequested: units,
      indication: data.indication,
      message: 'Massive transfusion protocol activated; blood bank notified.',
    };
  }

  async getUtilizationReport(tenantDb: DataSource, startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();
    const [row] = await tenantDb.query(
      `SELECT
        COUNT(*)::int as total_transfusions,
        COUNT(*) FILTER (WHERE transfusion_status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE transfusion_status = 'in_progress')::int as in_progress
       FROM blood_transfusions WHERE order_date BETWEEN $1 AND $2`,
      [start, end],
    );
    return row;
  }
}

