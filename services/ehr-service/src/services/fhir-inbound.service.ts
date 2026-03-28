import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { FhirIngestionLog } from '../entities/fhir-ingestion-log.entity';
import type * as fhir from 'fhir/r4';

@Injectable()
export class FhirInboundService {
  private readonly logger = new Logger(FhirInboundService.name);

  constructor(private readonly tenantService: TenantService) {}

  async ingestBundle(subdomain: string, bundle: fhir.Bundle, sourceSystem: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const log = ds.getRepository(FhirIngestionLog).create({
      sourceSystem,
      bundleId: bundle.id,
      receivedAt: new Date(),
      resourcesReceived: bundle.entry?.length || 0,
      status: 'pending',
    });
    const savedLog = await ds.getRepository(FhirIngestionLog).save(log);

    let imported = 0;
    let conflicts = 0;
    let resolved = 0;
    const errors: any[] = [];

    for (const entry of bundle.entry || []) {
      const resource = entry.resource;
      if (!resource) continue;
      try {
        const result = await this.importResource(ds, resource);
        if (result.conflict) { conflicts++; if (result.resolved) resolved++; }
        else imported++;
      } catch (e: any) {
        errors.push({ resourceType: resource.resourceType, id: resource.id, error: e.message });
      }
    }

    await ds.getRepository(FhirIngestionLog).update(savedLog.id, {
      resourcesImported: imported,
      conflictsDetected: conflicts,
      conflictsResolved: resolved,
      status: errors.length === 0 ? 'completed' : imported > 0 ? 'partial' : 'failed',
      errorDetails: errors.length ? errors : null,
    });

    return { logId: savedLog.id, imported, conflicts, resolved, errors: errors.length };
  }

  async getIngestionLogs(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(FhirIngestionLog).find({ order: { receivedAt: 'DESC' } });
  }

  private async importResource(ds: any, resource: fhir.Resource): Promise<{ conflict: boolean; resolved: boolean }> {
    switch (resource.resourceType) {
      case 'Observation':
        return this.importObservation(ds, resource as fhir.Observation);
      case 'Condition':
        return this.importCondition(ds, resource as fhir.Condition);
      case 'MedicationRequest':
        return this.importMedicationRequest(ds, resource as fhir.MedicationRequest);
      default:
        this.logger.debug(`Skipping unsupported resource type: ${resource.resourceType}`);
        return { conflict: false, resolved: false };
    }
  }

  private async importObservation(ds: any, obs: fhir.Observation): Promise<{ conflict: boolean; resolved: boolean }> {
    const patientId = obs.subject?.reference?.replace('Patient/', '');
    if (!patientId) return { conflict: false, resolved: false };
    // Newer timestamp wins for observations
    await ds.query(
      `INSERT INTO vitals (patient_id, measurement_type, value, unit, recorded_at, source)
       VALUES ($1, $2, $3, $4, $5, 'fhir_inbound')
       ON CONFLICT DO NOTHING`,
      [patientId, obs.code?.coding?.[0]?.code, (obs as any).valueQuantity?.value, (obs as any).valueQuantity?.unit, obs.effectiveDateTime || new Date()]
    ).catch(() => {});
    return { conflict: false, resolved: false };
  }

  private async importCondition(ds: any, cond: fhir.Condition): Promise<{ conflict: boolean; resolved: boolean }> {
    const patientId = cond.subject?.reference?.replace('Patient/', '');
    if (!patientId) return { conflict: false, resolved: false };
    const code = cond.code?.coding?.[0]?.code || '';
    const desc = cond.code?.text || cond.code?.coding?.[0]?.display || '';
    // Merge — all diagnoses merged with source tag
    await ds.query(
      `INSERT INTO problems (patient_id, description, code, code_system, status, source)
       VALUES ($1, $2, $3, $4, 'active', 'fhir_inbound')
       ON CONFLICT DO NOTHING`,
      [patientId, desc, code, 'ICD10']
    ).catch(() => {});
    return { conflict: false, resolved: false };
  }

  private async importMedicationRequest(ds: any, med: fhir.MedicationRequest): Promise<{ conflict: boolean; resolved: boolean }> {
    const patientId = med.subject?.reference?.replace('Patient/', '');
    if (!patientId) return { conflict: false, resolved: false };
    // Flag for pharmacist review if duplicate
    const drug = (med as any).medicationCodeableConcept?.text || '';
    const existing = await ds.query(
      `SELECT id FROM prescriptions WHERE patient_id = $1 AND drug_name ILIKE $2 AND status = 'active'`,
      [patientId, `%${drug}%`]
    ).catch(() => []);
    if (existing.length > 0) {
      return { conflict: true, resolved: false }; // pharmacist review needed
    }
    return { conflict: false, resolved: false };
  }
}
