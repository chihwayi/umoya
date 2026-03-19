import type * as fhir from 'fhir/r4';
import { NtdCase } from '../../entities/ntd-case.entity';
import { CholeraCase } from '../../entities/cholera-case.entity';
import { TyphoidCase } from '../../entities/typhoid-case.entity';

// ICD-10 codes for NTDs
const NTD_CODES: Record<string, { icd10: string; display: string }> = {
  schistosomiasis:           { icd10: 'B65.9', display: 'Schistosomiasis, unspecified' },
  soil_transmitted_helminth: { icd10: 'B82.0', display: 'Intestinal helminthiasis, unspecified' },
  lymphatic_filariasis:      { icd10: 'B74.0', display: 'Filariasis due to Wuchereria bancrofti' },
  trachoma:                  { icd10: 'A71.9', display: 'Trachoma, unspecified' },
  leprosy:                   { icd10: 'A30.9', display: 'Leprosy, unspecified' },
};

export class NtdConditionMapper {
  static ntdCaseToFhir(record: NtdCase, tenantId?: string): fhir.Condition {
    const coding = NTD_CODES[record.disease];
    return {
      resourceType: 'Condition',
      id: record.id,
      meta: { lastUpdated: record.updatedAt?.toISOString() || record.createdAt.toISOString() },
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }],
      },
      category: [{
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }],
      }],
      code: {
        coding: coding ? [{
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: coding.icd10,
          display: coding.display,
        }] : [],
        text: record.disease,
      },
      subject: { reference: `Patient/${record.patientId}` },
      onsetDateTime: record.diagnosisDate ? new Date(record.diagnosisDate).toISOString() : undefined,
      recordedDate: record.createdAt.toISOString(),
      note: record.notes ? [{ text: record.notes }] : undefined,
    };
  }

  static choleraCaseToFhir(record: CholeraCase, tenantId?: string): fhir.Condition {
    return {
      resourceType: 'Condition',
      id: record.id,
      meta: { lastUpdated: record.updatedAt?.toISOString() || record.createdAt.toISOString() },
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: record.caseClassification === 'confirmed' ? 'confirmed' : 'provisional',
        }],
      },
      category: [{
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }],
      }],
      code: {
        coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'A00.9', display: 'Cholera, unspecified' }],
        text: `Cholera (${record.caseClassification})`,
      },
      subject: { reference: `Patient/${record.patientId}` },
      onsetDateTime: record.onset ? new Date(record.onset).toISOString() : undefined,
      recordedDate: record.createdAt.toISOString(),
      note: record.notes ? [{ text: record.notes }] : undefined,
    };
  }

  static typhoidCaseToFhir(record: TyphoidCase, tenantId?: string): fhir.Condition {
    return {
      resourceType: 'Condition',
      id: record.id,
      meta: { lastUpdated: record.updatedAt?.toISOString() || record.createdAt.toISOString() },
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: record.bloodCultureResult?.startsWith('S_') ? 'confirmed' : 'provisional',
        }],
      },
      category: [{
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }],
      }],
      code: {
        coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'A01.0', display: 'Typhoid fever' }],
        text: 'Typhoid fever',
      },
      subject: { reference: `Patient/${record.patientId}` },
      onsetDateTime: record.onsetDate ? new Date(record.onsetDate).toISOString() : undefined,
      recordedDate: record.createdAt.toISOString(),
      note: [
        record.bloodCultureResult ? { text: `Blood culture: ${record.bloodCultureResult}` } : null,
        record.treatment ? { text: `Treatment: ${record.treatment}` } : null,
        record.notes ? { text: record.notes } : null,
      ].filter(Boolean) as fhir.Annotation[],
    };
  }
}
