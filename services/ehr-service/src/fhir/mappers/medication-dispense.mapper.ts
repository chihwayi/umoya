import { PharmacyDispensing, DispensingStatus, PaymentStatus } from '../../entities/pharmacy-dispensing.entity';
import { PharmacyDispensingItem } from '../../entities/pharmacy-dispensing-item.entity';
import { Prescription } from '../../entities/prescription.entity';
import type * as fhir from 'fhir/r4';

export class MedicationDispenseMapper {
  /**
   * Convert PharmacyDispensing entity to FHIR MedicationDispense resource
   */
  static toFhir(
    dispensing: PharmacyDispensing,
    items?: PharmacyDispensingItem[],
    prescription?: Prescription,
    tenantId?: string
  ): fhir.MedicationDispense {
    // Map status
    const status = this.mapStatus(dispensing.status);

    // Build medication reference from items
    const medicationReference: fhir.Reference[] = [];
    if (items && items.length > 0) {
      items.forEach(item => {
        // Safely access drug - it may not be loaded
        const drug = (item as any).drug;
        if (drug && drug.id) {
          medicationReference.push({
            reference: `Medication/${drug.id}`,
            display: drug.genericName || drug.rxnormName || 'Unknown Medication',
          });
        } else {
          // No drug or rxnormCode available - use generic reference
          medicationReference.push({
            reference: `Medication?name=Unknown`,
            display: 'Unknown Medication',
          });
        }
      });
    } else if (prescription?.medicationName) {
      // Fallback to prescription medication name
      medicationReference.push({
        reference: prescription.medicationNameRxnormCode 
          ? `Medication?code=${prescription.medicationNameRxnormCode}`
          : `Medication?name=${encodeURIComponent(prescription.medicationName)}`,
        display: prescription.medicationName,
      });
    }

    // Build subject (patient) reference
    const subject: fhir.Reference = {
      reference: `Patient/${dispensing.patientId}`,
    };

    // Build performer (pharmacist) reference
    const performer: fhir.MedicationDispensePerformer[] = [];
    if (dispensing.dispensedById) {
      performer.push({
        actor: {
          reference: `Practitioner/${dispensing.dispensedById}`,
        },
      });
    }

    // Build authorizing prescription reference
    const authorizingPrescription: fhir.Reference[] = [];
    if (dispensing.prescriptionId) {
      authorizingPrescription.push({
        reference: `MedicationRequest/${dispensing.prescriptionId}`,
      });
    }

    // Build quantity dispensed from items
    let quantity: fhir.Quantity | undefined;
    if (items && items.length > 0) {
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantityDispensed || 0), 0);
      const firstItem = items[0];
      // Safely access drug - it may not be loaded
      const drug = (firstItem as any).drug;
      quantity = {
        value: totalQuantity,
        unit: this.getUnitFromDrug(drug) || 'unit',
        system: 'http://unitsofmeasure.org',
      };
    }

    // Build days supply (if available from prescription)
    let daysSupply: fhir.Quantity | undefined;
    if (prescription?.duration) {
      const daysMatch = prescription.duration.match(/(\d+)\s*(day|days)/i);
      if (daysMatch) {
        daysSupply = {
          value: parseInt(daysMatch[1]),
          unit: 'days',
          system: 'http://unitsofmeasure.org',
          code: 'd',
        };
      }
    }

    // Build dosage instruction from prescription
    const dosageInstruction: fhir.Dosage[] = [];
    if (prescription) {
      dosageInstruction.push({
        text: this.buildDosageText(prescription),
        timing: {
          repeat: {
            frequency: this.parseFrequency(prescription.frequency),
            period: 1,
            periodUnit: 'd',
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
        additionalInstruction: prescription.instructions ? [{
          text: prescription.instructions,
        }] : undefined,
      });
    }

    // Build substitution information
    const substitution: fhir.MedicationDispenseSubstitution = {
      wasSubstituted: false, // Default - can be enhanced if substitution tracking is added
      reason: undefined,
      type: undefined,
    };

    // Build note from dispensing notes
    const note: fhir.Annotation[] = [];
    if (dispensing.notes) {
      note.push({
        text: dispensing.notes,
        time: dispensing.updatedAt?.toISOString() || dispensing.createdAt.toISOString(),
      });
    }

    // Add item notes
    if (items) {
      items.forEach(item => {
        if (item.notes) {
          note.push({
            text: `Item: ${item.notes}`,
            time: item.updatedAt?.toISOString() || item.createdAt.toISOString(),
          });
        }
        // Note: instructions column doesn't exist in database
        // if (item.instructions) {
        //   note.push({
        //     text: `Instructions: ${item.instructions}`,
        //     time: item.updatedAt?.toISOString() || item.createdAt.toISOString(),
        //   });
        // }
      });
    }

    return {
      resourceType: 'MedicationDispense',
      id: dispensing.id,
      meta: {
        versionId: '1',
        lastUpdated: dispensing.updatedAt?.toISOString() || dispensing.createdAt.toISOString(),
      },
      status,
      medicationReference: medicationReference.length > 0 ? medicationReference[0] : undefined,
      subject,
      performer: performer.length > 0 ? performer : undefined,
      authorizingPrescription: authorizingPrescription.length > 0 ? authorizingPrescription : undefined,
      quantity,
      daysSupply,
      whenPrepared: dispensing.dispensingDate 
        ? (typeof dispensing.dispensingDate === 'string' 
            ? dispensing.dispensingDate 
            : new Date(dispensing.dispensingDate).toISOString())
        : dispensing.createdAt.toISOString(),
      whenHandedOver: dispensing.status === 'dispensed' 
        ? (dispensing.updatedAt 
            ? (typeof dispensing.updatedAt === 'string' 
                ? dispensing.updatedAt 
                : dispensing.updatedAt.toISOString())
            : dispensing.createdAt.toISOString())
        : undefined,
      destination: {
        reference: `Location/pharmacy`,
        display: 'Pharmacy',
      },
      receiver: [subject], // Patient receives the medication
      dosageInstruction: dosageInstruction.length > 0 ? dosageInstruction : undefined,
      substitution,
      note: note.length > 0 ? note : undefined,
      // Extension for payment status
      extension: dispensing.paymentStatus && dispensing.paymentStatus !== 'pending' ? [
        {
          url: 'http://medicore.health/fhir/StructureDefinition/payment-status',
          valueCode: dispensing.paymentStatus,
        },
      ] : undefined,
    };
  }

  /**
   * Convert FHIR MedicationDispense to PharmacyDispensing entity data
   */
  static fromFhir(fhirDispense: fhir.MedicationDispense): Partial<PharmacyDispensing> {
    const patientId = this.extractId(fhirDispense.subject?.reference);
    const prescriptionId = fhirDispense.authorizingPrescription?.[0] 
      ? this.extractId(fhirDispense.authorizingPrescription[0].reference)
      : undefined;
    const dispensedById = fhirDispense.performer?.[0]
      ? this.extractId(fhirDispense.performer[0].actor?.reference)
      : undefined;

    const dispensingDate = fhirDispense.whenPrepared 
      ? new Date(fhirDispense.whenPrepared)
      : new Date();

    const status = this.mapStatusFromFhir(fhirDispense.status);

    // Extract payment status from extension
    const paymentStatus = fhirDispense.extension
      ?.find(ext => ext.url === 'http://medicore.health/fhir/StructureDefinition/payment-status')
      ?.valueCode as PaymentStatus | undefined;

    // Extract notes
    const notes = fhirDispense.note?.map(n => n.text).join('\n');

    return {
      patientId: patientId || '',
      prescriptionId,
      dispensedById,
      dispensingDate,
      status: status || 'pending',
      paymentStatus: paymentStatus || 'pending',
      notes,
      // Generate dispensing number if not provided (optional field)
      // Note: dispensing_number column may not exist in all tenant databases
      // dispensingNumber: fhirDispense.identifier?.[0]?.value || `DISP-${Date.now()}`,
    };
  }

  /**
   * Map DispensingStatus to FHIR MedicationDispense status
   */
  private static mapStatus(status: DispensingStatus): fhir.MedicationDispense['status'] {
    const statusMap: Record<DispensingStatus, fhir.MedicationDispense['status']> = {
      'pending': 'preparation',
      'dispensed': 'completed',
      'partial': 'in-progress',
      'cancelled': 'cancelled',
      'returned': 'entered-in-error',
    };
    return statusMap[status] || 'unknown';
  }

  /**
   * Map FHIR MedicationDispense status to DispensingStatus
   */
  private static mapStatusFromFhir(status?: fhir.MedicationDispense['status']): DispensingStatus {
    const statusMap: Record<string, DispensingStatus> = {
      'preparation': 'pending',
      'in-progress': 'partial',
      'completed': 'dispensed',
      'cancelled': 'cancelled',
      'entered-in-error': 'returned',
      'on-hold': 'pending',
      'stopped': 'cancelled',
      'declined': 'cancelled',
      'unknown': 'pending',
    };
    return statusMap[status || 'preparation'] || 'pending';
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
    const lower = frequency.toLowerCase();
    if (lower.includes('twice') || lower.includes('2x')) return 2;
    if (lower.includes('three times') || lower.includes('3x')) return 3;
    if (lower.includes('four times') || lower.includes('4x')) return 4;
    if (lower.includes('every 8 hours') || lower.includes('q8h')) return 3;
    if (lower.includes('every 6 hours') || lower.includes('q6h')) return 4;
    if (lower.includes('every 12 hours') || lower.includes('q12h')) return 2;
    return 1;
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
    return routeMap[route.toLowerCase()] || '26643006';
  }

  /**
   * Get unit from drug
   */
  private static getUnitFromDrug(drug: any): string | undefined {
    if (!drug) return undefined;
    // Safely access drug properties
    const safeDrug = drug && typeof drug === 'object' ? drug : null;
    if (!safeDrug) return undefined;
    return safeDrug.unit || (safeDrug.dosageForms?.[0] === 'tablet' ? 'tablet' : 'unit');
  }

  /**
   * Extract ID from reference string
   */
  private static extractId(reference?: string | null): string | undefined {
    if (!reference) return undefined;
    const parts = reference.split('/');
    return parts[parts.length - 1] || undefined;
  }
}

