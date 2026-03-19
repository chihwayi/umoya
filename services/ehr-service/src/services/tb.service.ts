import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { TbPatient } from '../entities/tb-patient.entity';
import { TbDiagnosis } from '../entities/tb-diagnosis.entity';
import { TbTreatmentEpisode } from '../entities/tb-treatment-episode.entity';
import { TbDotRecord } from '../entities/tb-dot-record.entity';
import { TbContactInvestigation } from '../entities/tb-contact-investigation.entity';
import { TbDrugSusceptibility } from '../entities/tb-drug-susceptibility.entity';
import { TbOutcome } from '../entities/tb-outcome.entity';

@Injectable()
export class TbService {
  private readonly logger = new Logger(TbService.name);
  private readonly cdssUrl: string;

  constructor() {
    this.cdssUrl = (process.env.CDSS_SERVICE_URL || '').replace(/\/$/, '');
  }

  // ── Registration ──────────────────────────────────────────────────────────

  async registerPatient(data: Partial<TbPatient>, tenantDb: DataSource): Promise<TbPatient> {
    const repo = tenantDb.getRepository(TbPatient);
    return repo.save(repo.create(data));
  }

  async getTbPatient(tbPatientId: string, tenantDb: DataSource): Promise<TbPatient> {
    const p = await tenantDb.getRepository(TbPatient).findOne({ where: { id: tbPatientId } });
    if (!p) throw new NotFoundException(`TB patient ${tbPatientId} not found`);
    return p;
  }

  async getTbPatientByPatientId(patientId: string, tenantDb: DataSource): Promise<TbPatient | null> {
    return tenantDb.getRepository(TbPatient).findOne({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async updateTbPatient(id: string, data: Partial<TbPatient>, tenantDb: DataSource): Promise<TbPatient> {
    await tenantDb.getRepository(TbPatient).update(id, data as any);
    return this.getTbPatient(id, tenantDb);
  }

  async listTbPatients(
    tenantDb: DataSource,
    opts: { status?: string; caseType?: string; limit?: number } = {},
  ): Promise<TbPatient[]> {
    const qb = tenantDb.getRepository(TbPatient)
      .createQueryBuilder('tp')
      .orderBy('tp.registration_date', 'DESC')
      .take(opts.limit ?? 100);
    if (opts.status)   qb.andWhere('tp.status = :status', { status: opts.status });
    if (opts.caseType) qb.andWhere('tp.case_type = :caseType', { caseType: opts.caseType });
    return qb.getMany();
  }

  // ── Diagnosis ─────────────────────────────────────────────────────────────

  async addDiagnosis(data: Partial<TbDiagnosis>, tenantDb: DataSource): Promise<TbDiagnosis> {
    const repo = tenantDb.getRepository(TbDiagnosis);
    return repo.save(repo.create(data));
  }

  async getDiagnoses(tbPatientId: string, tenantDb: DataSource): Promise<TbDiagnosis[]> {
    return tenantDb.getRepository(TbDiagnosis).find({
      where: { tbPatientId },
      order: { diagnosisDate: 'DESC' },
    });
  }

  // ── Treatment episodes ────────────────────────────────────────────────────

  async startEpisode(data: Partial<TbTreatmentEpisode>, tenantDb: DataSource): Promise<TbTreatmentEpisode> {
    const repo = tenantDb.getRepository(TbTreatmentEpisode);
    return repo.save(repo.create(data));
  }

  async getEpisodes(tbPatientId: string, tenantDb: DataSource): Promise<TbTreatmentEpisode[]> {
    return tenantDb.getRepository(TbTreatmentEpisode).find({
      where: { tbPatientId },
      order: { startDate: 'DESC' },
    });
  }

  async updateEpisode(id: string, data: Partial<TbTreatmentEpisode>, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(TbTreatmentEpisode).update(id, data as any);
  }

  // ── DOT records ───────────────────────────────────────────────────────────

  async recordDot(data: Partial<TbDotRecord>, tenantDb: DataSource): Promise<TbDotRecord> {
    const repo = tenantDb.getRepository(TbDotRecord);
    return repo.save(repo.create(data));
  }

  async getDotRecords(
    tbPatientId: string,
    tenantDb: DataSource,
    opts: { from?: Date; to?: Date; episodeId?: string } = {},
  ): Promise<TbDotRecord[]> {
    const qb = tenantDb.getRepository(TbDotRecord)
      .createQueryBuilder('d')
      .where('d.tb_patient_id = :tbPatientId', { tbPatientId })
      .orderBy('d.dot_date', 'DESC');
    if (opts.from) qb.andWhere('d.dot_date >= :from', { from: opts.from });
    if (opts.to)   qb.andWhere('d.dot_date <= :to', { to: opts.to });
    if (opts.episodeId) qb.andWhere('d.episode_id = :episodeId', { episodeId: opts.episodeId });
    return qb.getMany();
  }

  // ── Contact investigation ─────────────────────────────────────────────────

  async addContact(data: Partial<TbContactInvestigation>, tenantDb: DataSource): Promise<TbContactInvestigation> {
    const repo = tenantDb.getRepository(TbContactInvestigation);
    return repo.save(repo.create(data));
  }

  async getContacts(tbPatientId: string, tenantDb: DataSource): Promise<TbContactInvestigation[]> {
    return tenantDb.getRepository(TbContactInvestigation).find({
      where: { tbPatientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateContact(id: string, data: Partial<TbContactInvestigation>, tenantDb: DataSource): Promise<void> {
    await tenantDb.getRepository(TbContactInvestigation).update(id, data as any);
  }

  // ── DST ───────────────────────────────────────────────────────────────────

  async addDst(data: Partial<TbDrugSusceptibility>, tenantDb: DataSource): Promise<TbDrugSusceptibility> {
    const repo = tenantDb.getRepository(TbDrugSusceptibility);
    return repo.save(repo.create(data));
  }

  async getDstResults(tbPatientId: string, tenantDb: DataSource): Promise<TbDrugSusceptibility[]> {
    return tenantDb.getRepository(TbDrugSusceptibility).find({
      where: { tbPatientId },
      order: { specimenDate: 'DESC' },
    });
  }

  // ── Outcome ───────────────────────────────────────────────────────────────

  async recordOutcome(data: Partial<TbOutcome>, tenantDb: DataSource): Promise<TbOutcome> {
    const repo = tenantDb.getRepository(TbOutcome);
    const saved = await repo.save(repo.create(data));
    // Mirror onto TbPatient.status
    if (data.tbPatientId && data.outcome) {
      await tenantDb.getRepository(TbPatient).update(data.tbPatientId, { status: data.outcome } as any);
    }
    return saved;
  }

  async getOutcomes(tbPatientId: string, tenantDb: DataSource): Promise<TbOutcome[]> {
    return tenantDb.getRepository(TbOutcome).find({
      where: { tbPatientId },
      order: { outcomeDate: 'DESC' },
    });
  }

  // ── CDSS helpers ──────────────────────────────────────────────────────────

  async recommendRegimen(payload: Record<string, any>): Promise<any> {
    return this.callCdss('/tb/regimen/recommend', payload);
  }

  async assessContactRisk(payload: Record<string, any>): Promise<any> {
    return this.callCdss('/tb/contact/risk', payload);
  }

  async analyseAdherence(payload: Record<string, any>): Promise<any> {
    return this.callCdss('/tb/dot/adherence', payload);
  }

  private async callCdss(path: string, payload: Record<string, any>): Promise<any> {
    if (!this.cdssUrl) return { error: 'CDSS not configured' };
    try {
      const resp = await axios.post(`${this.cdssUrl}${path}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': process.env.CDSS_SERVICE_TOKEN || '',
        },
        timeout: 15_000,
      });
      return resp.data;
    } catch (err: any) {
      this.logger.warn(`CDSS ${path} error: ${String(err?.message || err)}`);
      return { error: String(err?.message || err) };
    }
  }
}
