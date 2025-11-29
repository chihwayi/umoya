import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PatientMedicalHistory } from '../entities/patient-medical-history.entity';
import { PatientFamilyHistory } from '../entities/patient-family-history.entity';
import { PatientSocialHistory } from '../entities/patient-social-history.entity';
import {
  CreateMedicalHistoryDto,
  CreateFamilyHistoryDto,
  CreateSocialHistoryDto,
  UpdateMedicalHistoryDto,
} from '../dto/patient-history.dto';

@Injectable()
export class PatientHistoryService {
  // Medical History
  async getMedicalHistory(patientId: string, tenantDb: DataSource): Promise<PatientMedicalHistory[]> {
    const repo = tenantDb.getRepository(PatientMedicalHistory);
    return repo.find({
      where: { patientId },
      order: { diagnosisDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createMedicalHistory(dto: CreateMedicalHistoryDto, tenantDb: DataSource, userId?: string): Promise<PatientMedicalHistory> {
    const repo = tenantDb.getRepository(PatientMedicalHistory);
    const history = repo.create({
      ...dto,
      diagnosisDate: dto.diagnosisDate ? new Date(dto.diagnosisDate) : undefined,
      resolvedDate: dto.resolvedDate ? new Date(dto.resolvedDate) : undefined,
      createdBy: userId,
    });
    return repo.save(history);
  }

  async updateMedicalHistory(
    id: string,
    dto: UpdateMedicalHistoryDto,
    tenantDb: DataSource
  ): Promise<PatientMedicalHistory> {
    const repo = tenantDb.getRepository(PatientMedicalHistory);
    const history = await repo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException('Medical history entry not found');
    }
    Object.assign(history, {
      ...dto,
      diagnosisDate: dto.diagnosisDate ? new Date(dto.diagnosisDate) : history.diagnosisDate,
      resolvedDate: dto.resolvedDate ? new Date(dto.resolvedDate) : history.resolvedDate,
    });
    return repo.save(history);
  }

  async deleteMedicalHistory(id: string, tenantDb: DataSource): Promise<void> {
    const repo = tenantDb.getRepository(PatientMedicalHistory);
    const history = await repo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException('Medical history entry not found');
    }
    await repo.remove(history);
  }

  // Family History
  async getFamilyHistory(patientId: string, tenantDb: DataSource): Promise<PatientFamilyHistory[]> {
    const repo = tenantDb.getRepository(PatientFamilyHistory);
    return repo.find({
      where: { patientId },
      order: { relationship: 'ASC', createdAt: 'DESC' },
    });
  }

  async createFamilyHistory(dto: CreateFamilyHistoryDto, tenantDb: DataSource, userId?: string): Promise<PatientFamilyHistory> {
    const repo = tenantDb.getRepository(PatientFamilyHistory);
    const history = repo.create({ ...dto, createdBy: userId });
    return repo.save(history);
  }

  async updateFamilyHistory(
    id: string,
    dto: Partial<CreateFamilyHistoryDto>,
    tenantDb: DataSource
  ): Promise<PatientFamilyHistory> {
    const repo = tenantDb.getRepository(PatientFamilyHistory);
    const history = await repo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException('Family history entry not found');
    }
    Object.assign(history, dto);
    return repo.save(history);
  }

  async deleteFamilyHistory(id: string, tenantDb: DataSource): Promise<void> {
    const repo = tenantDb.getRepository(PatientFamilyHistory);
    const history = await repo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException('Family history entry not found');
    }
    await repo.remove(history);
  }

  // Social History
  async getSocialHistory(patientId: string, tenantDb: DataSource): Promise<PatientSocialHistory[]> {
    const repo = tenantDb.getRepository(PatientSocialHistory);
    return repo.find({
      where: { patientId },
      order: { historyType: 'ASC', createdAt: 'DESC' },
    });
  }

  async createSocialHistory(dto: CreateSocialHistoryDto, tenantDb: DataSource, userId?: string): Promise<PatientSocialHistory> {
    const repo = tenantDb.getRepository(PatientSocialHistory);
    const history = repo.create({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      createdBy: userId,
    });
    return repo.save(history);
  }

  async updateSocialHistory(
    id: string,
    dto: Partial<CreateSocialHistoryDto>,
    tenantDb: DataSource
  ): Promise<PatientSocialHistory> {
    const repo = tenantDb.getRepository(PatientSocialHistory);
    const history = await repo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException('Social history entry not found');
    }
    Object.assign(history, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : history.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : history.endDate,
    });
    return repo.save(history);
  }

  async deleteSocialHistory(id: string, tenantDb: DataSource): Promise<void> {
    const repo = tenantDb.getRepository(PatientSocialHistory);
    const history = await repo.findOne({ where: { id } });
    if (!history) {
      throw new NotFoundException('Social history entry not found');
    }
    await repo.remove(history);
  }

  // Combined timeline
  async getPatientHistoryTimeline(patientId: string, tenantDb: DataSource): Promise<any> {
    const [medical, family, social] = await Promise.all([
      this.getMedicalHistory(patientId, tenantDb),
      this.getFamilyHistory(patientId, tenantDb),
      this.getSocialHistory(patientId, tenantDb),
    ]);

    return {
      medical,
      family,
      social,
    };
  }
}

