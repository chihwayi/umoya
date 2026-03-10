import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { Patient } from '../entities/patient.entity';
import { TenantDhis2Config, TenantService } from './tenant.service';

interface Dhis2RuntimeConfig {
  baseUrl: string;
  apiVersion: string;
  authType: 'pat' | 'basic';
  pat?: string;
  username?: string;
  password?: string;
  orgUnitId?: string;
  trackedEntityTypeId?: string;
  dataSetId?: string;
}

interface Dhis2Context {
  enabled: boolean;
  useMock: boolean;
  reason?: string;
  config?: Dhis2RuntimeConfig;
  client?: AxiosInstance;
}

interface Dhis2PatientMappingRow {
  patient_id: string;
  dhis2_tei_id: string;
}

interface Dhis2EnrollmentRow {
  enrollment: string;
  status?: string;
}

interface Dhis2SyncStatsRow {
  last_sync?: string | null;
  patient_success_count?: number | string | null;
  event_success_count?: number | string | null;
  data_value_success_count?: number | string | null;
  total_error_count?: number | string | null;
}

export interface Dhis2SyncLogRow {
  id: string;
  entity_type: string;
  entity_id?: string | null;
  dhis2_id?: string | null;
  action: string;
  status: string;
  error_message?: string | null;
  payload?: Record<string, any> | null;
  synced_at?: string | null;
}

interface PatientAttributeIdMap {
  patientNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  phone?: string;
}

type AggregateProfileKey =
  | 'service_delivery'
  | 'maternal_newborn'
  | 'hiv_monthly'
  | 'immunization_monthly'
  | 'pharmacy_stock';

interface AggregateProfileDefinition {
  dataSetCode: string;
  metricCodes: Record<string, string>;
}

@Injectable()
export class Dhis2Service {
  private readonly logger = new Logger(Dhis2Service.name);

  private readonly envBaseUrl = process.env.DHIS2_URL || 'https://dhis2.mohcc.gov.zw';
  private readonly envUsername = process.env.DHIS2_USERNAME;
  private readonly envPassword = process.env.DHIS2_PASSWORD;
  private readonly envPat = process.env.DHIS2_PAT;
  private readonly envApiVersion = process.env.DHIS2_API_VERSION || '38';
  private readonly envOrgUnit = process.env.DHIS2_ORG_UNIT;
  private readonly envTrackedEntityType = process.env.DHIS2_TRACKED_ENTITY_TYPE;
  private readonly envDataSetId = process.env.DHIS2_DATASET_ID;
  private readonly envAttrPatientNumber = process.env.DHIS2_ATTR_PATIENT_NUMBER;
  private readonly envAttrFirstName = process.env.DHIS2_ATTR_FIRST_NAME;
  private readonly envAttrLastName = process.env.DHIS2_ATTR_LAST_NAME;
  private readonly envAttrDob = process.env.DHIS2_ATTR_DOB;
  private readonly envAttrGender = process.env.DHIS2_ATTR_GENDER;
  private readonly envAttrNationalId = process.env.DHIS2_ATTR_NATIONAL_ID;
  private readonly envAttrPhone = process.env.DHIS2_ATTR_PHONE;
  private readonly forceMockMode = process.env.DHIS2_USE_MOCK === 'true';
  private readonly legacyAttributeFallbacks: PatientAttributeIdMap = {
    firstName: 'w75KJ2mc4zz',
    lastName: 'zDhUuAYrxNC',
    dateOfBirth: 'FO4GPuUTfQU',
    gender: 'cejWyOfXge6',
    nationalId: 'AuPLng5hLbE',
  };
  private readonly aggregateProfileDefinitions: Record<AggregateProfileKey, AggregateProfileDefinition> = {
    service_delivery: {
      dataSetCode: 'MC_DS_SERVICE_DELIVERY_MONTHLY',
      metricCodes: {
        totalConsultations: 'MC_DE_TOTAL_CONSULTATIONS',
        completedConsultations: 'MC_DE_COMPLETED_CONSULTATIONS',
        totalAdmissions: 'MC_DE_TOTAL_ADMISSIONS',
        totalDischarges: 'MC_DE_TOTAL_DISCHARGES',
        totalEdVisits: 'MC_DE_TOTAL_ED_VISITS',
      },
    },
    maternal_newborn: {
      dataSetCode: 'MC_DS_MATERNAL_NEWBORN_MONTHLY',
      metricCodes: {
        anc1Plus: 'MC_DE_MATERNAL_ANC1_PLUS',
        anc4Plus: 'MC_DE_MATERNAL_ANC4_PLUS',
        anc8Plus: 'MC_DE_MATERNAL_ANC8_PLUS',
        totalDeliveries: 'MC_DE_MATERNAL_TOTAL_DELIVERIES',
        caesareanDeliveries: 'MC_DE_MATERNAL_CSECTION_TOTAL',
        liveBirths: 'MC_DE_MATERNAL_LIVE_BIRTHS',
        stillBirths: 'MC_DE_MATERNAL_STILLBIRTHS',
        lowBirthWeightCount: 'MC_DE_MATERNAL_LOW_BIRTH_WEIGHT_COUNT',
      },
    },
    hiv_monthly: {
      dataSetCode: 'MC_DS_HIV_MONTHLY_RETURN',
      metricCodes: {
        plhivActiveInCare: 'MC_DE_HIV_PLHIV_ACTIVE_IN_CARE',
        artCoverageCount: 'MC_DE_HIV_ART_COVERAGE_COUNT',
        viralLoadSuppressed: 'MC_DE_HIV_VL_SUPPRESSED_LT1000',
        viralLoadUndetectable: 'MC_DE_HIV_VL_UNDETECTABLE_LT50',
        lossToFollowUpCount: 'MC_DE_HIV_LOST_TO_FOLLOWUP',
        treatmentFailureCount: 'MC_DE_HIV_TREATMENT_FAILURE_GT1000',
        tbScreenedCount: 'MC_DE_HIV_TB_SCREENED',
      },
    },
    immunization_monthly: {
      dataSetCode: 'MC_DS_IMMUNIZATION_MONTHLY',
      metricCodes: {
        dtp1Administered: 'MC_DE_IMMUNIZATION_DTP1',
        dtp3Administered: 'MC_DE_IMMUNIZATION_DTP3',
        measlesDose1Administered: 'MC_DE_IMMUNIZATION_MCV1',
        fullyImmunizedProxy: 'MC_DE_IMMUNIZATION_FULLY_IMMUNIZED_PROXY',
        aefiReports: 'MC_DE_IMMUNIZATION_AEFI_REPORTS',
      },
    },
    pharmacy_stock: {
      dataSetCode: 'MC_DS_PHARMACY_STOCK_MONTHLY',
      metricCodes: {
        stockOnHandTotal: 'MC_DE_PHARMACY_STOCK_ON_HAND_TOTAL',
        stockOutItemCount: 'MC_DE_PHARMACY_STOCKOUT_ITEMS',
        dispensedUnits: 'MC_DE_PHARMACY_DISPENSED_UNITS',
        dispensingTransactions: 'MC_DE_PHARMACY_DISPENSING_TRANSACTIONS',
      },
    },
  };

  constructor(private readonly tenantService: TenantService) {
    if (this.forceMockMode) {
      this.logger.warn('DHIS2 service running in MOCK mode (DHIS2_USE_MOCK=true)');
      return;
    }

    if (this.envPat) {
      this.logger.log('DHIS2 service initialized with PAT auth support (env fallback enabled)');
      return;
    }

    if (this.envUsername && this.envPassword) {
      this.logger.log('DHIS2 service initialized with basic auth support (env fallback enabled)');
      return;
    }

    this.logger.warn(
      'DHIS2 service initialized without env credentials. Per-tenant DHIS2 config is expected; otherwise API runs in MOCK mode.',
    );
  }

  private buildTenantRuntime(config: TenantDhis2Config): Dhis2RuntimeConfig {
    return {
      baseUrl: config.baseUrl,
      apiVersion: config.apiVersion || '40',
      authType: config.authType,
      pat: config.pat || undefined,
      username: config.username || undefined,
      password: config.password || undefined,
      orgUnitId: config.orgUnitId,
      trackedEntityTypeId: config.trackedEntityTypeId || undefined,
      dataSetId: config.dataSetId || undefined,
    };
  }

  private buildEnvRuntime(): Dhis2RuntimeConfig | null {
    const hasPat = Boolean(this.envPat && this.envPat.trim().length > 0);
    const hasBasic = Boolean(this.envUsername && this.envPassword);

    if (!hasPat && !hasBasic) {
      return null;
    }

    return {
      baseUrl: this.envBaseUrl,
      apiVersion: this.envApiVersion,
      authType: hasPat ? 'pat' : 'basic',
      pat: this.envPat,
      username: this.envUsername,
      password: this.envPassword,
      orgUnitId: this.envOrgUnit,
      trackedEntityTypeId: this.envTrackedEntityType,
      dataSetId: this.envDataSetId,
    };
  }

  private createClient(runtime: Dhis2RuntimeConfig): AxiosInstance {
    const normalizedBaseUrl = runtime.baseUrl.replace(/\/$/, '');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (runtime.authType === 'pat' && runtime.pat) {
      headers.Authorization = `ApiToken ${runtime.pat}`;
    }

    const client = axios.create({
      baseURL: `${normalizedBaseUrl}/api/${runtime.apiVersion}`,
      timeout: 30000,
      headers,
      auth:
        runtime.authType === 'basic' && runtime.username && runtime.password
          ? { username: runtime.username, password: runtime.password }
          : undefined,
    });

    client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(`DHIS2 API Error: ${error.message}`, error.response?.data);
        throw error;
      },
    );

    return client;
  }

  private async resolveContext(tenantId?: string): Promise<Dhis2Context> {
    if (this.forceMockMode) {
      return { enabled: true, useMock: true, reason: 'DHIS2_USE_MOCK=true' };
    }

    let runtime: Dhis2RuntimeConfig | null = null;

    if (tenantId) {
      const tenantConfig = await this.tenantService.getTenantDhis2Config(tenantId);
      if (tenantConfig && !tenantConfig.enabled) {
        return { enabled: false, useMock: false, reason: 'Tenant DHIS2 sync is disabled.' };
      }
      if (tenantConfig) {
        runtime = this.buildTenantRuntime(tenantConfig);
      }
    }

    if (!runtime) {
      runtime = this.buildEnvRuntime();
    }

    if (!runtime) {
      return {
        enabled: true,
        useMock: true,
        reason: 'No DHIS2 PAT/basic credentials configured for tenant or env fallback.',
      };
    }

    if (runtime.authType === 'pat' && !runtime.pat) {
      return {
        enabled: false,
        useMock: false,
        reason: 'Tenant DHIS2 auth type is PAT but PAT is missing.',
      };
    }

    if (runtime.authType === 'basic' && (!runtime.username || !runtime.password)) {
      return {
        enabled: false,
        useMock: false,
        reason: 'Tenant DHIS2 auth type is basic but username/password are missing.',
      };
    }

    return {
      enabled: true,
      useMock: false,
      config: runtime,
      client: this.createClient(runtime),
    };
  }

  private isNotFoundError(error: any): boolean {
    return Number(error?.response?.status) === 404;
  }

  private isMissingRelationError(error: any): boolean {
    const pgCode = error?.code;
    const message = String(error?.message || '').toLowerCase();
    return pgCode === '42P01' || message.includes('relation') && message.includes('does not exist');
  }

  private formatDateOnly(value: unknown): string {
    if (!value) {
      return '';
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return value.length >= 10 ? value.slice(0, 10) : '';
    }

    return '';
  }

  private getConfiguredPatientAttributeFallbacks(): PatientAttributeIdMap {
    return {
      patientNumber: this.envAttrPatientNumber || undefined,
      firstName: this.envAttrFirstName || this.legacyAttributeFallbacks.firstName,
      lastName: this.envAttrLastName || this.legacyAttributeFallbacks.lastName,
      dateOfBirth: this.envAttrDob || this.legacyAttributeFallbacks.dateOfBirth,
      gender: this.envAttrGender || this.legacyAttributeFallbacks.gender,
      nationalId: this.envAttrNationalId || this.legacyAttributeFallbacks.nationalId,
      phone: this.envAttrPhone || undefined,
    };
  }

  private async resolvePatientAttributeIds(context: Dhis2Context): Promise<PatientAttributeIdMap> {
    const fallback = this.getConfiguredPatientAttributeFallbacks();
    if (!context.client) {
      return fallback;
    }

    try {
      const response = await context.client.get('/trackedEntityAttributes', {
        params: {
          fields: 'id,code,name',
          paging: false,
        },
      });

      const trackedEntityAttributes = response.data?.trackedEntityAttributes || [];
      const byCode: Record<string, string> = {};
      for (const item of trackedEntityAttributes) {
        const code = item?.code;
        const id = item?.id;
        if (code && id) {
          byCode[String(code)] = String(id);
        }
      }

      return {
        patientNumber: byCode.MC_ATTR_PATIENT_NUMBER || fallback.patientNumber,
        firstName: byCode.MC_ATTR_FIRST_NAME || fallback.firstName,
        lastName: byCode.MC_ATTR_LAST_NAME || fallback.lastName,
        dateOfBirth: byCode.MC_ATTR_DOB || fallback.dateOfBirth,
        gender: byCode.MC_ATTR_GENDER || fallback.gender,
        nationalId: byCode.MC_ATTR_NATIONAL_ID || fallback.nationalId,
        phone: byCode.MC_ATTR_PHONE || fallback.phone,
      };
    } catch (error: any) {
      this.logger.warn(
        `Unable to resolve DHIS2 patient attributes by code, using fallback IDs: ${error?.message || error}`,
      );
      return fallback;
    }
  }

  private buildPatientAttributes(patient: Patient, attributeIds: PatientAttributeIdMap) {
    const attributes: Array<{ attribute: string; value: string }> = [];

    if (attributeIds.patientNumber) {
      attributes.push({ attribute: attributeIds.patientNumber, value: patient.patientNumber || patient.id || '' });
    }
    if (attributeIds.firstName) {
      attributes.push({ attribute: attributeIds.firstName, value: patient.firstName || '' });
    }
    if (attributeIds.lastName) {
      attributes.push({ attribute: attributeIds.lastName, value: patient.lastName || '' });
    }
    if (attributeIds.dateOfBirth) {
      attributes.push({ attribute: attributeIds.dateOfBirth, value: this.formatDateOnly(patient.dateOfBirth) });
    }
    if (attributeIds.gender) {
      attributes.push({ attribute: attributeIds.gender, value: (patient.gender || '').toUpperCase() });
    }
    if (attributeIds.nationalId) {
      attributes.push({ attribute: attributeIds.nationalId, value: patient.nationalId || '' });
    }
    if (attributeIds.phone) {
      attributes.push({ attribute: attributeIds.phone, value: patient.phone || '' });
    }

    return attributes;
  }

  private extractTeiId(responseData: any): string | null {
    return (
      responseData?.response?.importSummaries?.[0]?.reference ||
      responseData?.response?.reference ||
      responseData?.reference ||
      null
    );
  }

  private extractImportReference(responseData: any): string | null {
    return (
      responseData?.response?.importSummaries?.[0]?.reference ||
      responseData?.response?.reference ||
      responseData?.response?.uid ||
      responseData?.reference ||
      responseData?.uid ||
      null
    );
  }

  private toImportCount(value: any): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private extractImportCounts(responseData: any): {
    imported: number;
    updated: number;
    ignored: number;
    deleted: number;
  } {
    const importCount = responseData?.importCount || {};
    return {
      imported: this.toImportCount(responseData?.imported ?? importCount.imported),
      updated: this.toImportCount(responseData?.updated ?? importCount.updated),
      ignored: this.toImportCount(responseData?.ignored ?? importCount.ignored),
      deleted: this.toImportCount(responseData?.deleted ?? importCount.deleted),
    };
  }

  private extractLatestOpenFuturePeriod(errorData: any): string | null {
    const conflicts = errorData?.response?.conflicts || errorData?.conflicts || [];
    if (!Array.isArray(conflicts) || conflicts.length === 0) {
      return null;
    }

    const periods = new Set<string>();
    for (const conflict of conflicts) {
      const value = String(conflict?.value || '');
      const match = value.match(/latest open future period:\s*`?(\d{6})`?/i);
      if (match?.[1]) {
        periods.add(match[1]);
      }
    }

    if (periods.size !== 1) {
      return null;
    }

    return Array.from(periods)[0];
  }

  private isUuid(value?: string | null): boolean {
    if (!value) {
      return false;
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private asNullableUuid(value?: string | null): string | null {
    return this.isUuid(value) ? String(value) : null;
  }

  private canQueryTenantDb(tenantDb?: DataSource): tenantDb is DataSource {
    return Boolean(tenantDb && typeof (tenantDb as any).query === 'function');
  }

  private async ensureTenantSyncTables(tenantDb: DataSource): Promise<void> {
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS dhis2_patient_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL UNIQUE,
        dhis2_tei_id VARCHAR(64) NOT NULL,
        org_unit_id VARCHAR(64),
        tenant_identifier VARCHAR(128),
        last_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS dhis2_sync_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        dhis2_id VARCHAR(64),
        action VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        payload JSONB DEFAULT '{}'::jsonb,
        synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await tenantDb.query(`
      ALTER TABLE dhis2_sync_log
      DROP CONSTRAINT IF EXISTS dhis2_sync_log_action_check
    `);
    await tenantDb.query(`
      ALTER TABLE dhis2_sync_log
      ADD CONSTRAINT dhis2_sync_log_action_check
      CHECK (action IN ('create','update','upsert','skip','error','run_now'))
    `);
  }

  private async loadPatientMappings(tenantDb: DataSource): Promise<Map<string, string>> {
    const rows: Dhis2PatientMappingRow[] = await tenantDb.query(
      `SELECT patient_id, dhis2_tei_id FROM dhis2_patient_mappings`,
    );
    return new Map(rows.map((row) => [row.patient_id, row.dhis2_tei_id]));
  }

  private async loadPatientTeiMapping(tenantDb: DataSource, patientId: string): Promise<string | null> {
    const rows: Array<{ dhis2_tei_id: string }> = await tenantDb.query(
      `
      SELECT dhis2_tei_id
      FROM dhis2_patient_mappings
      WHERE patient_id = $1
      LIMIT 1
      `,
      [patientId],
    );
    if (!rows || rows.length === 0) {
      return null;
    }
    return rows[0].dhis2_tei_id || null;
  }

  private async resolveDataSetIdByCode(context: Dhis2Context, dataSetCode: string): Promise<string | null> {
    if (!context.client || !dataSetCode) {
      return null;
    }

    try {
      const response = await context.client.get('/dataSets', {
        params: {
          fields: 'id,code',
          paging: false,
          filter: `code:eq:${dataSetCode}`,
        },
      });

      const dataSets = response.data?.dataSets || [];
      if (!Array.isArray(dataSets) || dataSets.length === 0) {
        return null;
      }
      return dataSets[0]?.id || null;
    } catch (error: any) {
      this.logger.warn(`Unable to resolve dataset by code ${dataSetCode}: ${error?.message || error}`);
      return null;
    }
  }

  private async resolveAggregateElementIdsByCode(
    context: Dhis2Context,
    dataSetId: string | undefined,
    metricCodes: Record<string, string>,
  ): Promise<Record<string, string>> {
    if (!context.client || !dataSetId) {
      return {};
    }

    try {
      const response = await context.client.get(`/dataSets/${dataSetId}`, {
        params: {
          fields: 'dataSetElements[dataElement[id,code,name]]',
        },
      });

      const byCode: Record<string, string> = {};
      const dataSetElements = response.data?.dataSetElements || [];
      for (const item of dataSetElements) {
        const code = item?.dataElement?.code;
        const id = item?.dataElement?.id;
        if (code && id) {
          byCode[String(code)] = String(id);
        }
      }

      const resolved: Record<string, string> = {};
      for (const [metricKey, metricCode] of Object.entries(metricCodes)) {
        if (byCode[metricCode]) {
          resolved[metricKey] = byCode[metricCode];
        }
      }
      return resolved;
    } catch (error: any) {
      this.logger.warn(
        `Unable to resolve dataset data elements from DHIS2 (${dataSetId}): ${error?.message || error}`,
      );
      return {};
    }
  }

  private getAggregateProfile(profile?: string): {
    key: AggregateProfileKey;
    definition: AggregateProfileDefinition;
  } | null {
    const normalized = String(profile || 'service_delivery').trim().toLowerCase() as AggregateProfileKey;
    const definition = this.aggregateProfileDefinitions[normalized];
    if (!definition) {
      return null;
    }
    return {
      key: normalized,
      definition,
    };
  }

  private resolveMonthlyPeriodBounds(period: string): { startDate: string; endDate: string } {
    const normalized = String(period || '').trim();
    if (!/^\d{6}$/.test(normalized)) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    }

    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  private async safeMetricCount(
    tenantDb: DataSource,
    label: string,
    sql: string,
    params: any[] = [],
  ): Promise<number> {
    try {
      const rows: Array<{ total: number | string }> = await tenantDb.query(sql, params);
      return Number(rows?.[0]?.total || 0);
    } catch (error: any) {
      if (this.isMissingRelationError(error)) {
        this.logger.warn(`DHIS2 aggregate source for ${label} is missing; defaulting to 0.`);
        return 0;
      }
      throw error;
    }
  }

  private async safeMetricSum(
    tenantDb: DataSource,
    label: string,
    sql: string,
    params: any[] = [],
  ): Promise<number> {
    try {
      const rows: Array<{ total: number | string }> = await tenantDb.query(sql, params);
      return Number(rows?.[0]?.total || 0);
    } catch (error: any) {
      if (this.isMissingRelationError(error)) {
        this.logger.warn(`DHIS2 aggregate source for ${label} is missing; defaulting to 0.`);
        return 0;
      }
      throw error;
    }
  }

  private async computeAggregateMetrics(
    profile: AggregateProfileKey,
    tenantDb: DataSource,
    period: string,
  ): Promise<Record<string, number>> {
    const { startDate, endDate } = this.resolveMonthlyPeriodBounds(period);

    if (profile === 'service_delivery') {
      const [totalConsultations, completedConsultations, totalAdmissions, totalDischarges, totalEdVisits] =
        await Promise.all([
          this.safeMetricCount(
            tenantDb,
            'appointments_total',
            `SELECT COUNT(*)::int AS total FROM appointments`,
          ),
          this.safeMetricCount(
            tenantDb,
            'appointments_completed',
            `SELECT COUNT(*)::int AS total FROM appointments WHERE LOWER(COALESCE(status, '')) = 'completed'`,
          ),
          this.safeMetricCount(
            tenantDb,
            'admissions_total',
            `SELECT COUNT(*)::int AS total FROM admissions`,
          ),
          this.safeMetricCount(
            tenantDb,
            'discharges_total',
            `SELECT COUNT(*)::int AS total FROM discharges`,
          ),
          this.safeMetricCount(
            tenantDb,
            'ed_visits_total',
            `SELECT COUNT(*)::int AS total FROM ed_visits`,
          ),
        ]);

      return {
        totalConsultations,
        completedConsultations,
        totalAdmissions,
        totalDischarges,
        totalEdVisits,
      };
    }

    if (profile === 'maternal_newborn') {
      const [
        anc1Plus,
        anc4Plus,
        anc8Plus,
        totalDeliveries,
        caesareanDeliveries,
        liveBirths,
        stillBirths,
        lowBirthWeightCount,
      ] = await Promise.all([
        this.safeMetricCount(
          tenantDb,
          'anc_1_plus',
          `
          SELECT COUNT(DISTINCT maternity_enrollment_id)::int AS total
          FROM anc_visits
          WHERE visit_date >= $1 AND visit_date < $2
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'anc_4_plus',
          `
          SELECT COUNT(*)::int AS total
          FROM (
            SELECT maternity_enrollment_id
            FROM anc_visits
            WHERE visit_date >= $1 AND visit_date < $2
            GROUP BY maternity_enrollment_id
            HAVING COUNT(*) >= 4
          ) coverage
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'anc_8_plus',
          `
          SELECT COUNT(*)::int AS total
          FROM (
            SELECT maternity_enrollment_id
            FROM anc_visits
            WHERE visit_date >= $1 AND visit_date < $2
            GROUP BY maternity_enrollment_id
            HAVING COUNT(*) >= 8
          ) coverage
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'deliveries_total',
          `
          SELECT COUNT(*)::int AS total
          FROM deliveries
          WHERE delivery_date >= $1 AND delivery_date < $2
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'deliveries_c_section',
          `
          SELECT COUNT(*)::int AS total
          FROM deliveries
          WHERE delivery_date >= $1
            AND delivery_date < $2
            AND (
              LOWER(COALESCE(delivery_type, '')) LIKE '%c%section%'
              OR LOWER(COALESCE(delivery_method, '')) LIKE '%caesar%'
            )
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'births_live',
          `
          SELECT COUNT(*)::int AS total
          FROM birth_outcomes bo
          JOIN deliveries d ON d.id = bo.delivery_id
          WHERE d.delivery_date >= $1
            AND d.delivery_date < $2
            AND (
              LOWER(COALESCE(bo.newborn_outcome, '')) LIKE '%live%'
              OR LOWER(COALESCE(bo.birth_outcome, '')) LIKE '%live%'
            )
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'births_still',
          `
          SELECT COUNT(*)::int AS total
          FROM birth_outcomes bo
          JOIN deliveries d ON d.id = bo.delivery_id
          WHERE d.delivery_date >= $1
            AND d.delivery_date < $2
            AND (
              LOWER(COALESCE(bo.newborn_outcome, '')) LIKE '%still%'
              OR LOWER(COALESCE(bo.birth_outcome, '')) LIKE '%still%'
            )
          `,
          [startDate, endDate],
        ),
        this.safeMetricCount(
          tenantDb,
          'births_low_weight',
          `
          SELECT COUNT(*)::int AS total
          FROM birth_outcomes bo
          JOIN deliveries d ON d.id = bo.delivery_id
          WHERE d.delivery_date >= $1
            AND d.delivery_date < $2
            AND bo.birth_weight IS NOT NULL
            AND bo.birth_weight > 0
            AND bo.birth_weight < 2500
          `,
          [startDate, endDate],
        ),
      ]);

      return {
        anc1Plus,
        anc4Plus,
        anc8Plus,
        totalDeliveries,
        caesareanDeliveries,
        liveBirths,
        stillBirths,
        lowBirthWeightCount,
      };
    }

    if (profile === 'hiv_monthly') {
      const [plhivActiveInCare, artCoverageCount, viralLoadSuppressed, viralLoadUndetectable, lossToFollowUpCount, treatmentFailureCount, tbScreenedCount] =
        await Promise.all([
          this.safeMetricCount(
            tenantDb,
            'hiv_active_in_care',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_care_enrollments
            WHERE LOWER(COALESCE(enrollment_status, '')) IN ('active', 'in_care', 'incare', 'on_art')
            `,
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_on_art',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_care_enrollments
            WHERE art_start_date IS NOT NULL
              AND LOWER(COALESCE(enrollment_status, '')) IN ('active', 'in_care', 'incare', 'on_art')
            `,
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_vl_suppressed',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND viral_load IS NOT NULL
              AND viral_load > 0
              AND viral_load < 1000
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_vl_undetectable',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND viral_load IS NOT NULL
              AND viral_load > 0
              AND viral_load < 50
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_ltfu',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_care_enrollments
            WHERE LOWER(COALESCE(enrollment_status, '')) LIKE '%lost%'
            `,
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_treatment_failure',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND viral_load IS NOT NULL
              AND viral_load > 1000
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'hiv_tb_screened',
            `
            SELECT COUNT(*)::int AS total
            FROM hiv_clinical_visits
            WHERE visit_date >= $1
              AND visit_date < $2
              AND (
                tb_screening IS NOT NULL
                OR tb_screened_legacy IS NOT NULL
              )
            `,
            [startDate, endDate],
          ),
        ]);

      return {
        plhivActiveInCare,
        artCoverageCount,
        viralLoadSuppressed,
        viralLoadUndetectable,
        lossToFollowUpCount,
        treatmentFailureCount,
        tbScreenedCount,
      };
    }

    if (profile === 'immunization_monthly') {
      const [dtp1Administered, dtp3Administered, measlesDose1Administered, fullyImmunizedProxy, aefiReports] =
        await Promise.all([
          this.safeMetricCount(
            tenantDb,
            'immunization_dtp1',
            `
            SELECT COUNT(*)::int AS total
            FROM immunizations
            WHERE administration_date >= $1
              AND administration_date < $2
              AND (
                LOWER(COALESCE(vaccine_code, '') || ' ' || COALESCE(vaccine_name, '') || ' ' || COALESCE(cvx_code, '')) LIKE '%dtp1%'
                OR (LOWER(COALESCE(vaccine_name, '')) LIKE '%pentavalent%' AND dose_number = 1)
              )
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_dtp3',
            `
            SELECT COUNT(*)::int AS total
            FROM immunizations
            WHERE administration_date >= $1
              AND administration_date < $2
              AND (
                LOWER(COALESCE(vaccine_code, '') || ' ' || COALESCE(vaccine_name, '') || ' ' || COALESCE(cvx_code, '')) LIKE '%dtp3%'
                OR (LOWER(COALESCE(vaccine_name, '')) LIKE '%pentavalent%' AND dose_number = 3)
              )
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_mcv1',
            `
            SELECT COUNT(*)::int AS total
            FROM immunizations
            WHERE administration_date >= $1
              AND administration_date < $2
              AND LOWER(COALESCE(vaccine_name, '') || ' ' || COALESCE(vaccine_code, '')) LIKE '%measles%'
              AND COALESCE(dose_number, 1) = 1
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_fully_proxy',
            `
            SELECT COUNT(*)::int AS total
            FROM (
              SELECT patient_id
              FROM immunizations
              WHERE administration_date >= $1
                AND administration_date < $2
              GROUP BY patient_id
              HAVING COUNT(*) >= 3
            ) coverage
            `,
            [startDate, endDate],
          ),
          this.safeMetricCount(
            tenantDb,
            'immunization_aefi',
            `
            SELECT COUNT(*)::int AS total
            FROM vaccine_adverse_events
            WHERE event_date >= $1
              AND event_date < $2
            `,
            [startDate, endDate],
          ),
        ]);

      return {
        dtp1Administered,
        dtp3Administered,
        measlesDose1Administered,
        fullyImmunizedProxy,
        aefiReports,
      };
    }

    const [stockOnHandTotal, stockOutItemCount, dispensedUnits, dispensingTransactions] = await Promise.all([
      this.safeMetricSum(
        tenantDb,
        'pharmacy_stock_on_hand',
        `SELECT COALESCE(SUM(quantity_on_hand), 0)::numeric AS total FROM pharmacy_inventory`,
      ),
      this.safeMetricCount(
        tenantDb,
        'pharmacy_stockout_items',
        `SELECT COUNT(*)::int AS total FROM pharmacy_inventory WHERE COALESCE(quantity_on_hand, 0) <= 0`,
      ),
      this.safeMetricSum(
        tenantDb,
        'pharmacy_dispensed_units',
        `
        SELECT COALESCE(SUM(pi.quantity_dispensed), 0)::numeric AS total
        FROM pharmacy_dispensing_items pi
        JOIN pharmacy_dispensings pd ON pd.id = pi.dispensing_id
        WHERE pd.dispensing_date >= $1
          AND pd.dispensing_date < $2
        `,
        [startDate, endDate],
      ),
      this.safeMetricCount(
        tenantDb,
        'pharmacy_dispensing_transactions',
        `
        SELECT COUNT(*)::int AS total
        FROM pharmacy_dispensings
        WHERE dispensing_date >= $1
          AND dispensing_date < $2
        `,
        [startDate, endDate],
      ),
    ]);

    return {
      stockOnHandTotal,
      stockOutItemCount,
      dispensedUnits,
      dispensingTransactions,
    };
  }

  private async getProgramType(context: Dhis2Context, programId: string): Promise<string | null> {
    if (!context.client) {
      return null;
    }

    try {
      const response = await context.client.get(`/programs/${programId}`, {
        params: {
          fields: 'id,programType',
        },
      });
      return response.data?.programType || null;
    } catch (error: any) {
      this.logger.warn(`Unable to resolve DHIS2 program type for ${programId}: ${error?.message || error}`);
      return null;
    }
  }

  private async getExistingEnrollment(
    context: Dhis2Context,
    programId: string,
    teiId: string,
  ): Promise<string | null> {
    if (!context.client) {
      return null;
    }

    try {
      const response = await context.client.get('/enrollments', {
        params: {
          program: programId,
          trackedEntityInstance: teiId,
          paging: false,
          fields: 'enrollments[enrollment,status]',
        },
      });
      const enrollments: Dhis2EnrollmentRow[] = response.data?.enrollments || [];
      if (!Array.isArray(enrollments) || enrollments.length === 0) {
        return null;
      }
      return enrollments[0]?.enrollment || null;
    } catch (error: any) {
      this.logger.warn(
        `Unable to lookup DHIS2 enrollment for program ${programId} and TEI ${teiId}: ${error?.message || error}`,
      );
      return null;
    }
  }

  private async ensureEnrollmentForEvent(
    context: Dhis2Context,
    args: {
      programId: string;
      teiId: string;
      orgUnit: string;
      eventDate?: string;
    },
  ): Promise<string | null> {
    const programType = await this.getProgramType(context, args.programId);
    if (!programType || programType !== 'WITH_REGISTRATION') {
      return null;
    }

    const existingEnrollment = await this.getExistingEnrollment(context, args.programId, args.teiId);
    if (existingEnrollment) {
      return existingEnrollment;
    }

    if (!context.client) {
      return null;
    }

    const dateOnly = this.formatDateOnly(args.eventDate || new Date().toISOString());
    const payload = {
      trackedEntityInstance: args.teiId,
      program: args.programId,
      orgUnit: args.orgUnit,
      enrollmentDate: dateOnly,
      incidentDate: dateOnly,
      status: 'ACTIVE',
    };

    const response = await context.client.post('/enrollments', payload);
    return this.extractImportReference(response.data);
  }

  private async upsertPatientMapping(
    tenantDb: DataSource,
    patientId: string,
    teiId: string,
    orgUnitId?: string,
    tenantId?: string,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO dhis2_patient_mappings (
        patient_id,
        dhis2_tei_id,
        org_unit_id,
        tenant_identifier,
        last_synced_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (patient_id)
      DO UPDATE SET
        dhis2_tei_id = EXCLUDED.dhis2_tei_id,
        org_unit_id = EXCLUDED.org_unit_id,
        tenant_identifier = EXCLUDED.tenant_identifier,
        last_synced_at = NOW(),
        updated_at = NOW()
      `,
      [patientId, teiId, orgUnitId || null, tenantId || null],
    );
  }

  private async insertSyncLog(
    tenantDb: DataSource,
    args: {
      entityType: string;
      entityId?: string | null;
      dhis2Id?: string | null;
      action: 'create' | 'update' | 'upsert' | 'skip' | 'error';
      status: 'success' | 'error' | 'skipped';
      errorMessage?: string | null;
      payload?: Record<string, any>;
    },
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO dhis2_sync_log (
        entity_type,
        entity_id,
        dhis2_id,
        action,
        status,
        error_message,
        payload,
        synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      `,
      [
        args.entityType,
        args.entityId || null,
        args.dhis2Id || null,
        args.action,
        args.status,
        args.errorMessage || null,
        JSON.stringify(args.payload || {}),
      ],
    );
  }

  async getSyncLog(
    tenantDb: DataSource,
    filters?: {
      entityType?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    await this.ensureTenantSyncTables(tenantDb);

    const limit = Math.min(Math.max(Number(filters?.limit || 50), 1), 500);
    const offset = Math.max(Number(filters?.offset || 0), 0);

    const params: any[] = [];
    const whereClauses: string[] = [];

    if (filters?.entityType) {
      params.push(filters.entityType);
      whereClauses.push(`entity_type = $${params.length}`);
    }

    if (filters?.status) {
      params.push(filters.status);
      whereClauses.push(`status = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows: Array<{ total: number | string }> = await tenantDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM dhis2_sync_log
      ${whereSql}
      `,
      params,
    );

    const pagedRows: Dhis2SyncLogRow[] = await tenantDb.query(
      `
      SELECT
        id,
        entity_type,
        entity_id,
        dhis2_id,
        action,
        status,
        error_message,
        payload,
        synced_at
      FROM dhis2_sync_log
      ${whereSql}
      ORDER BY synced_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    const summaryRows: Array<{ entity_type: string; status: string; count: number | string }> = await tenantDb.query(
      `
      SELECT entity_type, status, COUNT(*)::int AS count
      FROM dhis2_sync_log
      GROUP BY entity_type, status
      ORDER BY entity_type, status
      `,
    );

    return {
      total: Number(countRows?.[0]?.total || 0),
      limit,
      offset,
      logs: pagedRows,
      summary: summaryRows.map((row) => ({
        entityType: row.entity_type,
        status: row.status,
        count: Number(row.count || 0),
      })),
    };
  }

  async retryFailedSync(
    tenantDb: DataSource,
    tenantId: string | undefined,
    options?: {
      entityType?: string;
      limit?: number;
      dryRun?: boolean;
    },
  ) {
    await this.ensureTenantSyncTables(tenantDb);

    const limit = Math.min(Math.max(Number(options?.limit || 25), 1), 200);
    const dryRun = Boolean(options?.dryRun);
    const params: any[] = ['error'];
    const whereClauses: string[] = [`status = $1`];

    if (options?.entityType) {
      params.push(options.entityType);
      whereClauses.push(`entity_type = $${params.length}`);
    }

    const rows: Dhis2SyncLogRow[] = await tenantDb.query(
      `
      SELECT
        id,
        entity_type,
        entity_id,
        action,
        status,
        error_message,
        payload,
        synced_at
      FROM dhis2_sync_log
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY synced_at DESC
      LIMIT $${params.length + 1}
      `,
      [...params, limit],
    );

    const retryCandidates = rows.reverse();
    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let patientSyncTriggered = false;
    const results: Array<{ logId: string; entityType: string; status: string; message: string }> = [];

    for (const row of retryCandidates) {
      const payload = (row.payload || {}) as Record<string, any>;
      const requestPayload = payload.request;
      const entityType = row.entity_type;
      const retryDecision = this.getRetryDecision(row);

      if (entityType !== 'patient' && !retryDecision.retryable) {
        await this.markSyncLogSkipped(tenantDb, row.id, retryDecision.reason);
        skipped += 1;
        results.push({
          logId: row.id,
          entityType,
          status: 'skipped',
          message: retryDecision.reason,
        });
        continue;
      }

      if (entityType === 'patient') {
        if (patientSyncTriggered) {
          await this.markSyncLogSkipped(tenantDb, row.id, 'Patient retry already triggered once in this batch.');
          skipped += 1;
          results.push({
            logId: row.id,
            entityType,
            status: 'skipped',
            message: 'Patient retry already triggered once in this batch.',
          });
          continue;
        }

        attempted += 1;
        patientSyncTriggered = true;

        if (dryRun) {
          succeeded += 1;
          results.push({
            logId: row.id,
            entityType,
            status: 'dry_run',
            message: 'Would run patient sync retry.',
          });
          continue;
        }

        const retryResult = await this.syncPatients(tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS' || retryResult.status === 'PARTIAL_SUCCESS';
        if (ok) {
          await this.markSyncLogSkipped(tenantDb, row.id, 'Superseded by bulk patient sync retry.');
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Patient retry completed.',
        });
        continue;
      }

      if (!requestPayload || typeof requestPayload !== 'object') {
        await this.markSyncLogSkipped(tenantDb, row.id, 'No request payload found in sync log; cannot replay automatically.');
        skipped += 1;
        results.push({
          logId: row.id,
          entityType,
          status: 'skipped',
          message: 'No request payload found in sync log; cannot replay automatically.',
        });
        continue;
      }

      attempted += 1;

      if (dryRun) {
        succeeded += 1;
        results.push({
          logId: row.id,
          entityType,
          status: 'dry_run',
          message: 'Would retry this payload.',
        });
        continue;
      }

      if (entityType === 'event') {
        const retryResult = await this.sendEvent(requestPayload, tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS';
        if (ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Event retry completed.',
        });
        continue;
      }

      if (entityType === 'aggregate') {
        const retryResult = await this.sendAggregateReport(requestPayload, tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS' || retryResult.status === 'OK';
        if (ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Aggregate retry completed.',
        });
        continue;
      }

      if (entityType === 'data_value_set') {
        const retryResult = await this.sendDataValues(requestPayload, tenantDb, tenantId);
        const ok = retryResult.status === 'SUCCESS' || retryResult.status === 'OK';
        if (ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          logId: row.id,
          entityType,
          status: ok ? 'success' : 'error',
          message: retryResult.message || 'Data value retry completed.',
        });
        continue;
      }

      skipped += 1;
      await this.markSyncLogSkipped(tenantDb, row.id, `Entity type ${entityType} does not support automatic retry yet.`);
      results.push({
        logId: row.id,
        entityType,
        status: 'skipped',
        message: `Entity type ${entityType} does not support automatic retry yet.`,
      });
    }

    return {
      dryRun,
      requestedLimit: limit,
      found: retryCandidates.length,
      attempted,
      succeeded,
      failed,
      skipped,
      results,
    };
  }

  private getRetryDecision(row: Dhis2SyncLogRow): { retryable: boolean; reason: string } {
    const payload = (row.payload || {}) as Record<string, any>;
    const rawStatusCode =
      payload?.response?.httpStatusCode ??
      payload?.response?.statusCode ??
      payload?.httpStatusCode;
    const statusCode = Number(rawStatusCode);

    if (
      Number.isFinite(statusCode) &&
      statusCode >= 400 &&
      statusCode < 500 &&
      statusCode !== 408 &&
      statusCode !== 429
    ) {
      return {
        retryable: false,
        reason: `Non-retryable DHIS2 client error (${statusCode}).`,
      };
    }

    const importDescription = String(
      payload?.response?.response?.importSummaries?.[0]?.description || '',
    ).toLowerCase();
    if (importDescription.includes('does not point to a valid')) {
      return {
        retryable: false,
        reason: 'Non-retryable DHIS2 validation failure in import summary.',
      };
    }

    return {
      retryable: true,
      reason: 'Retryable.',
    };
  }

  private async markSyncLogSkipped(tenantDb: DataSource, logId: string, reason: string): Promise<void> {
    await tenantDb.query(
      `
      UPDATE dhis2_sync_log
      SET
        status = 'skipped',
        action = 'skip',
        error_message = $2,
        synced_at = NOW()
      WHERE id = $1
      `,
      [logId, reason],
    );
  }

  async getRecentErrorCount(tenantDb: DataSource, lookbackHours = 24): Promise<number> {
    await this.ensureTenantSyncTables(tenantDb);
    const normalizedHours = Math.min(Math.max(Number(lookbackHours || 24), 1), 720);
    const rows: Array<{ total: number | string }> = await tenantDb.query(
      `
      SELECT COUNT(*)::int AS total
      FROM dhis2_sync_log
      WHERE status = 'error'
        AND synced_at >= NOW() - ($1 * INTERVAL '1 hour')
      `,
      [normalizedHours],
    );
    return Number(rows?.[0]?.total || 0);
  }

  async syncPatients(tenantDb: DataSource, tenantId?: string) {
    try {
      const patientRepository = tenantDb.getRepository(Patient);
      const patients = await patientRepository.find({ where: { isActive: true } });
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          imported: 0,
          updated: 0,
          ignored: 0,
          deleted: 0,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client || !context.config) {
        this.logger.warn(`DHIS2 sync running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          imported: patients.length,
          updated: 0,
          ignored: 0,
          deleted: 0,
          message: `[MOCK] Successfully synced ${patients.length} patients to DHIS2`,
        };
      }

      const trackedEntityType =
        context.config.trackedEntityTypeId || this.envTrackedEntityType || 'MCPQUTHX1Ze';
      const orgUnit = context.config.orgUnitId || this.envOrgUnit || 'YOUR_ORG_UNIT_ID';
      const patientAttributeIds = await this.resolvePatientAttributeIds(context);
      await this.ensureTenantSyncTables(tenantDb);
      const existingMappings = await this.loadPatientMappings(tenantDb);

      let created = 0;
      let updated = 0;
      let failed = 0;
      let skipped = 0;

      for (const patient of patients) {
        const existingTeiId = existingMappings.get(patient.id);
        const payload = {
          trackedEntityType,
          orgUnit,
          attributes: this.buildPatientAttributes(patient, patientAttributeIds),
        };

        try {
          if (existingTeiId) {
            try {
              await context.client.put(`/trackedEntityInstances/${existingTeiId}`, payload);
              updated += 1;
              await this.upsertPatientMapping(tenantDb, patient.id, existingTeiId, orgUnit, tenantId);
              await this.insertSyncLog(tenantDb, {
                entityType: 'patient',
                entityId: patient.id,
                dhis2Id: existingTeiId,
                action: 'update',
                status: 'success',
                payload: { patientId: patient.id, orgUnit },
              });
              continue;
            } catch (updateError: any) {
              if (!this.isNotFoundError(updateError)) {
                throw updateError;
              }
              this.logger.warn(
                `Mapped TEI not found in DHIS2 for patient ${patient.id}; re-creating record.`,
              );
            }
          }

          const createResponse = await context.client.post('/trackedEntityInstances', {
            trackedEntityInstances: [payload],
          });
          const createdTeiId = this.extractTeiId(createResponse.data);
          if (!createdTeiId) {
            skipped += 1;
            await this.insertSyncLog(tenantDb, {
              entityType: 'patient',
              entityId: patient.id,
              dhis2Id: null,
              action: 'skip',
              status: 'skipped',
              errorMessage: 'TEI ID not returned by DHIS2 create response',
              payload: { patientId: patient.id, orgUnit, response: createResponse.data || null },
            });
            continue;
          }

          await this.upsertPatientMapping(tenantDb, patient.id, createdTeiId, orgUnit, tenantId);
          created += 1;
          await this.insertSyncLog(tenantDb, {
            entityType: 'patient',
            entityId: patient.id,
            dhis2Id: createdTeiId,
            action: 'create',
            status: 'success',
            payload: { patientId: patient.id, orgUnit },
          });
        } catch (patientError: any) {
          failed += 1;
          await this.insertSyncLog(tenantDb, {
            entityType: 'patient',
            entityId: patient.id,
            dhis2Id: existingTeiId || null,
            action: 'error',
            status: 'error',
            errorMessage: patientError?.message || 'Patient sync failed',
            payload: {
              patientId: patient.id,
              orgUnit,
              response: patientError?.response?.data || null,
            },
          });
        }
      }

      return {
        status: failed > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
        imported: created,
        updated,
        ignored: skipped,
        deleted: 0,
        failed,
        message: `Patient sync complete. Created ${created}, updated ${updated}, skipped ${skipped}, failed ${failed}.`,
      };
    } catch (error: any) {
      this.logger.error('Error syncing patients to DHIS2:', error);
      return {
        status: 'ERROR',
        imported: 0,
        updated: 0,
        ignored: 0,
        deleted: 0,
        message: `DHIS2 sync failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async sendEvent(eventData: any, tenantDb: DataSource, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          reference: `EVENT_${Date.now()}`,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client || !context.config) {
        this.logger.warn(`DHIS2 sendEvent running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          reference: `EVENT_${Date.now()}`,
          message: '[MOCK] Event sent to DHIS2 successfully',
        };
      }

      let trackedEntityInstance: string | undefined =
        eventData.trackedEntityInstance || eventData.teiId || undefined;

      if (!trackedEntityInstance && eventData.patientId && this.canQueryTenantDb(tenantDb)) {
        await this.ensureTenantSyncTables(tenantDb);
        trackedEntityInstance = await this.loadPatientTeiMapping(tenantDb, eventData.patientId);
      }

      if (!trackedEntityInstance && eventData.patientId) {
        if (this.canQueryTenantDb(tenantDb)) {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'event',
            entityId: this.asNullableUuid(eventData.patientId),
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: `Missing TEI mapping for patient ${eventData.patientId}`,
            payload: {
              program: eventData.program || null,
              programStage: eventData.programStage || null,
              patientId: eventData.patientId,
              request: eventData || null,
            },
          });
        }
        return {
          status: 'ERROR',
          reference: `EVENT_${Date.now()}`,
          message: `No DHIS2 TEI mapping found for patient ${eventData.patientId}. Run patient sync first.`,
        };
      }

      const dhis2Event = {
        program: eventData.program,
        programStage: eventData.programStage,
        orgUnit: eventData.orgUnit || context.config.orgUnitId || this.envOrgUnit,
        eventDate: eventData.eventDate,
        status: 'COMPLETED',
        trackedEntityInstance,
        dataValues: eventData.dataValues || [],
      };

      const enrollmentId =
        eventData.enrollment ||
        await this.ensureEnrollmentForEvent(context, {
          programId: String(eventData.program),
          teiId: String(trackedEntityInstance),
          orgUnit: String(dhis2Event.orgUnit || ''),
          eventDate: eventData.eventDate,
        });

      if (enrollmentId) {
        (dhis2Event as any).enrollment = enrollmentId;
      }

      const response = await context.client.post('/events', dhis2Event);
      const reference = this.extractImportReference(response.data) || `EVENT_${Date.now()}`;

      if (this.canQueryTenantDb(tenantDb)) {
        await this.ensureTenantSyncTables(tenantDb);
        await this.insertSyncLog(tenantDb, {
          entityType: 'event',
          entityId: this.asNullableUuid(eventData.patientId),
          dhis2Id: reference,
          action: 'create',
          status: 'success',
          payload: {
            program: eventData.program,
            programStage: eventData.programStage || null,
            orgUnit: dhis2Event.orgUnit,
            trackedEntityInstance,
            enrollmentId: enrollmentId || null,
            dataValuesCount: Array.isArray(eventData.dataValues) ? eventData.dataValues.length : 0,
          },
        });
      }

      return {
        status: 'SUCCESS',
        reference,
        message: 'Event sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending event to DHIS2:', error);
      if (this.canQueryTenantDb(tenantDb)) {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'event',
            entityId: this.asNullableUuid(eventData?.patientId),
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: error?.message || 'DHIS2 event send failed',
            payload: {
              program: eventData?.program || null,
              programStage: eventData?.programStage || null,
              request: eventData || null,
              response: error?.response?.data || null,
            },
          });
        } catch (logError: any) {
          this.logger.warn(`Failed to write DHIS2 event sync log: ${logError?.message || logError}`);
        }
      }
      return {
        status: 'ERROR',
        reference: `EVENT_${Date.now()}`,
        message: `DHIS2 event send failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async sendDataValues(dataValues: any, tenantDb: DataSource, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          imported: 0,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client || !context.config) {
        this.logger.warn(`DHIS2 sendDataValues running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          imported: dataValues.values?.length || 0,
          message: '[MOCK] Data values sent to DHIS2 successfully',
        };
      }

      const dhis2DataValues = {
        dataSet: dataValues.dataSet || context.config.dataSetId || this.envDataSetId,
        completeDate: new Date().toISOString(),
        period: dataValues.period,
        orgUnit: dataValues.orgUnit || context.config.orgUnitId || this.envOrgUnit,
        dataValues: (dataValues.values || []).map((item: any) => ({
          ...item,
          orgUnit: item?.orgUnit || dataValues.orgUnit || context.config.orgUnitId || this.envOrgUnit,
          period: item?.period || dataValues.period,
        })),
      };

      const response = await context.client.post('/dataValueSets', dhis2DataValues);
      const importCounts = this.extractImportCounts(response.data);

      if (this.canQueryTenantDb(tenantDb)) {
        await this.ensureTenantSyncTables(tenantDb);
        await this.insertSyncLog(tenantDb, {
          entityType: 'data_value_set',
          entityId: null,
          dhis2Id: null,
          action: 'upsert',
          status: 'success',
          payload: {
            dataSet: dhis2DataValues.dataSet,
            period: dhis2DataValues.period,
            orgUnit: dhis2DataValues.orgUnit,
            dataValuesCount: Array.isArray(dhis2DataValues.dataValues) ? dhis2DataValues.dataValues.length : 0,
            ...importCounts,
          },
        });
      }

      return {
        status: response.data.status || 'SUCCESS',
        imported: importCounts.imported,
        updated: importCounts.updated,
        ignored: importCounts.ignored,
        deleted: importCounts.deleted,
        message: 'Data values sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending data values to DHIS2:', error);
      if (this.canQueryTenantDb(tenantDb)) {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'data_value_set',
            entityId: null,
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: error?.message || 'DHIS2 data values send failed',
            payload: {
              dataSet: dataValues?.dataSet || null,
              period: dataValues?.period || null,
              orgUnit: dataValues?.orgUnit || null,
              request: dataValues || null,
              response: error?.response?.data || null,
            },
          });
        } catch (logError: any) {
          this.logger.warn(`Failed to write DHIS2 data-value sync log: ${logError?.message || logError}`);
        }
      }
      return {
        status: 'ERROR',
        imported: 0,
        message: `DHIS2 data values send failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async getPrograms(tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          programs: [],
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client) {
        this.logger.warn(`DHIS2 getPrograms running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          programs: [
            { id: 'IpHINAT79UW', name: 'Child Programme', description: 'Child health and immunization program' },
            { id: 'WSGAb5XwJ3Y', name: 'Malaria case management', description: 'Malaria diagnosis and treatment program' },
            { id: 'M3xtLkYBlKI', name: 'TB care and treatment', description: 'Tuberculosis care and treatment program' },
            { id: 'uy2gU8kT1jF', name: 'HIV Care and Treatment', description: 'HIV/AIDS care and treatment program' },
          ],
        };
      }

      const response = await context.client.get('/programs', {
        params: {
          fields: 'id,name,description',
          paging: false,
        },
      });

      return { programs: response.data.programs || [] };
    } catch (error: any) {
      this.logger.error('Error fetching DHIS2 programs:', error);
      return {
        programs: [
          { id: 'uy2gU8kT1jF', name: 'HIV Care and Treatment', description: 'HIV/AIDS care and treatment program' },
          { id: 'M3xtLkYBlKI', name: 'TB care and treatment', description: 'Tuberculosis care and treatment program' },
        ],
        error: 'Failed to fetch from DHIS2, using default programs',
      };
    }
  }

  async getDataElements(program?: string, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          dataElements: [],
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client) {
        this.logger.warn(`DHIS2 getDataElements running in MOCK mode (${context.reason || 'fallback'})`);
        const mockDataElements: Record<string, Array<{ id: string; name: string; valueType: string }>> = {
          IpHINAT79UW: [
            { id: 'UXz7xuGCEhU', name: 'Weight (kg)', valueType: 'NUMBER' },
            { id: 'lZGmxYbs97q', name: 'Height (cm)', valueType: 'NUMBER' },
            { id: 'X8zyunlgUfM', name: 'Vaccination given', valueType: 'BOOLEAN' },
          ],
          WSGAb5XwJ3Y: [
            { id: 'qrur9Dvnyt5', name: 'Fever', valueType: 'BOOLEAN' },
            { id: 'oZg33kd9taw', name: 'RDT Result', valueType: 'TEXT' },
            { id: 'GieVkTxp4HH', name: 'Treatment given', valueType: 'TEXT' },
          ],
        };

        return {
          dataElements: program ? mockDataElements[program] || [] : Object.values(mockDataElements).flat(),
        };
      }

      if (program) {
        const response = await context.client.get(`/programs/${program}`, {
          params: {
            fields: 'programStages[programStageDataElements[dataElement[id,name,valueType]]]',
          },
        });

        const dataElements: any[] = [];
        if (response.data.programStages) {
          response.data.programStages.forEach((stage: any) => {
            if (stage.programStageDataElements) {
              stage.programStageDataElements.forEach((psde: any) => {
                if (psde.dataElement) {
                  dataElements.push({
                    id: psde.dataElement.id,
                    name: psde.dataElement.name,
                    valueType: psde.dataElement.valueType,
                  });
                }
              });
            }
          });
        }

        return { dataElements };
      }

      const response = await context.client.get('/dataElements', {
        params: {
          fields: 'id,name,valueType',
          paging: false,
        },
      });

      return {
        dataElements: response.data.dataElements || [],
      };
    } catch (error: any) {
      this.logger.error('Error fetching DHIS2 data elements:', error);
      return {
        dataElements: [],
        error: error.response?.data || error.message,
      };
    }
  }

  async sendAggregateReport(reportData: any, tenantDb: DataSource, tenantId?: string) {
    try {
      const report = reportData || {};
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          period: report.period || 'unknown',
          dataValues: 0,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      const profileSelection = this.getAggregateProfile(report.profile);
      if (!profileSelection) {
        return {
          status: 'NOT_CONFIGURED',
          period: report.period || 'unknown',
          dataValues: 0,
          message: `Unsupported aggregate profile "${report.profile}".`,
        };
      }

      const profile = profileSelection.key;
      const profileDefinition = profileSelection.definition;
      const period = report.period || new Date().toISOString().slice(0, 7).replace('-', '');
      const orgUnit = report.orgUnit || context.config?.orgUnitId || this.envOrgUnit || 'YOUR_ORG_UNIT_ID';

      let dataSet =
        report.dataSet ||
        (profile === 'service_delivery'
          ? context.config?.dataSetId || this.envDataSetId
          : undefined);
      if (!dataSet && context.client) {
        dataSet = await this.resolveDataSetIdByCode(context, profileDefinition.dataSetCode);
      }

      const fallbackElementMap =
        !report.dataElements && context.client
          ? await this.resolveAggregateElementIdsByCode(context, dataSet, profileDefinition.metricCodes)
          : {};
      const elementMap = {
        ...fallbackElementMap,
        ...(report.dataElements || {}),
      };

      const computedMetrics = await this.computeAggregateMetrics(profile, tenantDb, period);

      const payloadDataValues =
        Array.isArray(report.dataValues) && report.dataValues.length > 0
          ? report.dataValues
          : Object.entries(computedMetrics)
              .filter(([metricKey]) => Boolean(elementMap[metricKey]))
              .map(([metricKey, value]) => ({
                dataElement: elementMap[metricKey],
                value: String(value),
              }));

      if (!dataSet) {
        return {
          status: 'NOT_CONFIGURED',
          period,
          dataValues: 0,
          message: `DHIS2 dataset is not configured for aggregate profile "${profile}".`,
        };
      }

      if (!payloadDataValues.length) {
        return {
          status: 'NOT_CONFIGURED',
          period,
          dataValues: 0,
              message:
            `No aggregate data elements are configured for profile "${profile}". Provide reportData.dataElements or include mapped data elements in the target dataset.`,
        };
      }

      let aggregateData = {
        dataSet,
        period,
        orgUnit,
        dataValues: payloadDataValues.map((item: any) => ({
          ...item,
          orgUnit: item?.orgUnit || orgUnit,
          period: item?.period || period,
        })),
      };

      if (context.useMock || !context.client) {
        this.logger.warn(`DHIS2 sendAggregateReport running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          profile,
          period: aggregateData.period,
          dataValues: aggregateData.dataValues.length,
          message: '[MOCK] Aggregate report sent to DHIS2 successfully',
        };
      }

      let response;
      try {
        response = await context.client.post('/dataValueSets', aggregateData);
      } catch (error: any) {
        const fallbackPeriod = this.extractLatestOpenFuturePeriod(error?.response?.data);
        if (!fallbackPeriod || fallbackPeriod === aggregateData.period) {
          throw error;
        }

        aggregateData = {
          ...aggregateData,
          period: fallbackPeriod,
          dataValues: aggregateData.dataValues.map((item: any) => ({
            ...item,
            period: fallbackPeriod,
          })),
        };

        this.logger.warn(
          `Aggregate period ${period} rejected by DHIS2; retrying with latest allowed period ${fallbackPeriod}.`,
        );
        response = await context.client.post('/dataValueSets', aggregateData);
      }

      const importCounts = this.extractImportCounts(response.data);

      await this.ensureTenantSyncTables(tenantDb);
      await this.insertSyncLog(tenantDb, {
        entityType: 'aggregate',
        entityId: null,
        dhis2Id: null,
        action: 'upsert',
        status: 'success',
        payload: {
          profile,
          dataSet: aggregateData.dataSet,
          period: aggregateData.period,
          orgUnit: aggregateData.orgUnit,
          dataValuesCount: aggregateData.dataValues.length,
          metrics: computedMetrics,
          ...importCounts,
        },
      });

      return {
        status: response.data.status || 'SUCCESS',
        profile,
        period: aggregateData.period,
        imported: importCounts.imported,
        updated: importCounts.updated,
        ignored: importCounts.ignored,
        dataValues: aggregateData.dataValues.length,
        message: 'Aggregate report sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending aggregate report to DHIS2:', error);
      if (this.canQueryTenantDb(tenantDb)) {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          await this.insertSyncLog(tenantDb, {
            entityType: 'aggregate',
            entityId: null,
            dhis2Id: null,
            action: 'error',
            status: 'error',
            errorMessage: error?.message || 'DHIS2 aggregate report send failed',
            payload: {
              profile: reportData?.profile || 'service_delivery',
              period: reportData?.period || null,
              dataSet: reportData?.dataSet || null,
              orgUnit: reportData?.orgUnit || null,
              request: reportData || null,
              response: error?.response?.data || null,
            },
          });
        } catch (logError: any) {
          this.logger.warn(`Failed to write DHIS2 aggregate sync log: ${logError?.message || logError}`);
        }
      }
      return {
        status: 'ERROR',
        profile: reportData?.profile || 'service_delivery',
        period: reportData?.period || 'unknown',
        dataValues: 0,
        message: `DHIS2 aggregate report send failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async getSyncStatus(tenantDb: DataSource, tenantId?: string) {
    try {
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          lastSync: null,
          status: 'NOT_CONFIGURED',
          patientsSynced: 0,
          eventsSynced: 0,
          dataValuesSynced: 0,
          errors: 0,
          nextSync: null,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      if (context.useMock || !context.client) {
        return {
          lastSync: null,
          status: 'MOCK_MODE',
          patientsSynced: 0,
          eventsSynced: 0,
          dataValuesSynced: 0,
          errors: 0,
          nextSync: null,
          message:
            `DHIS2 running in MOCK mode (${context.reason || 'fallback'}). Configure DHIS2_PAT or DHIS2_USERNAME/DHIS2_PASSWORD to enable real API.`,
        };
      }

      const systemInfo = await context.client.get('/system/info');

      let lastSync: string | null = null;
      let patientSuccessCount = 0;
      let eventSuccessCount = 0;
      let dataValueSuccessCount = 0;
      let totalErrorCount = 0;

      if (tenantDb && typeof (tenantDb as any).query === 'function') {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          const statsRows: Dhis2SyncStatsRow[] = await tenantDb.query(
            `
            SELECT
              MAX(synced_at) AS last_sync,
              COUNT(*) FILTER (WHERE entity_type = 'patient' AND status = 'success')::int AS patient_success_count,
              COUNT(*) FILTER (WHERE entity_type = 'event' AND status = 'success')::int AS event_success_count,
              COUNT(*) FILTER (
                WHERE entity_type IN ('data_value_set', 'aggregate') AND status = 'success'
              )::int AS data_value_success_count,
              COUNT(*) FILTER (WHERE status = 'error')::int AS total_error_count
            FROM dhis2_sync_log
            `,
          );
          const stats = statsRows?.[0] || {};
          lastSync = stats.last_sync ? String(stats.last_sync) : null;
          patientSuccessCount = Number(stats.patient_success_count || 0);
          eventSuccessCount = Number(stats.event_success_count || 0);
          dataValueSuccessCount = Number(stats.data_value_success_count || 0);
          totalErrorCount = Number(stats.total_error_count || 0);
        } catch (statsError: any) {
          this.logger.warn(`Unable to read DHIS2 sync log stats: ${statsError?.message || statsError}`);
        }
      }

      return {
        lastSync,
        status: 'CONNECTED',
        dhis2Version: systemInfo.data?.version || 'unknown',
        patientsSynced: patientSuccessCount,
        eventsSynced: eventSuccessCount,
        dataValuesSynced: dataValueSuccessCount,
        errors: totalErrorCount,
        nextSync: null,
        message: 'Connected to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error checking DHIS2 sync status:', error);
      return {
        lastSync: null,
        status: 'ERROR',
        patientsSynced: 0,
        eventsSynced: 0,
        dataValuesSynced: 0,
        errors: 1,
        nextSync: null,
        message: `DHIS2 connection failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }
}
