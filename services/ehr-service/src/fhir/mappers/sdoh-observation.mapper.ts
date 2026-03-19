import type * as fhir from 'fhir/r4';
import { SdohScreeningLog } from '../../entities/sdoh-screening-log.entity';
import { SdohReferral } from '../../entities/sdoh-referral.entity';

// LOINC codes for SDOH screening tools
const TOOL_LOINC: Record<string, { code: string; display: string }> = {
  PRAPARE:   { code: '93025-5', display: 'Protocol for Responding to and Assessing Patients Assets, Risks, and Experiences [PRAPARE]' },
  AHC_HRSN:  { code: '96777-8', display: 'Accountable health communities health-related social needs screening tool' },
  SEEK:      { code: '71802-3', display: 'Housing status' },
};

export class SdohObservationMapper {
  static screeningLogToFhir(record: SdohScreeningLog, tenantId?: string): fhir.Observation {
    const tool = TOOL_LOINC[record.toolUsed] || { code: '75626-2', display: 'SDOH screening' };
    const positiveCount = Array.isArray(record.positiveScreens) ? record.positiveScreens.length : 0;

    return {
      resourceType: 'Observation',
      id: record.id,
      meta: { lastUpdated: record.createdAt.toISOString() },
      status: 'final',
      category: [
        {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'social-history',
            display: 'Social History',
          }],
        },
        {
          coding: [{
            system: 'http://hl7.org/fhir/us/sdoh-clinicalcare/CodeSystem/SDOHCC-CodeSystemTemporaryCodes',
            code: 'sdoh-category-unspecified',
            display: 'SDOH Category Unspecified',
          }],
        },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: tool.code, display: tool.display }],
        text: `SDOH Screening — ${record.toolUsed}`,
      },
      subject: { reference: `Patient/${record.patientId}` },
      effectiveDateTime: record.screeningDate ? new Date(record.screeningDate).toISOString() : record.createdAt.toISOString(),
      valueInteger: positiveCount,
      note: record.positiveScreens?.length
        ? [{ text: `Positive screens: ${JSON.stringify(record.positiveScreens)}` }]
        : undefined,
      component: record.zCodes?.map(zCode => ({
        code: {
          coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: zCode, display: zCode }],
        },
        valueString: zCode,
      })),
    };
  }

  static referralToFhirServiceRequest(record: SdohReferral, tenantId?: string): fhir.ServiceRequest {
    return {
      resourceType: 'ServiceRequest',
      id: record.id,
      meta: { lastUpdated: record.updatedAt?.toISOString() || record.createdAt.toISOString() },
      status: this.mapStatus(record.status),
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://hl7.org/fhir/us/sdoh-clinicalcare/CodeSystem/SDOHCC-CodeSystemTemporaryCodes',
          code: 'referral-to-community-service',
          display: 'Referral to Community Service',
        }],
      }],
      code: {
        text: record.referralReason,
      },
      subject: { reference: `Patient/${record.patientId}` },
      requester: { reference: `Practitioner/${record.referredBy}` },
      occurrenceDateTime: record.referralDate ? new Date(record.referralDate).toISOString() : undefined,
      note: record.notes ? [{ text: record.notes }] : undefined,
    };
  }

  private static mapStatus(status: string): fhir.ServiceRequest['status'] {
    const map: Record<string, fhir.ServiceRequest['status']> = {
      sent: 'active',
      accepted: 'active',
      completed: 'completed',
      declined: 'revoked',
    };
    return map[status] ?? 'active';
  }
}
