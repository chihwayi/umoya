import { Prescription, PrescriptionStatus } from '../../entities/prescription.entity';
import type * as fhir from 'fhir/r4';

export class MedicationRequestMapper {
  /**
   * Convert Prescription entity to FHIR MedicationRequest resource
   */
  static toFhir(prescription: Prescription, tenantId?: string): fhir.MedicationRequest {
    // Map status
    const status = this.mapStatus(prescription.status);
    
    // Map intent (always 'order' for prescriptions)
    const intent: fhir.MedicationRequest['intent'] = 'order';
    
    // Map priority (default to routine)
    const priority: fhir.MedicationRequest['priority'] = 'routine';
    
    // Build medication reference
    const medicationCodeableConcept: fhir.CodeableConcept = {
      coding: [],
      text: prescription.medicationName,
    };
    
    // Add RxNorm code if available
    if (prescription.medicationNameRxnormCode) {
      medicationCodeableConcept.coding.push({
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: prescription.medicationNameRxnormCode,
        display: prescription.medicationNameRxnormName || prescription.medicationName,
      });
    }
    
    // Add SNOMED code if available
    if (prescription.medicationNameSnomedCode) {
      medicationCodeableConcept.coding.push({
        system: 'http://snomed.info/sct',
        code: prescription.medicationNameSnomedCode,
        display: prescription.medicationNameSnomedTerm || prescription.medicationName,
      });
    }
    
    // Build dosage instructions
    const dosageInstruction: fhir.Dosage = {
      text: this.buildDosageText(prescription),
      timing: {
        repeat: {
          frequency: this.parseFrequency(prescription.frequency),
          period: 1,
          periodUnit: 'd', // days
        },
      },
      route: prescription.route ? {
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.mapRouteToSnomed(prescription.route),
          display: prescription.route,
        }],
        text: prescription.route,
      } : undefined,
      doseAndRate: [{
        doseQuantity: {
          value: this.parseDosage(prescription.dosage),
          unit: prescription.strength || 'unit',
          system: 'http://unitsofmeasure.org',
        },
      }],
    };
    
    // Add additional instructions if present
    if (prescription.instructions) {
      dosageInstruction.additionalInstruction = [{
        text: prescription.instructions,
      }];
    }
    
    // Build dispense request
    // Calculate end date from duration if available, otherwise use prescribedDate + 30 days default
    const startDate = prescription.prescribedDate || prescription.createdAt;
    let endDate: Date | undefined;
    if (prescription.duration) {
      // Parse duration (e.g., "10 days", "2 weeks", "1 month")
      const durationMatch = prescription.duration.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
      if (durationMatch) {
        const value = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        endDate = new Date(startDate);
        if (unit.includes('day')) {
          endDate.setDate(endDate.getDate() + value);
        } else if (unit.includes('week')) {
          endDate.setDate(endDate.getDate() + (value * 7));
        } else if (unit.includes('month')) {
          endDate.setMonth(endDate.getMonth() + value);
        }
      }
    }
    
    const dispenseRequest: fhir.MedicationRequestDispenseRequest = {
      quantity: {
        value: prescription.quantity,
        unit: prescription.form ? this.mapFormToUnit(prescription.form) : 'unit',
        system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
      },
      numberOfRepeatsAllowed: prescription.refills || 0,
      expectedSupplyDuration: endDate
        ? {
            value: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
            unit: 'days',
            system: 'http://unitsofmeasure.org',
            code: 'd',
          }
        : undefined,
    };
    
    // Build reason reference if indication exists
    const reasonCode: fhir.CodeableConcept[] | undefined = prescription.indication
      ? [{
          text: prescription.indication,
        }]
      : undefined;
    
    return {
      resourceType: 'MedicationRequest',
      id: prescription.id,
      meta: {
        versionId: '1',
        lastUpdated: prescription.createdAt.toISOString(),
      },
      status,
      intent,
      priority,
      medicationCodeableConcept,
      subject: {
        reference: `Patient/${prescription.patientId}`,
      },
      authoredOn: (prescription.prescribedDate || prescription.createdAt).toISOString(),
      requester: {
        reference: `Practitioner/${prescription.prescriberId}`,
      },
      dosageInstruction: [dosageInstruction],
      dispenseRequest,
      reasonCode,
      note: prescription.pharmacyNotes ? [{
        text: prescription.pharmacyNotes,
      }] : undefined,
    };
  }
  
  /**
   * Convert FHIR MedicationRequest to Prescription entity data
   */
  static fromFhir(fhirMedicationRequest: fhir.MedicationRequest, tenantId?: string): Partial<Prescription> {
    const medication = fhirMedicationRequest.medicationCodeableConcept || 
                      (fhirMedicationRequest.medicationReference ? {} : {});
    
    const medicationName = medication.text || 
                          medication.coding?.[0]?.display || 
                          'Unknown Medication';
    
    const rxnormCode = medication.coding?.find(c => c.system?.includes('rxnorm'))?.code;
    const snomedCode = medication.coding?.find(c => c.system?.includes('snomed'))?.code;
    
    const dosageInstruction = fhirMedicationRequest.dosageInstruction?.[0];
    const dosage = dosageInstruction?.doseAndRate?.[0]?.doseQuantity?.value?.toString() || '';
    const route = dosageInstruction?.route?.text || dosageInstruction?.route?.coding?.[0]?.display || '';
    const frequency = this.extractFrequency(dosageInstruction);
    
    const dispenseRequest = fhirMedicationRequest.dispenseRequest;
    const quantity = dispenseRequest?.quantity?.value || 1;
    const refills = dispenseRequest?.numberOfRepeatsAllowed || 0;
    
    const startDate = fhirMedicationRequest.authoredOn 
      ? new Date(fhirMedicationRequest.authoredOn)
      : new Date();
    
    // Calculate duration from expectedSupplyDuration if available
    let duration: string | undefined;
    if (dispenseRequest?.expectedSupplyDuration?.value) {
      const days = dispenseRequest.expectedSupplyDuration.value;
      duration = `${days} ${days === 1 ? 'day' : 'days'}`;
    }
    
    return {
      medicationName,
      medicationNameRxnormCode: rxnormCode,
      medicationNameSnomedCode: snomedCode,
      dosage,
      frequency,
      route,
      quantity,
      refills,
      startDate,
      duration,
      instructions: dosageInstruction?.text || dosageInstruction?.additionalInstruction?.[0]?.text,
      indication: fhirMedicationRequest.reasonCode?.[0]?.text,
      status: this.mapStatusFromFhir(fhirMedicationRequest.status),
      pharmacyNotes: fhirMedicationRequest.note?.[0]?.text,
    };
  }
  
  /**
   * Map PrescriptionStatus to FHIR MedicationRequest status
   */
  private static mapStatus(status: PrescriptionStatus): fhir.MedicationRequest['status'] {
    const statusMap: Record<PrescriptionStatus, fhir.MedicationRequest['status']> = {
      [PrescriptionStatus.ACTIVE]: 'active',
      [PrescriptionStatus.COMPLETED]: 'completed',
      [PrescriptionStatus.CANCELLED]: 'cancelled',
      [PrescriptionStatus.EXPIRED]: 'stopped',
    };
    return statusMap[status] || 'unknown';
  }
  
  /**
   * Map FHIR MedicationRequest status to PrescriptionStatus
   */
  private static mapStatusFromFhir(status?: fhir.MedicationRequest['status']): PrescriptionStatus {
    const statusMap: Record<string, PrescriptionStatus> = {
      'active': PrescriptionStatus.ACTIVE,
      'completed': PrescriptionStatus.COMPLETED,
      'cancelled': PrescriptionStatus.CANCELLED,
      'stopped': PrescriptionStatus.EXPIRED,
      'entered-in-error': PrescriptionStatus.CANCELLED,
      'draft': PrescriptionStatus.ACTIVE,
      'on-hold': PrescriptionStatus.ACTIVE,
    };
    return statusMap[status || 'active'] || PrescriptionStatus.ACTIVE;
  }
  
  /**
   * Build dosage text from prescription
   */
  private static buildDosageText(prescription: Prescription): string {
    const parts: string[] = [];
    if (prescription.dosage) parts.push(prescription.dosage);
    if (prescription.strength) parts.push(prescription.strength);
    if (prescription.form) parts.push(prescription.form);
    if (prescription.frequency) parts.push(prescription.frequency);
    if (prescription.route) parts.push(`via ${prescription.route}`);
    return parts.join(' ');
  }
  
  /**
   * Parse frequency string to number
   */
  private static parseFrequency(frequency: string): number {
    // Examples: "twice daily" = 2, "once daily" = 1, "every 8 hours" = 3
    const lower = frequency.toLowerCase();
    if (lower.includes('twice') || lower.includes('2x')) return 2;
    if (lower.includes('three times') || lower.includes('3x')) return 3;
    if (lower.includes('four times') || lower.includes('4x')) return 4;
    if (lower.includes('every 8 hours') || lower.includes('q8h')) return 3;
    if (lower.includes('every 6 hours') || lower.includes('q6h')) return 4;
    if (lower.includes('every 12 hours') || lower.includes('q12h')) return 2;
    return 1; // default to once daily
  }
  
  /**
   * Extract frequency from FHIR dosage instruction
   */
  private static extractFrequency(dosageInstruction?: fhir.Dosage): string {
    if (!dosageInstruction?.timing?.repeat) return 'once daily';
    const freq = dosageInstruction.timing.repeat.frequency || 1;
    const period = dosageInstruction.timing.repeat.period || 1;
    const periodUnit = dosageInstruction.timing.repeat.periodUnit || 'd';
    
    if (periodUnit === 'd' && period === 1) {
      if (freq === 1) return 'once daily';
      if (freq === 2) return 'twice daily';
      if (freq === 3) return 'three times daily';
      if (freq === 4) return 'four times daily';
      return `${freq} times daily`;
    }
    
    if (periodUnit === 'h') {
      return `every ${period} hours`;
    }
    
    return `${freq} times per ${period} ${periodUnit}`;
  }
  
  /**
   * Parse dosage value
   */
  private static parseDosage(dosage: string): number {
    const match = dosage.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 1;
  }
  
  /**
   * Map route to SNOMED code
   */
  private static mapRouteToSnomed(route: string): string {
    const routeMap: Record<string, string> = {
      'oral': '26643006',
      'intravenous': '47625008',
      'intramuscular': '78421000',
      'subcutaneous': '34206005',
      'topical': '6064005',
      'inhalation': '26643006',
      'rectal': '37161004',
      'vaginal': '16857009',
    };
    return routeMap[route.toLowerCase()] || '26643006'; // default to oral
  }
  
  /**
   * Map form to unit
   */
  private static mapFormToUnit(form: string): string {
    const formMap: Record<string, string> = {
      'tablet': 'tablet',
      'capsule': 'capsule',
      'liquid': 'ml',
      'injection': 'ml',
      'cream': 'g',
      'ointment': 'g',
      'drops': 'drops',
      'inhaler': 'dose',
      'patch': 'patch',
    };
    return formMap[form.toLowerCase()] || 'unit';
  }

  /**
   * Map unit back to form
   */
  private static mapUnitToForm(unit: string): string {
    const unitMap: Record<string, string> = {
      'tablet': 'tablet',
      'capsule': 'capsule',
      'ml': 'liquid',
      'g': 'cream',
      'drops': 'drops',
      'dose': 'inhaler',
      'patch': 'patch',
    };
    return unitMap[unit.toLowerCase()] || 'tablet'; // default to tablet
  }
}

