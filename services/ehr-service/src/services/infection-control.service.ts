import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InfectionSurveillance } from '../entities/infection-surveillance.entity';
import { IsolationPrecaution } from '../entities/isolation-precaution.entity';
import { AntimicrobialStewardship } from '../entities/antimicrobial-stewardship.entity';

@Injectable()
export class InfectionControlService {
  private readonly logger = new Logger(InfectionControlService.name);

  constructor() {}

  // ==================== INFECTION SURVEILLANCE ====================

  async reportInfection(
    infectionData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<InfectionSurveillance> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    const infection = repository.create({
      ...infectionData,
      detectedById: userId,
      detectedDate: new Date(),
    });

    return await repository.save(infection) as unknown as InfectionSurveillance;
  }

  async getInfectionsByDateRange(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<InfectionSurveillance[]> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    return await repository
      .createQueryBuilder('infection')
      .where('infection.infectionDate >= :startDate', { startDate })
      .andWhere('infection.infectionDate <= :endDate', { endDate })
      .leftJoinAndSelect('infection.patient', 'patient')
      .leftJoinAndSelect('infection.detectedBy', 'detectedBy')
      .orderBy('infection.infectionDate', 'DESC')
      .getMany();
  }

  async getHAIMetrics(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(InfectionSurveillance);

    const haiCases = await repository
      .createQueryBuilder('infection')
      .where('infection.infectionDate >= :startDate', { startDate })
      .andWhere('infection.infectionDate <= :endDate', { endDate })
      .andWhere('infection.onsetType = :onsetType', { onsetType: 'hospital_acquired' })
      .getMany();

    const byType = haiCases.reduce((acc: any, infection) => {
      acc[infection.infectionType] = (acc[infection.infectionType] || 0) + 1;
      return acc;
    }, {});

    return {
      totalHAI: haiCases.length,
      byType,
      deviceAssociated: haiCases.filter(i => i.deviceAssociated).length,
    };
  }

  // ==================== ISOLATION PRECAUTIONS ====================

  async orderIsolation(
    isolationData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    const isolation = repository.create({
      ...isolationData,
      orderedById: userId,
      startDate: new Date(),
      status: 'active',
    });

    return await repository.save(isolation) as unknown as IsolationPrecaution;
  }

  async getActiveIsolations(
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution[]> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    return await repository.find({
      where: { status: 'active' },
      relations: ['patient', 'orderedBy'],
      order: { startDate: 'DESC' },
    });
  }

  async discontinueIsolation(
    id: string,
    reason: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<IsolationPrecaution> {
    const repository = tenantDb.getRepository(IsolationPrecaution);

    const isolation = await repository.findOne({ where: { id } });
    if (!isolation) {
      throw new NotFoundException('Isolation precaution not found');
    }

    isolation.status = 'discontinued';
    isolation.endDate = new Date();
    isolation.discontinuedById = userId;
    isolation.discontinuationReason = reason;

    return await repository.save(isolation);
  }

  // ==================== ANTIMICROBIAL STEWARDSHIP ====================

  async trackAntibiotic(
    stewardshipData: any,
    tenantDb: DataSource,
  ): Promise<AntimicrobialStewardship> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const stewardship = repository.create(stewardshipData);
    return await repository.save(stewardship) as unknown as AntimicrobialStewardship;
  }

  async getAntibioticUsageReport(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const usage = await repository
      .createQueryBuilder('stewardship')
      .where('stewardship.startDate >= :startDate', { startDate })
      .andWhere('stewardship.startDate <= :endDate', { endDate })
      .getMany();

    const byAntibiotic = usage.reduce((acc: any, item) => {
      acc[item.antibioticName] = (acc[item.antibioticName] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPrescriptions: usage.length,
      byAntibiotic,
      empiric: usage.filter(u => u.empiricOrTargeted === 'empiric').length,
      targeted: usage.filter(u => u.empiricOrTargeted === 'targeted').length,
    };
  }

  async reviewAntibiotic(
    id: string,
    reviewData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<AntimicrobialStewardship> {
    const repository = tenantDb.getRepository(AntimicrobialStewardship);

    const stewardship = await repository.findOne({ where: { id } });
    if (!stewardship) {
      throw new NotFoundException('Antibiotic record not found');
    }

    stewardship.reviewDate = new Date();
    stewardship.reviewedById = userId;
    stewardship.stewardshipRecommendation = reviewData.recommendation;
    stewardship.appropriateIndication = reviewData.appropriateIndication;
    stewardship.appropriateDose = reviewData.appropriateDose;
    stewardship.appropriateDuration = reviewData.appropriateDuration;
    stewardship.deEscalationOpportunity = reviewData.deEscalationOpportunity;
    stewardship.deEscalationNotes = reviewData.deEscalationNotes;

    return await repository.save(stewardship);
  }
}


