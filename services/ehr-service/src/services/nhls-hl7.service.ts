import { Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { TenantService } from './tenant.service';
import { NhlsLabResult } from '../entities/nhls-lab-result.entity';
import { Patient } from '../entities/patient.entity';

const simpleHl7 = require('simple-hl7');
const nhlsLoincMap = require('../data/nhls-loinc-map.json') as Record<string, string>;

@Injectable()
export class NhlsHl7Service {
  private readonly parser = new simpleHl7.Parser();

  constructor(private readonly tenantService: TenantService) {}

  async ingestHl7(tenantId: string, rawHl7: string): Promise<NhlsLabResult[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const resultRepo = db.getRepository(NhlsLabResult);
    const patientRepo = db.getRepository(Patient);

    const normalized = this.normalizeHl7(rawHl7);
    const message = this.parser.parse(normalized);
    const mshFields = normalized.split('\r')[0]?.split('|') || [];
    const pid = message.getSegment('PID');
    const obr = message.getSegment('OBR');
    const obxSegments = message.getSegments('OBX') || [];

    const nhlsLabNumber = mshFields[9] || obr?.getField(3) || obr?.getField(2) || `NHLS-${Date.now()}`;
    const nhlsPatientId = pid?.getComponent(3, 1) || pid?.getComponent(2, 1) || null;
    const linkedPatient = nhlsPatientId
      ? await patientRepo.findOne({ where: { nationalId: nhlsPatientId } })
      : null;

    const collectedAt = this.parseHl7DateTime(obr?.getField(7) || null);
    const savedRows: NhlsLabResult[] = [];

    for (const obx of obxSegments) {
      const testIdentifier = obx.getComponent(3, 1) || '';
      const testName =
        obx.getComponent(3, 2) ||
        obr?.getComponent(4, 2) ||
        obr?.getComponent(4, 1) ||
        testIdentifier ||
        'Unknown test';

      const entity = resultRepo.create({
        patientId: linkedPatient?.id || null,
        nhlsPatientId,
        nhlsLabNumber,
        testLoincCode: nhlsLoincMap[testIdentifier] || null,
        testName,
        resultValue: this.cleanValue(obx.getField(5)),
        resultUnit: this.cleanValue(obx.getField(6)),
        referenceRange: this.cleanValue(obx.getField(7)),
        abnormalFlag: this.cleanValue(obx.getField(8)),
        resultStatus: this.cleanValue(obx.getField(11)),
        collectedAt,
        resultedAt: this.parseHl7DateTime(obx.getField(14) || null),
        hl7Raw: normalized,
        processed: Boolean(linkedPatient?.id),
      });

      savedRows.push(await resultRepo.save(entity) as unknown as NhlsLabResult);
    }

    return savedRows;
  }

  async getResultsByPatient(tenantId: string, patientId: string): Promise<NhlsLabResult[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(NhlsLabResult).find({
      where: { patientId },
      order: { resultedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getPendingResults(tenantId: string): Promise<NhlsLabResult[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(NhlsLabResult).find({
      where: { patientId: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async linkResultToPatient(tenantId: string, resultId: string, patientId: string): Promise<NhlsLabResult | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const resultRepo = db.getRepository(NhlsLabResult);
    const patientRepo = db.getRepository(Patient);

    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    await resultRepo.update(resultId, { patientId, processed: true });
    return resultRepo.findOne({ where: { id: resultId } });
  }

  private normalizeHl7(rawHl7: string): string {
    return rawHl7
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\r');
  }

  private cleanValue(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private parseHl7DateTime(value: string | null | undefined): Date | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6) || '1') - 1;
    const day = Number(raw.slice(6, 8) || '1');
    const hour = Number(raw.slice(8, 10) || '0');
    const minute = Number(raw.slice(10, 12) || '0');
    const second = Number(raw.slice(12, 14) || '0');

    if (!year || Number.isNaN(month) || !day) return null;
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
}
