import { Injectable, NotFoundException } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { TenantService } from './tenant.service';
import { TierNetExport } from '../entities/tier-net-export.entity';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class TierNetService {
  constructor(private readonly tenantService: TenantService) {}

  async exportPatient(tenantId: string, patientId: string): Promise<TierNetExport> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const exportRepo = db.getRepository(TierNetExport);
    const patientRepo = db.getRepository(Patient);

    const patient = await patientRepo.findOne({ where: { id: patientId } });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const [enrollmentRows, latestRegimenRows, viralLoadRows, cd4Rows, existingExport] = await Promise.all([
      db.query(
        `SELECT id, art_start_date, enrollment_date, current_regimen
         FROM hiv_care_enrollments
         WHERE patient_id = $1
         ORDER BY enrollment_date DESC, created_at DESC`,
        [patientId],
      ),
      db.query(
        `SELECT v.arv_regimen_name, v.arv_regimen_code
         FROM hiv_clinical_visits v
         INNER JOIN hiv_care_enrollments e ON e.id = v.enrollment_id
         WHERE e.patient_id = $1
           AND (v.arv_regimen_name IS NOT NULL OR v.arv_regimen_code IS NOT NULL)
         ORDER BY v.visit_date DESC, v.created_at DESC
         LIMIT 1`,
        [patientId],
      ),
      db.query(
        `SELECT COALESCE(v.viral_load_test_date, v.visit_date) AS vl_date, v.viral_load AS vl_value
         FROM hiv_clinical_visits v
         INNER JOIN hiv_care_enrollments e ON e.id = v.enrollment_id
         WHERE e.patient_id = $1 AND v.viral_load IS NOT NULL
         ORDER BY COALESCE(v.viral_load_test_date, v.visit_date) DESC`,
        [patientId],
      ),
      db.query(
        `SELECT COALESCE(v.cd4_test_date, v.visit_date) AS cd4_date, v.cd4_count AS cd4_value
         FROM hiv_clinical_visits v
         INNER JOIN hiv_care_enrollments e ON e.id = v.enrollment_id
         WHERE e.patient_id = $1 AND v.cd4_count IS NOT NULL
         ORDER BY COALESCE(v.cd4_test_date, v.visit_date) DESC`,
        [patientId],
      ),
      exportRepo.findOne({ where: { patientId }, order: { createdAt: 'DESC' } }),
    ]);

    const earliestArtStartDate = enrollmentRows
      .map((row: any) => row.art_start_date || row.enrollment_date)
      .filter(Boolean)
      .sort()[0] || null;
    const currentRegimen =
      latestRegimenRows[0]?.arv_regimen_name ||
      latestRegimenRows[0]?.arv_regimen_code ||
      enrollmentRows[0]?.current_regimen ||
      '';
    const tierNetUid = existingExport?.tierNetUid || patient.nationalId || patient.id;
    const exportDate = new Date().toISOString().slice(0, 10);

    const patientXml = create({ version: '1.0' })
      .ele('TIERNetExport', { version: '2.0', exportDate })
      .ele('Patient', { uid: tierNetUid });

    const demographics = patientXml.ele('Demographics');
    demographics.ele('DOB').txt(
      patient.dateOfBirth instanceof Date
        ? patient.dateOfBirth.toISOString().slice(0, 10)
        : String(patient.dateOfBirth || ''),
    );
    demographics.ele('Gender').txt(this.mapGender(patient.gender));
    demographics.ele('SAIDNumber').txt(patient.nationalId || '');

    const artHistory = patientXml.ele('ARTHistory');
    artHistory.ele('ARTStartDate').txt(earliestArtStartDate || '');
    artHistory.ele('CurrentRegimen').txt(currentRegimen || '');

    const viralLoads = patientXml.ele('ViralLoads');
    viralLoadRows.forEach((row: any) => {
      viralLoads.ele('ViralLoad', {
        date: row.vl_date ? String(row.vl_date).slice(0, 10) : '',
        value: row.vl_value ?? '',
        suppressed: Number(row.vl_value) < 1000 ? 'true' : 'false',
      });
    });

    const cd4Counts = patientXml.ele('CD4Counts');
    cd4Rows.forEach((row: any) => {
      cd4Counts.ele('CD4', {
        date: row.cd4_date ? String(row.cd4_date).slice(0, 10) : '',
        value: row.cd4_value ?? '',
      });
    });

    const xml = patientXml.end({ prettyPrint: true });
    const entity = exportRepo.create({
      patientId,
      exportDate,
      exportType: 'art_cohort',
      exportStatus: 'pending',
      tierNetUid,
      payloadXml: xml,
    });

    return exportRepo.save(entity) as unknown as TierNetExport;
  }

  async batchExport(tenantId: string): Promise<{ queued: number }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const patients = await db.query(
      `SELECT DISTINCT patient_id
       FROM hiv_care_enrollments
       WHERE enrollment_date >= CURRENT_DATE - INTERVAL '12 months'
         AND patient_id IS NOT NULL`,
    );

    const patientIds = patients.map((row: any) => row.patient_id).filter(Boolean);
    void Promise.allSettled(patientIds.map((patientId: string) => this.exportPatient(tenantId, patientId)));
    return { queued: patientIds.length };
  }

  async getExports(tenantId: string): Promise<TierNetExport[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(TierNetExport).find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async downloadExport(tenantId: string, exportId: string): Promise<string | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const row = await db.getRepository(TierNetExport).findOne({ where: { id: exportId } });
    return row?.payloadXml || null;
  }

  private mapGender(gender: string | null | undefined): string {
    const normalized = String(gender || '').trim().toLowerCase();
    if (normalized.startsWith('m')) return 'M';
    if (normalized.startsWith('f')) return 'F';
    return normalized.toUpperCase() || '';
  }
}
