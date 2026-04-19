import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { TenantService } from '../services/tenant.service';
import { CdssService } from '../services/cdss.service';
import { DisaSyncLog } from './entities/disa-sync-log.entity';
import { SmartcarePatientLink } from './entities/smartcare-patient-link.entity';
import { CrossBorderPatientFlag } from './entities/cross-border-patient-flag.entity';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class DisaSmartcareService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  async pullDisaVlResults(tenantId: string, nid: string, patientId?: string): Promise<DisaSyncLog[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(DisaSyncLog);
    const disaUrl = String(process.env.DISA_BASE_URL || '').trim().replace(/\/$/, '');
    const disaToken = String(process.env.DISA_API_TOKEN || '').trim();

    if (!disaUrl || !disaToken) {
      return [
        await repo.save(
          repo.create({
            nid,
            patientId: patientId || null,
            syncType: 'vl_result',
            syncStatus: 'failed',
            errorMessage: 'DISA_BASE_URL or DISA_API_TOKEN not configured',
          }),
        ) as unknown as DisaSyncLog,
      ];
    }

    try {
      const response = await axios.get(`${disaUrl}/api/results`, {
        headers: {
          Authorization: `Bearer ${disaToken}`,
          Accept: 'application/json',
        },
        params: { nid, type: 'VL' },
        timeout: 15000,
      });

      const rows = this.extractRows(response.data);
      if (!rows.length) {
        return [
          await repo.save(
            repo.create({
              nid,
              patientId: patientId || null,
              syncType: 'vl_result',
              syncStatus: 'unmatched',
              errorMessage: 'No DISA viral load results returned',
            }),
          ) as unknown as DisaSyncLog,
        ];
      }

      const saved: DisaSyncLog[] = [];
      for (const row of rows) {
        const numeric = this.toNullableNumber(
          row?.resultNumeric ?? row?.numericResult ?? row?.valueNumeric ?? row?.vlNumeric,
        );
        saved.push(
          await repo.save(
            repo.create({
              patientId: patientId || null,
              disaPatientId: this.toNullableString(row?.disaPatientId ?? row?.patientId ?? row?.patient_id),
              nid,
              syncType: 'vl_result',
              syncStatus: 'success',
              sampleId: this.toNullableString(row?.sampleId ?? row?.sample_id),
              sampleCollectionDate: this.toDateOnly(row?.collectionDate ?? row?.sampleCollectionDate),
              resultType: 'HIV_VL',
              resultValue: this.toNullableString(row?.result ?? row?.resultValue ?? row?.value),
              resultNumeric: numeric,
              resultDate: this.toDateOnly(row?.resultDate ?? row?.releasedDate),
              suppressed: numeric !== null ? numeric < 1000 : null,
              disaFacilityCode: this.toNullableString(row?.facilityCode ?? row?.facility_code),
              disaProvince: this.toNullableString(row?.province),
              syncedAt: new Date(),
            }),
          ) as unknown as DisaSyncLog,
        );
      }
      return saved;
    } catch (error: any) {
      return [
        await repo.save(
          repo.create({
            nid,
            patientId: patientId || null,
            syncType: 'vl_result',
            syncStatus: 'failed',
            errorMessage: error?.response?.data?.message || error?.message || 'DISA sync failed',
          }),
        ) as unknown as DisaSyncLog,
      ];
    }
  }

  async getDisaSyncHistory(tenantId: string, patientId: string): Promise<DisaSyncLog[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(DisaSyncLog).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async linkSmartcarePatient(
    tenantId: string,
    localPatientId: string,
    smartcareUuid: string,
    artNumber?: string,
  ): Promise<SmartcarePatientLink> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const linkRepo = db.getRepository(SmartcarePatientLink);
    const patientRepo = db.getRepository(Patient);

    const patient = await patientRepo.findOne({ where: { id: localPatientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const smartcareUrl = String(process.env.SMARTCARE_BASE_URL || '').trim().replace(/\/$/, '');
    const smartcareToken = String(process.env.SMARTCARE_API_TOKEN || '').trim();

    const existing =
      (await linkRepo.findOne({ where: { localPatientId } })) ||
      (await linkRepo.findOne({ where: { smartcarePatientUuid: smartcareUuid } }));

    const saved = await linkRepo.save(
      linkRepo.create({
        ...(existing || {}),
        localPatientId,
        smartcarePatientUuid: smartcareUuid,
        smartcareArtNumber: artNumber || existing?.smartcareArtNumber || null,
        zambiaNationalId: patient.nationalId || existing?.zambiaNationalId || null,
        syncStatus: 'linked',
        lastSyncAt: new Date(),
      }),
    ) as unknown as SmartcarePatientLink;

    if (!smartcareUrl || !smartcareToken) {
      return saved;
    }

    try {
      const headers = {
        Authorization: `Bearer ${smartcareToken}`,
        Accept: 'application/fhir+json',
      };
      const [patientRes, medRes, obsRes] = await Promise.all([
        axios.get(`${smartcareUrl}/ws/fhir2/R4/Patient/${smartcareUuid}`, { headers, timeout: 15000 }),
        axios.get(`${smartcareUrl}/ws/fhir2/R4/MedicationRequest`, {
          headers,
          timeout: 15000,
          params: { patient: smartcareUuid },
        }),
        axios.get(`${smartcareUrl}/ws/fhir2/R4/Observation`, {
          headers,
          timeout: 15000,
          params: { patient: smartcareUuid },
        }),
      ]);

      const imported = this.extractSmartcareSummary(patientRes.data, medRes.data, obsRes.data);
      await linkRepo.update(saved.id, {
        ...imported,
        syncStatus: 'linked',
        importError: null,
        lastSyncAt: new Date(),
      });
    } catch (error: any) {
      await linkRepo.update(saved.id, {
        syncStatus: 'sync_failed',
        importError: error?.response?.data?.message || error?.message || 'SmartCare sync failed',
      });
    }

    return linkRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async getSmartcareLink(tenantId: string, localPatientId: string): Promise<SmartcarePatientLink | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(SmartcarePatientLink).findOne({ where: { localPatientId } });
  }

  async flagCrossBorderPatient(tenantId: string, dto: Partial<CrossBorderPatientFlag>): Promise<CrossBorderPatientFlag> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(CrossBorderPatientFlag);
    const existing = await repo.findOne({ where: { patientId: dto.patientId } });

    if (existing) {
      await repo.update(existing.id, {
        ...dto,
        updatedAt: new Date(),
      });
      return repo.findOneOrFail({ where: { id: existing.id } });
    }

    return repo.save(
      repo.create({
        ...dto,
        artHistoryImported: dto.artHistoryImported ?? false,
        vlHistoryImported: dto.vlHistoryImported ?? false,
        continuityGapDetected: dto.continuityGapDetected ?? false,
      }),
    ) as unknown as CrossBorderPatientFlag;
  }

  async assessCrossBorderContinuity(tenantId: string, patientId: string): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const crossBorderRepo = db.getRepository(CrossBorderPatientFlag);
    const smartcareLinkRepo = db.getRepository(SmartcarePatientLink);

    const flag = await crossBorderRepo.findOne({ where: { patientId } });
    if (!flag) {
      return {
        continuity_gap_detected: false,
        gap_severity: 'none',
        gap_explanation: 'No cross-border flag on this patient',
        recommended_actions: [],
        estimated_days_off_art: null,
        resistance_risk: 'low',
        confidence: 1,
      };
    }

    const link = await smartcareLinkRepo.findOne({ where: { localPatientId: patientId } });
    const current = await this.getCurrentHivContext(db, patientId);
    const daysSinceLastForeignVisit = flag.lastForeignVisitDate
      ? Math.max(0, Math.floor((Date.now() - new Date(flag.lastForeignVisitDate).getTime()) / 86400000))
      : 999;

    const assessment = await this.cdssService.crossBorderContinuity(
      {
        origin_country: flag.originCountry,
        current_country: flag.currentCountry,
        art_start_date_imported: link?.artStartDate ?? current.artStartDate,
        last_regimen_imported: link?.lastRegimen ?? null,
        last_vl_imported: link?.lastVl ?? null,
        last_vl_date_imported: link?.lastVlDate ?? null,
        days_since_last_foreign_visit: daysSinceLastForeignVisit,
        current_vl: current.currentVl,
        current_cd4: current.currentCd4,
        current_regimen: current.currentRegimen,
        patient_disclosed_foreign_treatment: true,
      },
      tenantId,
    );

    await crossBorderRepo.update(flag.id, {
      continuityGapDetected: Boolean(assessment?.continuity_gap_detected),
      continuityNotes: this.toNullableString(assessment?.gap_explanation),
      artHistoryImported: flag.artHistoryImported || Boolean(link?.artStartDate),
      vlHistoryImported: flag.vlHistoryImported || Boolean(link?.lastVlDate),
    });

    return assessment;
  }

  async getInteropSummary(tenantId: string): Promise<Record<string, any>> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const disaRepo = db.getRepository(DisaSyncLog);
    const smartcareRepo = db.getRepository(SmartcarePatientLink);
    const crossBorderRepo = db.getRepository(CrossBorderPatientFlag);

    const [disaTotal, disaSuccess, smartcareLinks, crossBorderPatients, recentCrossBorderFlags] = await Promise.all([
      disaRepo.count(),
      disaRepo.count({ where: { syncStatus: 'success' } }),
      smartcareRepo.count(),
      crossBorderRepo.count(),
      crossBorderRepo.find({ order: { updatedAt: 'DESC' }, take: 20 }),
    ]);

    return {
      disa: { total: disaTotal, success: disaSuccess },
      smartcareLinks,
      crossBorderPatients,
      recentCrossBorderFlags,
    };
  }

  private extractRows(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.data?.results)) return payload.data.results;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  private toNullableString(value: any): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toDateOnly(value: any): string | null {
    if (!value) return null;
    const asString = String(value);
    const match = asString.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const date = new Date(asString);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  private extractSmartcareSummary(patientPayload: any, medsPayload: any, obsPayload: any): Partial<SmartcarePatientLink> {
    const medicationEntries = Array.isArray(medsPayload?.entry) ? medsPayload.entry : [];
    const observations = Array.isArray(obsPayload?.entry) ? obsPayload.entry.map((entry: any) => entry?.resource || entry) : [];
    const lastMedication = medicationEntries[0]?.resource || medicationEntries[0];

    let lastVl: number | null = null;
    let lastVlDate: string | null = null;
    let lastCd4: number | null = null;

    for (const obs of observations) {
      const code = String(
        obs?.code?.text ||
        obs?.code?.coding?.[0]?.display ||
        obs?.code?.coding?.[0]?.code ||
        '',
      ).toLowerCase();
      const valueNumber = this.toNullableNumber(obs?.valueQuantity?.value ?? obs?.valueInteger ?? obs?.valueDecimal);
      const effectiveDate = this.toDateOnly(obs?.effectiveDateTime ?? obs?.issued);

      if (valueNumber !== null && code.includes('viral')) {
        if (!lastVlDate || (effectiveDate && effectiveDate > lastVlDate)) {
          lastVl = valueNumber;
          lastVlDate = effectiveDate;
        }
      }

      if (valueNumber !== null && code.includes('cd4')) {
        lastCd4 = valueNumber;
      }
    }

    return {
      zambiaNationalId: this.toNullableString(
        patientPayload?.identifier?.find((item: any) => item?.value)?.value ||
        patientPayload?.identifier?.[0]?.value,
      ),
      artStartDate: this.toDateOnly(lastMedication?.authoredOn),
      lastRegimen: this.toNullableString(
        lastMedication?.medicationCodeableConcept?.text ||
        lastMedication?.medicationReference?.display,
      ),
      lastCd4,
      lastVl,
      lastVlDate,
    };
  }

  private async getCurrentHivContext(db: any, patientId: string): Promise<{
    artStartDate: string | null;
    currentRegimen: string | null;
    currentVl: number | null;
    currentCd4: number | null;
  }> {
    const rows = await db.query(
      `
        SELECT
          e.art_start_date,
          e.current_regimen_name,
          (
            SELECT v.viral_load
            FROM hiv_clinical_visits v
            WHERE v.enrollment_id = e.id AND v.viral_load IS NOT NULL
            ORDER BY COALESCE(v.viral_load_test_date, v.visit_date) DESC
            LIMIT 1
          ) AS current_vl,
          (
            SELECT v.cd4_count
            FROM hiv_clinical_visits v
            WHERE v.enrollment_id = e.id AND v.cd4_count IS NOT NULL
            ORDER BY COALESCE(v.cd4_test_date, v.visit_date) DESC
            LIMIT 1
          ) AS current_cd4
        FROM hiv_enrollments e
        WHERE e.patient_id = $1
        ORDER BY e.created_at DESC
        LIMIT 1
      `,
      [patientId],
    );

    const row = rows?.[0];
    return {
      artStartDate: this.toDateOnly(row?.art_start_date),
      currentRegimen: this.toNullableString(row?.current_regimen_name),
      currentVl: this.toNullableNumber(row?.current_vl),
      currentCd4: this.toNullableNumber(row?.current_cd4),
    };
  }
}
