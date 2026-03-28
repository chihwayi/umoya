import type * as fhir from 'fhir/r4';
import { PmtctEnrollment } from '../../entities/pmtct-enrollment.entity';
import { PmtctInfant } from '../../entities/pmtct-infant.entity';

export class PmtctObservationMapper {
  /**
   * PMTCT enrollment → FHIR Observation panel (mother HIV status + ART)
   */
  static enrollmentToFhir(record: PmtctEnrollment, tenantId?: string): fhir.Observation {
    return {
      resourceType: 'Observation',
      id: record.id,
      meta: { lastUpdated: record.updatedAt?.toISOString() || record.createdAt.toISOString() },
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'exam',
          display: 'Exam',
        }],
      }],
      code: {
        coding: [{ system: 'http://loinc.org', code: '55277-8', display: 'HIV status' }],
        text: 'PMTCT Enrollment — Maternal HIV Status',
      },
      subject: { reference: `Patient/${record.patientId}` },
      effectiveDateTime: record.enrollmentDate
        ? new Date(record.enrollmentDate).toISOString()
        : record.createdAt.toISOString(),
      valueCodeableConcept: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: record.hivStatusAtBooking === 'positive' ? '165816005' : '165815009',
          display: record.hivStatusAtBooking === 'positive' ? 'HIV positive' : 'HIV negative',
        }],
        text: record.hivStatusAtBooking,
      },
      component: [
        {
          code: { coding: [{ system: 'http://loinc.org', code: '45248-8', display: 'ART started' }] },
          valueBoolean: record.artStarted,
        },
        record.artRegimen ? {
          code: { coding: [{ system: 'http://loinc.org', code: '45250-4', display: 'ART regimen' }] },
          valueString: record.artRegimen,
        } : null,
        record.viralLoadAtBooking != null ? {
          code: { coding: [{ system: 'http://loinc.org', code: '20447-9', display: 'HIV viral load' }] },
          valueQuantity: { value: record.viralLoadAtBooking, unit: 'copies/mL' },
        } : null,
      ].filter(Boolean) as fhir.ObservationComponent[],
    };
  }

  /**
   * PMTCT infant → FHIR Observation (early infant diagnosis)
   */
  static infantToFhir(record: PmtctInfant, tenantId?: string): fhir.Observation {
    const status = record.finalHivStatus === 'positive' ? 'final'
      : record.finalHivStatus === 'negative' ? 'final'
      : 'preliminary';

    return {
      resourceType: 'Observation',
      id: record.id,
      meta: { lastUpdated: record.updatedAt?.toISOString() || record.createdAt.toISOString() },
      status,
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'laboratory',
          display: 'Laboratory',
        }],
      }],
      code: {
        coding: [{ system: 'http://loinc.org', code: '69905-5', display: 'Early infant diagnosis HIV' }],
        text: 'PMTCT Infant Early Infant Diagnosis',
      },
      subject: record.infantPatientId
        ? { reference: `Patient/${record.infantPatientId}` }
        : { display: `Infant of mother ${record.motherPatientId}` },
      effectiveDateTime: record.birthDate
        ? new Date(record.birthDate).toISOString()
        : record.createdAt.toISOString(),
      valueCodeableConcept: record.finalHivStatus ? {
        coding: [{
          system: 'http://snomed.info/sct',
          code: record.finalHivStatus === 'positive' ? '165816005' : '165815009',
          display: record.finalHivStatus === 'positive' ? 'HIV positive' : 'HIV negative',
        }],
        text: record.finalHivStatus,
      } : undefined,
      component: [
        record.dbsResult6weeks ? {
          code: { coding: [{ system: 'http://loinc.org', code: '69905-5', display: 'DBS result 6 weeks' }] },
          valueString: record.dbsResult6weeks,
        } : null,
        {
          code: { coding: [{ system: 'http://loinc.org', code: '63936-9', display: 'Cotrimoxazole prophylaxis' }] },
          valueBoolean: record.cotrimoxazoleStarted,
        },
      ].filter(Boolean) as fhir.ObservationComponent[],
    };
  }
}
