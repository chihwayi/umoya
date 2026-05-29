import { Allergy } from '../../entities/allergy.entity';
import * as fhir from 'fhir/r4';

/**
 * AllergyIntolerance FHIR Mapper
 * Maps between FHIR AllergyIntolerance resources and Allergy entities
 */
export class AllergyIntoleranceMapper {
  /**
   * Convert Allergy entity to FHIR AllergyIntolerance resource
   */
  static toFhir(allergy: Allergy, tenantId?: string): fhir.AllergyIntolerance {
    // Map severity to criticality
    const criticalityMap: Record<string, 'low' | 'high' | 'unable-to-assess'> = {
      mild: 'low',
      moderate: 'low',
      severe: 'high',
    };

    // Map severity to reaction severity
    const reactionSeverityMap: Record<string, 'mild' | 'moderate' | 'severe'> = {
      mild: 'mild',
      moderate: 'moderate',
      severe: 'severe',
    };

    // Map clinical status
    const clinicalStatusMap: Record<string, string> = {
      active: 'active',
      inactive: 'inactive',
      resolved: 'resolved',
    };

    // Map verification status
    const verificationStatusMap: Record<string, string> = {
      unconfirmed: 'unconfirmed',
      confirmed: 'confirmed',
      refuted: 'refuted',
      'entered-in-error': 'entered-in-error',
    };

    const fhirAllergy: fhir.AllergyIntolerance = {
      resourceType: 'AllergyIntolerance',
      id: allergy.id,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: clinicalStatusMap[allergy.clinicalStatus?.toLowerCase()] || 'active',
            display: allergy.clinicalStatus || 'Active',
          },
        ],
        text: allergy.clinicalStatus || 'Active',
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: verificationStatusMap[allergy.verificationStatus?.toLowerCase()] || 'unconfirmed',
            display: allergy.verificationStatus || 'Unconfirmed',
          },
        ],
        text: allergy.verificationStatus || 'Unconfirmed',
      },
      type: 'allergy',
      category: ['medication', 'food', 'environment', 'biologic'],
      criticality: criticalityMap[allergy.severity?.toLowerCase()] || 'unable-to-assess',
      code: {
        coding: [
          ...(allergy.allergenSnomedCode
            ? [
                {
                  system: 'http://snomed.info/sct',
                  code: allergy.allergenSnomedCode,
                  display: allergy.allergenSnomedTerm || allergy.allergen,
                },
              ]
            : []),
          {
            system: 'http://umoya.health/fhir/allergen',
            code: allergy.allergen.toLowerCase().replace(/\s+/g, '-'),
            display: allergy.allergen,
          },
        ],
        text: allergy.allergen,
      },
      patient: {
        reference: `Patient/${allergy.patientId}`,
        type: 'Patient',
      },
      recordedDate: allergy.recordedAt.toISOString(),
      recorder: allergy.recordedBy
        ? {
            reference: `Practitioner/${allergy.recordedBy}`,
            type: 'Practitioner',
          }
        : undefined,
      reaction: allergy.reaction
        ? [
            {
              substance: {
                coding: [
                  ...(allergy.allergenSnomedCode
                    ? [
                        {
                          system: 'http://snomed.info/sct',
                          code: allergy.allergenSnomedCode,
                          display: allergy.allergenSnomedTerm || allergy.allergen,
                        },
                      ]
                    : []),
                ],
                text: allergy.allergen,
              },
              manifestation: [
                {
                  coding: allergy.reactionSnomedCode
                    ? [
                        {
                          system: 'http://snomed.info/sct',
                          code: allergy.reactionSnomedCode,
                          display: allergy.reactionSnomedTerm || allergy.reaction,
                        },
                      ]
                    : [],
                  text: allergy.reaction,
                },
              ],
              severity: reactionSeverityMap[allergy.severity?.toLowerCase()] || 'mild',
            },
          ]
        : [],
    };

    return fhirAllergy;
  }

  /**
   * Convert FHIR AllergyIntolerance to Allergy entity data
   */
  static fromFhir(fhirAllergy: fhir.AllergyIntolerance, tenantId?: string): Partial<Allergy> {
    const patientId = fhirAllergy.patient?.reference?.split('/')[1] || fhirAllergy.patient?.reference;
    
    if (!patientId) {
      throw new Error('Patient reference is required');
    }

    // Extract allergen
    const allergen = fhirAllergy.code?.text || 
                     fhirAllergy.code?.coding?.[0]?.display || 
                     fhirAllergy.code?.coding?.[0]?.code || 
                     'Unknown';

    // Extract SNOMED codes
    const snomedCoding = fhirAllergy.code?.coding?.find(c => c.system?.includes('snomed'));
    const allergenSnomedCode = snomedCoding?.code;
    const allergenSnomedTerm = snomedCoding?.display;

    // Extract reaction
    const reaction = fhirAllergy.reaction?.[0]?.manifestation?.[0]?.text ||
                     fhirAllergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ||
                     fhirAllergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.code;

    const reactionSnomedCoding = fhirAllergy.reaction?.[0]?.manifestation?.[0]?.coding?.find(
      c => c.system?.includes('snomed')
    );
    const reactionSnomedCode = reactionSnomedCoding?.code;
    const reactionSnomedTerm = reactionSnomedCoding?.display;

    // Extract severity
    const severity = fhirAllergy.criticality || fhirAllergy.reaction?.[0]?.severity;
    const severityMap: Record<string, 'mild' | 'moderate' | 'severe'> = {
      mild: 'mild',
      moderate: 'moderate',
      severe: 'severe',
      'low': 'mild',
      'high': 'severe',
    };

    // Extract clinical status
    const clinicalStatus = fhirAllergy.clinicalStatus?.coding?.[0]?.code ||
                          fhirAllergy.clinicalStatus?.text ||
                          'active';

    // Extract verification status
    const verificationStatus = fhirAllergy.verificationStatus?.coding?.[0]?.code ||
                               fhirAllergy.verificationStatus?.text ||
                               'unconfirmed';

    // Extract recorded by
    const recordedBy = fhirAllergy.recorder?.reference?.split('/')[1];

    return {
      patientId,
      allergen,
      allergenSnomedCode,
      allergenSnomedTerm,
      allergenSnomedModuleId: snomedCoding?.system?.split('/').pop(),
      reaction: reaction || undefined,
      reactionSnomedCode,
      reactionSnomedTerm,
      severity: severityMap[severity?.toLowerCase()] || 'moderate',
      severitySnomedCode: undefined, // Not typically in FHIR
      severitySnomedTerm: undefined,
      recordedAt: fhirAllergy.recordedDate ? new Date(fhirAllergy.recordedDate) : new Date(),
      recordedBy,
      verificationStatus,
      clinicalStatus,
    };
  }
}

