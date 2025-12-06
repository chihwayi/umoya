import { Problem } from '../../entities/problem.entity';
import type * as fhir from 'fhir/r4';

export class ConditionMapper {
  /**
   * Convert Problem entity to FHIR Condition resource
   */
  static toFhir(problem: Problem, tenantId?: string): fhir.Condition {
    // Map clinical status
    const clinicalStatus: fhir.CodeableConcept = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: problem.status === 'resolved' ? 'resolved' : 'active',
        display: problem.status === 'resolved' ? 'Resolved' : 'Active',
      }],
    };
    
    // Map verification status (default to confirmed)
    const verificationStatus: fhir.CodeableConcept = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: 'confirmed',
        display: 'Confirmed',
      }],
    };
    
    // Map category (default to problem-list-item)
    const category: fhir.CodeableConcept[] = [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-category',
        code: 'problem-list-item',
        display: 'Problem List Item',
      }],
      text: 'Problem List Item',
    }];
    
    // Build code (SNOMED preferred)
    const code: fhir.CodeableConcept = {
      coding: [],
      text: problem.description,
    };
    
    if (problem.snomedConceptId) {
      code.coding.push({
        system: 'http://snomed.info/sct',
        code: problem.snomedConceptId,
        display: problem.snomedTerm || problem.description,
      });
    }
    
    if (problem.code && problem.codeSystem) {
      const system = this.mapCodeSystem(problem.codeSystem);
      if (system) {
        code.coding.push({
          system,
          code: problem.code,
          display: problem.description,
        });
      }
    }
    
    // Build subject (patient)
    const subject: fhir.Reference = {
      reference: `Patient/${problem.patientId}`,
    };
    if (tenantId) {
      subject.identifier = {
        system: `http://${tenantId}.co.zw/patients`,
        value: problem.patientId,
      };
    }
    
    // Build onset date/time
    const onsetDateTime = problem.onsetDate 
      ? (problem.onsetDate instanceof Date ? problem.onsetDate.toISOString() : new Date(problem.onsetDate).toISOString())
      : undefined;
    
    // Build abatement date/time (when resolved)
    const abatementDateTime = problem.resolvedDate 
      ? (problem.resolvedDate instanceof Date ? problem.resolvedDate.toISOString() : new Date(problem.resolvedDate).toISOString())
      : undefined;
    
    // Build severity (if available in notes or could be extracted)
    const severity: fhir.CodeableConcept | undefined = this.extractSeverity(problem.notes);
    
    return {
      resourceType: 'Condition',
      id: problem.id,
      meta: {
        versionId: '1',
        lastUpdated: problem.updatedAt?.toISOString() || problem.createdAt.toISOString(),
      },
      clinicalStatus,
      verificationStatus,
      category,
      code,
      subject,
      onsetDateTime,
      abatementDateTime,
      severity,
      recordedDate: problem.createdAt.toISOString(),
      note: problem.notes ? [{
        text: problem.notes,
      }] : undefined,
    };
  }
  
  /**
   * Convert FHIR Condition to Problem entity data
   */
  static fromFhir(fhirCondition: fhir.Condition, tenantId?: string): Partial<Problem> {
    const code = fhirCondition.code;
    const description = code?.text || code?.coding?.[0]?.display || 'Unknown Condition';
    
    // Extract SNOMED code
    const snomedCode = code?.coding?.find(c => c.system?.includes('snomed'))?.code;
    const snomedTerm = code?.coding?.find(c => c.system?.includes('snomed'))?.display || description;
    
    // Extract other codes
    const otherCode = code?.coding?.find(c => !c.system?.includes('snomed'));
    const codeValue = otherCode?.code;
    const codeSystem = otherCode ? this.mapSystemToCodeSystem(otherCode.system || '') : 'SNOMED_CT';
    
    // Map clinical status
    const clinicalStatus = fhirCondition.clinicalStatus?.coding?.[0]?.code || 'active';
    const status: 'active' | 'resolved' = clinicalStatus === 'resolved' || clinicalStatus === 'inactive' ? 'resolved' : 'active';
    
    // Extract dates
    const onsetDate = fhirCondition.onsetDateTime ? new Date(fhirCondition.onsetDateTime) : null;
    const resolvedDate = fhirCondition.abatementDateTime ? new Date(fhirCondition.abatementDateTime) : null;
    
    // Extract notes
    const notes = fhirCondition.note?.[0]?.text || undefined;
    
    // Extract severity (store in notes if not already there)
    let finalNotes = notes;
    if (fhirCondition.severity && !notes?.includes('Severity:')) {
      const severityText = fhirCondition.severity.coding?.[0]?.display || fhirCondition.severity.text;
      finalNotes = notes ? `${notes}\nSeverity: ${severityText}` : `Severity: ${severityText}`;
    }
    
    return {
      code: codeValue || snomedCode,
      codeSystem,
      snomedConceptId: snomedCode,
      snomedTerm,
      description,
      status,
      onsetDate,
      resolvedDate,
      notes: finalNotes,
    };
  }
  
  /**
   * Map code system string to FHIR system URI
   */
  private static mapCodeSystem(codeSystem: string): string | undefined {
    const systemMap: Record<string, string> = {
      'SNOMED_CT': 'http://snomed.info/sct',
      'ICD10': 'http://hl7.org/fhir/sid/icd-10',
      'ICD10CM': 'http://hl7.org/fhir/sid/icd-10-cm',
      'ICD9': 'http://hl7.org/fhir/sid/icd-9-cm',
      'LOINC': 'http://loinc.org',
      'RXNORM': 'http://www.nlm.nih.gov/research/umls/rxnorm',
    };
    return systemMap[codeSystem.toUpperCase()] || undefined;
  }
  
  /**
   * Map FHIR system URI to code system string
   */
  private static mapSystemToCodeSystem(system: string): string {
    if (system.includes('snomed')) return 'SNOMED_CT';
    if (system.includes('icd-10-cm')) return 'ICD10CM';
    if (system.includes('icd-10')) return 'ICD10';
    if (system.includes('icd-9')) return 'ICD9';
    if (system.includes('loinc')) return 'LOINC';
    if (system.includes('rxnorm')) return 'RXNORM';
    return 'SNOMED_CT';
  }
  
  /**
   * Extract severity from notes or return undefined
   */
  private static extractSeverity(notes?: string | null): fhir.CodeableConcept | undefined {
    if (!notes) return undefined;
    
    const lowerNotes = notes.toLowerCase();
    if (lowerNotes.includes('severe') || lowerNotes.includes('severity: severe')) {
      return {
        coding: [{
          system: 'http://snomed.info/sct',
          code: '24484000',
          display: 'Severe',
        }],
        text: 'Severe',
      };
    }
    if (lowerNotes.includes('moderate') || lowerNotes.includes('severity: moderate')) {
      return {
        coding: [{
          system: 'http://snomed.info/sct',
          code: '6736007',
          display: 'Moderate',
        }],
        text: 'Moderate',
      };
    }
    if (lowerNotes.includes('mild') || lowerNotes.includes('severity: mild')) {
      return {
        coding: [{
          system: 'http://snomed.info/sct',
          code: '255604002',
          display: 'Mild',
        }],
        text: 'Mild',
      };
    }
    return undefined;
  }
}

