import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { Patient } from '../entities/patient.entity';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
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
  private readonly forceMockMode = process.env.DHIS2_USE_MOCK === 'true';

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

  private buildPatientAttributes(patient: Patient) {
    return [
      { attribute: 'w75KJ2mc4zz', value: patient.firstName || '' },
      { attribute: 'zDhUuAYrxNC', value: patient.lastName || '' },
      {
        attribute: 'FO4GPuUTfQU',
        value: patient.dateOfBirth ? patient.dateOfBirth.toISOString().split('T')[0] : '',
      },
      { attribute: 'cejWyOfXge6', value: (patient.gender || '').toUpperCase() },
      { attribute: 'AuPLng5hLbE', value: patient.nationalId || '' },
    ];
  }

  private extractTeiId(responseData: any): string | null {
    return (
      responseData?.response?.importSummaries?.[0]?.reference ||
      responseData?.response?.reference ||
      responseData?.reference ||
      null
    );
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
  }

  private async loadPatientMappings(tenantDb: DataSource): Promise<Map<string, string>> {
    const rows: Dhis2PatientMappingRow[] = await tenantDb.query(
      `SELECT patient_id, dhis2_tei_id FROM dhis2_patient_mappings`,
    );
    return new Map(rows.map((row) => [row.patient_id, row.dhis2_tei_id]));
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
          attributes: this.buildPatientAttributes(patient),
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

  async sendEvent(eventData: any, tenantId?: string) {
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

      const dhis2Event = {
        program: eventData.program,
        orgUnit: eventData.orgUnit || context.config.orgUnitId || this.envOrgUnit,
        eventDate: eventData.eventDate,
        status: 'COMPLETED',
        trackedEntityInstance: eventData.patientId,
        dataValues: eventData.dataValues,
      };

      const response = await context.client.post('/events', dhis2Event);

      return {
        status: 'SUCCESS',
        reference: response.data.response?.importSummaries?.[0]?.reference || `EVENT_${Date.now()}`,
        message: 'Event sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending event to DHIS2:', error);
      return {
        status: 'ERROR',
        reference: `EVENT_${Date.now()}`,
        message: `DHIS2 event send failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  async sendDataValues(dataValues: any, tenantId?: string) {
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
        dataValues: dataValues.values,
      };

      const response = await context.client.post('/dataValueSets', dhis2DataValues);

      return {
        status: response.data.status || 'SUCCESS',
        imported: response.data.imported || 0,
        updated: response.data.updated || 0,
        ignored: response.data.ignored || 0,
        deleted: response.data.deleted || 0,
        message: 'Data values sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending data values to DHIS2:', error);
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
      const appointmentRepository = tenantDb.getRepository(AppointmentSimple);

      const totalAppointments = await appointmentRepository.count();
      const completedAppointments = await appointmentRepository.count({ where: { status: 'completed' } });
      const context = await this.resolveContext(tenantId);

      if (!context.enabled) {
        return {
          status: 'NOT_CONFIGURED',
          period: reportData.period || 'unknown',
          dataValues: 0,
          message: context.reason || 'DHIS2 is not configured for this tenant.',
        };
      }

      const aggregateData = {
        dataSet:
          reportData.dataSet ||
          context.config?.dataSetId ||
          this.envDataSetId ||
          'BfMAe6Itzgt',
        period: reportData.period || new Date().toISOString().slice(0, 7).replace('-', ''),
        orgUnit: reportData.orgUnit || context.config?.orgUnitId || this.envOrgUnit || 'YOUR_ORG_UNIT_ID',
        dataValues: [
          {
            dataElement: reportData.dataElements?.totalConsultations || 'FTRrcoaog83',
            value: totalAppointments.toString(),
          },
          {
            dataElement: reportData.dataElements?.completedConsultations || 'eY5ehpbEsB7',
            value: completedAppointments.toString(),
          },
        ],
      };

      if (context.useMock || !context.client) {
        this.logger.warn(`DHIS2 sendAggregateReport running in MOCK mode (${context.reason || 'fallback'})`);
        return {
          status: 'SUCCESS',
          period: aggregateData.period,
          dataValues: aggregateData.dataValues.length,
          message: '[MOCK] Aggregate report sent to DHIS2 successfully',
        };
      }

      const response = await context.client.post('/dataValueSets', aggregateData);

      return {
        status: response.data.status || 'SUCCESS',
        period: aggregateData.period,
        imported: response.data.imported || 0,
        updated: response.data.updated || 0,
        ignored: response.data.ignored || 0,
        dataValues: aggregateData.dataValues.length,
        message: 'Aggregate report sent to DHIS2 successfully',
      };
    } catch (error: any) {
      this.logger.error('Error sending aggregate report to DHIS2:', error);
      return {
        status: 'ERROR',
        period: reportData.period || 'unknown',
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
      let patientErrorCount = 0;
      let totalSuccessCount = 0;

      if (tenantDb && typeof (tenantDb as any).query === 'function') {
        try {
          await this.ensureTenantSyncTables(tenantDb);
          const statsRows = await tenantDb.query(
            `
            SELECT
              MAX(synced_at) AS last_sync,
              COUNT(*) FILTER (WHERE entity_type = 'patient' AND status = 'success')::int AS patient_success_count,
              COUNT(*) FILTER (WHERE entity_type = 'patient' AND status = 'error')::int AS patient_error_count,
              COUNT(*) FILTER (WHERE status = 'success')::int AS total_success_count
            FROM dhis2_sync_log
            `,
          );
          const stats = statsRows?.[0] || {};
          lastSync = stats.last_sync ? String(stats.last_sync) : null;
          patientSuccessCount = Number(stats.patient_success_count || 0);
          patientErrorCount = Number(stats.patient_error_count || 0);
          totalSuccessCount = Number(stats.total_success_count || 0);
        } catch (statsError: any) {
          this.logger.warn(`Unable to read DHIS2 sync log stats: ${statsError?.message || statsError}`);
        }
      }

      return {
        lastSync,
        status: 'CONNECTED',
        dhis2Version: systemInfo.data?.version || 'unknown',
        patientsSynced: patientSuccessCount,
        eventsSynced: totalSuccessCount - patientSuccessCount,
        dataValuesSynced: 0,
        errors: patientErrorCount,
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
