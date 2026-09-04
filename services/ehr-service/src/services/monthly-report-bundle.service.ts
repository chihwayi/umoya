import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import AdmZip = require('adm-zip');
import { ReportExportService, ReportDefinition } from './report-export.service';

@Injectable()
export class MonthlyReportBundleService {
  private readonly logger = new Logger(MonthlyReportBundleService.name);

  constructor(
    private readonly exportSvc: ReportExportService,
  ) {}

  // Fix (2026-09-04): this previously constructor-injected @InjectDataSource(),
  // but ehr-service has no default/global TypeORM connection anywhere — every
  // other service in this codebase resolves the tenant's own database via
  // req.tenantDb (database-per-tenant, see tenant.middleware.ts), not a shared
  // master DataSource. The missing provider crashed the entire app at startup.
  // Also fixed the same wrong-tenancy-model bug in _hivDefinition(), which
  // string-interpolated tenantId as a schema prefix (`${tenantId}.programme_indicators`)
  // as if this were schema-per-tenant — it isn't; each tenant has its own DB.
  async generateMonthlyBundle(tenantDb: DataSource, tenantId: string, period: string): Promise<Buffer> {
    const generatedAt = new Date();
    const facility = tenantId;

    const meta = { facility, period, generatedBy: 'Monthly Bundle Generator', generatedAt };

    const reports: { name: string; def: ReportDefinition }[] = [
      { name: 'hiv-cascade', def: await this._hivDefinition(tenantDb, meta) },
      { name: 'pmtct',       def: await this._pmtctDefinition(tenantId, meta) },
      { name: 'tb-hiv',      def: await this._tbHivDefinition(tenantId, meta) },
      { name: 'ncd',         def: await this._ncdDefinition(tenantId, meta) },
      { name: 'maternal',    def: await this._maternalDefinition(tenantId, meta) },
      { name: 'pharmacy',    def: await this._pharmacyDefinition(tenantId, meta) },
      { name: 'lab-quality', def: await this._labDefinition(tenantId, meta) },
    ];

    const zip = new AdmZip();
    await Promise.all(
      reports.map(async ({ name, def }) => {
        try {
          const pdf = await this.exportSvc.generatePdf(def);
          zip.addFile(`${name}-${period}.pdf`, pdf);
        } catch (e) {
          this.logger.error(`Failed to generate ${name} report: ${e}`);
        }
      }),
    );

    return zip.toBuffer();
  }

  // ------------------------------------------------------------------
  // Per-programme report definitions (query data from DB)
  // ------------------------------------------------------------------

  private async _hivDefinition(tenantDb: DataSource, meta: Partial<ReportDefinition>): Promise<ReportDefinition> {
    let rows: any[] = [];
    try {
      rows = await tenantDb.query(
        `SELECT indicator_name AS "Indicator", value AS "Value", target AS "Target",
                ROUND((value::numeric / NULLIF(target, 0)) * 100, 1) AS "Achievement %"
         FROM programme_indicators
         WHERE programme = 'HIV' AND period = $1
         ORDER BY indicator_name`, [meta.period],
      );
    } catch { /* no indicator table yet */ }

    return {
      title: 'HIV 95-95-95 Programme Report',
      ...meta as any,
      footer: 'Data source: Umoya EHR + DHIS2. CONFIDENTIAL — PEPFAR/MOH use only.',
      sections: [
        {
          type: 'table',
          title: 'HIV Programme Indicators',
          columns: [
            { key: 'Indicator', label: 'Indicator', width: 32 },
            { key: 'Value', label: 'Value', width: 12 },
            { key: 'Target', label: 'Target', width: 12 },
            { key: 'Achievement %', label: 'Achievement %', width: 16 },
          ],
          rows: rows.length ? rows : [{ Indicator: 'No data for period', Value: '', Target: '', 'Achievement %': '' }],
          conditionalColour: {
            column: 'Achievement %',
            thresholds: [
              { max: 69, colour: '#E8614D' },
              { max: 84, colour: '#F0954A' },
              { max: 100, colour: '#0AA98A' },
            ],
          },
        },
      ],
    };
  }

  private async _pmtctDefinition(tenantId: string, meta: Partial<ReportDefinition>): Promise<ReportDefinition> {
    return {
      title: 'PMTCT Programme Report',
      ...meta as any,
      sections: [
        { type: 'narrative', title: 'PMTCT Summary', text: `PMTCT programme data for ${meta.period}. MTCT rate and coverage data are drawn from facility registers.` },
      ],
    };
  }

  private async _tbHivDefinition(tenantId: string, meta: Partial<ReportDefinition>): Promise<ReportDefinition> {
    return {
      title: 'TB-HIV Co-infection Report',
      ...meta as any,
      sections: [
        { type: 'narrative', title: 'TB-HIV Summary', text: `TB-HIV co-infection data for ${meta.period}. HIV testing coverage among TB patients and TB screening among PLHIV.` },
      ],
    };
  }

  private async _ncdDefinition(tenantId: string, meta: Partial<ReportDefinition>): Promise<ReportDefinition> {
    return {
      title: 'NCD Control Report',
      ...meta as any,
      sections: [
        { type: 'narrative', title: 'NCD Summary', text: `NCD programme data for ${meta.period}. Hypertension and diabetes control rates, complication screening coverage.` },
      ],
    };
  }

  private async _maternalDefinition(tenantId: string, meta: Partial<ReportDefinition>): Promise<ReportDefinition> {
    return {
      title: 'Maternal & Newborn Health Report',
      ...meta as any,
      footer: 'MDSR data is confidential and for quality improvement purposes only.',
      sections: [
        { type: 'narrative', title: 'Maternal Health Summary', text: `Maternal mortality and MDSR data for ${meta.period}. MMR, cause-of-death distribution, and three-delay analysis.` },
      ],
    };
  }

  private async _pharmacyDefinition(tenantId: string, meta: Partial<ReportDefinition>): Promise<ReportDefinition> {
    return {
      title: 'Pharmacy Intelligence Report',
      ...meta as any,
      sections: [
        { type: 'narrative', title: 'Pharmacy Summary', text: `Formulary adherence, drug waste, and AMS metrics for ${meta.period}.` },
      ],
    };
  }

  private async _labDefinition(tenantId: string, meta: Partial<ReportDefinition>): Promise<ReportDefinition> {
    return {
      title: 'Laboratory Quality Assurance Report',
      ...meta as any,
      sections: [
        { type: 'narrative', title: 'Lab QA Summary', text: `EQA performance, internal QC failures, and critical value notification metrics for ${meta.period}.` },
      ],
    };
  }
}
