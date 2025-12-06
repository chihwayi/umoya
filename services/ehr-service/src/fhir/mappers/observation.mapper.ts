import { Vitals } from '../../entities/vitals.entity';
import { LabOrder } from '../../entities/lab-order.entity';
import type * as fhir from 'fhir/r4';

export class ObservationMapper {
  /**
   * Convert Vitals entity to FHIR Observation resource(s)
   * Returns an array because vitals can contain multiple observations
   */
  static vitalsToFhir(vitals: Vitals, tenantId?: string): fhir.Observation[] {
    const observations: fhir.Observation[] = [];

    // Blood Pressure (composite observation)
    if (vitals.bloodPressure) {
      const [systolic, diastolic] = vitals.bloodPressure.split('/').map(v => parseInt(v.trim(), 10));
      
      if (!isNaN(systolic)) {
        observations.push({
          resourceType: 'Observation',
          id: `${vitals.id}-systolic`,
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            }],
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '8480-6',
              display: 'Systolic blood pressure',
            }],
            text: 'Systolic blood pressure',
          },
          subject: {
            reference: `Patient/${vitals.patientId}`,
          },
          effectiveDateTime: vitals.recordedAt.toISOString(),
          valueQuantity: {
            value: systolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
          performer: vitals.recordedBy ? [{
            reference: `Practitioner/${vitals.recordedBy}`,
          }] : undefined,
        });
      }

      if (!isNaN(diastolic)) {
        observations.push({
          resourceType: 'Observation',
          id: `${vitals.id}-diastolic`,
          status: 'final',
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            }],
          }],
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '8462-4',
              display: 'Diastolic blood pressure',
            }],
            text: 'Diastolic blood pressure',
          },
          subject: {
            reference: `Patient/${vitals.patientId}`,
          },
          effectiveDateTime: vitals.recordedAt.toISOString(),
          valueQuantity: {
            value: diastolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
          performer: vitals.recordedBy ? [{
            reference: `Practitioner/${vitals.recordedBy}`,
          }] : undefined,
        });
      }
    }

    // Heart Rate
    if (vitals.heartRate !== undefined && vitals.heartRate !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-heart-rate`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate',
          }],
          text: 'Heart rate',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: vitals.heartRate,
          unit: 'beats/minute',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // Temperature
    if (vitals.temperature !== undefined && vitals.temperature !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-temperature`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature',
          }],
          text: 'Body temperature',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: Number(vitals.temperature),
          unit: '°C',
          system: 'http://unitsofmeasure.org',
          code: 'Cel',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // Oxygen Saturation
    if (vitals.oxygenSaturation !== undefined && vitals.oxygenSaturation !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-oxygen-saturation`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '59408-5',
            display: 'Oxygen saturation in Arterial blood',
          }],
          text: 'Oxygen saturation',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: vitals.oxygenSaturation,
          unit: '%',
          system: 'http://unitsofmeasure.org',
          code: '%',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // Respiratory Rate
    if (vitals.respiratoryRate !== undefined && vitals.respiratoryRate !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-respiratory-rate`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '9279-1',
            display: 'Respiratory rate',
          }],
          text: 'Respiratory rate',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: vitals.respiratoryRate,
          unit: 'breaths/minute',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // Weight
    if (vitals.weight !== undefined && vitals.weight !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-weight`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '29463-7',
            display: 'Body weight',
          }],
          text: 'Body weight',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: Number(vitals.weight),
          unit: 'kg',
          system: 'http://unitsofmeasure.org',
          code: 'kg',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // Height
    if (vitals.height !== undefined && vitals.height !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-height`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8302-2',
            display: 'Body height',
          }],
          text: 'Body height',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: Number(vitals.height),
          unit: 'cm',
          system: 'http://unitsofmeasure.org',
          code: 'cm',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // BMI
    if (vitals.bmi !== undefined && vitals.bmi !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-bmi`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '39156-5',
            display: 'Body mass index (BMI) [Ratio]',
          }],
          text: 'Body mass index',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: Number(vitals.bmi),
          unit: 'kg/m2',
          system: 'http://unitsofmeasure.org',
          code: 'kg/m2',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // Blood Glucose
    if (vitals.bloodGlucose !== undefined && vitals.bloodGlucose !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-blood-glucose`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '2339-0',
            display: 'Glucose [Mass/volume] in Blood',
          }],
          text: 'Blood glucose',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: Number(vitals.bloodGlucose),
          unit: 'mg/dL',
          system: 'http://unitsofmeasure.org',
          code: 'mg/dL',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    // Pain Level
    if (vitals.painLevel !== undefined && vitals.painLevel !== null) {
      observations.push({
        resourceType: 'Observation',
        id: `${vitals.id}-pain-level`,
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '72514-3',
            display: 'Pain severity - 0-10 verbal numeric rating [Score]',
          }],
          text: 'Pain level',
        },
        subject: {
          reference: `Patient/${vitals.patientId}`,
        },
        effectiveDateTime: vitals.recordedAt.toISOString(),
        valueQuantity: {
          value: vitals.painLevel,
          unit: 'score',
        },
        performer: vitals.recordedBy ? [{
          reference: `Practitioner/${vitals.recordedBy}`,
        }] : undefined,
      });
    }

    return observations;
  }

  /**
   * Convert LabOrder entity to FHIR Observation resource(s)
   * Returns an array - one observation per test in the lab order
   */
  static labOrderToFhir(labOrder: LabOrder, tenantId?: string): fhir.Observation[] {
    if (!labOrder.tests || labOrder.tests.length === 0) {
      return [];
    }

    return labOrder.tests.map((test, index) => {
      const observation: fhir.Observation = {
        resourceType: 'Observation',
        id: `${labOrder.id}-${index}`,
        status: this.mapLabOrderStatus(labOrder.status),
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory',
          }],
        }],
        code: {
          coding: [
            ...(test.testCode ? [{
              system: 'http://loinc.org',
              code: test.testCode,
              display: test.testName,
            }] : []),
            ...(labOrder.snomedConceptId ? [{
              system: 'http://snomed.info/sct',
              code: labOrder.snomedConceptId,
              display: labOrder.snomedTerm,
            }] : []),
          ],
          text: test.testName,
        },
        subject: {
          reference: `Patient/${labOrder.patientId}`,
        },
        effectiveDateTime: labOrder.scheduledDateTime?.toISOString() || labOrder.collectedAt?.toISOString() || labOrder.createdAt.toISOString(),
        performer: labOrder.orderingProviderId ? [{
          reference: `Practitioner/${labOrder.orderingProviderId}`,
        }] : undefined,
      };

      // Add result if available
      if (labOrder.results && labOrder.results.length > index) {
        const result = labOrder.results[index];
        if (result.value) {
          observation.valueQuantity = {
            value: parseFloat(result.value),
            unit: result.unit || '',
            system: 'http://unitsofmeasure.org',
          };
        }
        if (result.flag) {
          observation.interpretation = [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: this.mapResultFlag(result.flag),
            }],
          }];
        }
        if (result.referenceRange) {
          // Parse reference range (format: "low-high" or "value")
          const rangeParts = result.referenceRange.split('-');
          observation.referenceRange = [{
            low: rangeParts[0] ? {
              value: parseFloat(rangeParts[0]),
              unit: result.unit || '',
            } : undefined,
            high: rangeParts[1] ? {
              value: parseFloat(rangeParts[1]),
              unit: result.unit || '',
            } : undefined,
          }];
        }
      }

      // Add specimen information
      if (test.specimenType) {
        observation.specimen = {
          type: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: test.specimenType,
              display: test.specimenType,
            }],
            text: test.specimenType,
          },
        } as any; // Type assertion needed for FHIR type compatibility
      }

      return observation;
    });
  }

  /**
   * Map lab order status to FHIR observation status
   */
  private static mapLabOrderStatus(status: string): fhir.Observation['status'] {
    const statusMap: Record<string, fhir.Observation['status']> = {
      'ordered': 'registered',
      'awaiting_payment': 'registered',
      'collected': 'preliminary',
      'in_progress': 'preliminary',
      'completed': 'final',
      'cancelled': 'cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'registered';
  }

  /**
   * Map result flag to FHIR interpretation code
   */
  private static mapResultFlag(flag: string): string {
    const flagMap: Record<string, string> = {
      'normal': 'N',
      'high': 'H',
      'low': 'L',
      'critical': 'LL', // Use 'LL' for critical low, could be enhanced to detect high vs low
    };
    return flagMap[flag?.toLowerCase()] || 'N';
  }
}

