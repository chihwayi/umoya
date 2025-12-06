import { Injectable, BadRequestException } from '@nestjs/common';
import type * as fhir from 'fhir/r4';

@Injectable()
export class FhirValidatorService {
  /**
   * Validate a FHIR resource
   */
  async validateResource(resource: any, resourceType: string): Promise<void> {
    // Basic validation
    if (!resource) {
      throw new BadRequestException('Resource is required');
    }

    if (!resource.resourceType) {
      throw new BadRequestException('Resource must have resourceType');
    }

    if (resource.resourceType !== resourceType) {
      throw new BadRequestException(
        `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}`
      );
    }

    // Resource-specific validation
    switch (resourceType) {
      case 'Patient':
        this.validatePatient(resource);
        break;
      case 'Encounter':
        this.validateEncounter(resource);
        break;
      case 'Observation':
        this.validateObservation(resource);
        break;
      case 'MedicationRequest':
        this.validateMedicationRequest(resource);
        break;
      case 'Condition':
        this.validateCondition(resource);
        break;
      case 'Procedure':
        this.validateProcedure(resource);
        break;
      case 'DiagnosticReport':
        this.validateDiagnosticReport(resource);
        break;
      default:
        // For unknown resource types, do basic validation only
        break;
    }
  }

  /**
   * Validate FHIR Patient resource
   */
  private validatePatient(patient: fhir.Patient): void {
    if (!patient.name || patient.name.length === 0) {
      throw new BadRequestException('Patient must have at least one name');
    }

    const officialName = patient.name.find(n => n.use === 'official') || patient.name[0];
    if (!officialName.family) {
      throw new BadRequestException('Patient must have a family name');
    }

    if (!officialName.given || officialName.given.length === 0) {
      throw new BadRequestException('Patient must have at least one given name');
    }

    if (!patient.gender) {
      throw new BadRequestException('Patient must have a gender');
    }

    const validGenders = ['male', 'female', 'other', 'unknown'];
    if (!validGenders.includes(patient.gender)) {
      throw new BadRequestException(`Invalid gender: ${patient.gender}. Must be one of: ${validGenders.join(', ')}`);
    }

    if (!patient.birthDate) {
      throw new BadRequestException('Patient must have a birthDate');
    }

    // Validate birthDate format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(patient.birthDate)) {
      throw new BadRequestException('birthDate must be in format YYYY-MM-DD');
    }

    // Validate birthDate is not in the future
    const birthDate = new Date(patient.birthDate);
    if (birthDate > new Date()) {
      throw new BadRequestException('birthDate cannot be in the future');
    }
  }

  /**
   * Validate FHIR Encounter resource
   */
  private validateEncounter(encounter: fhir.Encounter): void {
    if (!encounter.status) {
      throw new BadRequestException('Encounter must have a status');
    }

    const validStatuses = [
      'planned', 'arrived', 'triaged', 'in-progress',
      'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown'
    ];
    if (!validStatuses.includes(encounter.status)) {
      throw new BadRequestException(`Invalid encounter status: ${encounter.status}`);
    }

    if (!encounter.class) {
      throw new BadRequestException('Encounter must have a class');
    }

    if (!encounter.subject) {
      throw new BadRequestException('Encounter must have a subject (patient reference)');
    }
  }

  /**
   * Validate FHIR Observation resource
   */
  private validateObservation(observation: fhir.Observation): void {
    if (!observation.status) {
      throw new BadRequestException('Observation must have a status');
    }

    const validStatuses = [
      'registered', 'preliminary', 'final', 'amended',
      'corrected', 'cancelled', 'entered-in-error', 'unknown'
    ];
    if (!validStatuses.includes(observation.status)) {
      throw new BadRequestException(`Invalid observation status: ${observation.status}`);
    }

    if (!observation.code) {
      throw new BadRequestException('Observation must have a code');
    }

    if (!observation.subject) {
      throw new BadRequestException('Observation must have a subject (patient reference)');
    }
  }

  /**
   * Validate FHIR MedicationRequest resource
   */
  private validateMedicationRequest(medicationRequest: fhir.MedicationRequest): void {
    if (!medicationRequest.status) {
      throw new BadRequestException('MedicationRequest must have a status');
    }

    if (!medicationRequest.intent) {
      throw new BadRequestException('MedicationRequest must have an intent');
    }

    if (!medicationRequest.subject) {
      throw new BadRequestException('MedicationRequest must have a subject (patient reference)');
    }

    if (!medicationRequest.medicationCodeableConcept && !medicationRequest.medicationReference) {
      throw new BadRequestException('MedicationRequest must have either medicationCodeableConcept or medicationReference');
    }
  }

  /**
   * Validate FHIR Condition resource
   */
  private validateCondition(condition: fhir.Condition): void {
    if (!condition.clinicalStatus) {
      throw new BadRequestException('Condition must have a clinicalStatus');
    }

    if (!condition.code) {
      throw new BadRequestException('Condition must have a code');
    }

    if (!condition.subject) {
      throw new BadRequestException('Condition must have a subject (patient reference)');
    }
  }

  /**
   * Validate FHIR Procedure resource
   */
  private validateProcedure(procedure: fhir.Procedure): void {
    if (!procedure.status) {
      throw new BadRequestException('Procedure must have a status');
    }

    if (!procedure.code) {
      throw new BadRequestException('Procedure must have a code');
    }

    if (!procedure.subject) {
      throw new BadRequestException('Procedure must have a subject (patient reference)');
    }
  }

  /**
   * Validate FHIR DiagnosticReport resource
   */
  private validateDiagnosticReport(diagnosticReport: fhir.DiagnosticReport): void {
    if (!diagnosticReport.status) {
      throw new BadRequestException('DiagnosticReport must have a status');
    }

    if (!diagnosticReport.code) {
      throw new BadRequestException('DiagnosticReport must have a code');
    }

    if (!diagnosticReport.subject) {
      throw new BadRequestException('DiagnosticReport must have a subject (patient reference)');
    }
  }

  /**
   * Extract ID from FHIR reference
   */
  extractIdFromReference(reference: string | fhir.Reference | undefined): string | undefined {
    if (!reference) return undefined;
    
    if (typeof reference === 'string') {
      // Format: "ResourceType/id" or just "id"
      const parts = reference.split('/');
      return parts.length > 1 ? parts[parts.length - 1] : parts[0];
    }
    
    if (reference.reference) {
      const parts = reference.reference.split('/');
      return parts.length > 1 ? parts[parts.length - 1] : parts[0];
    }
    
    return undefined;
  }
}

