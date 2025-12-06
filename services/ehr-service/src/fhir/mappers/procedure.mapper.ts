import { SurgicalCase } from '../../entities/surgical-case.entity';
import type * as fhir from 'fhir/r4';

export class ProcedureMapper {
  /**
   * Convert SurgicalCase entity to FHIR Procedure resource
   */
  static toFhir(surgicalCase: SurgicalCase, tenantId?: string): fhir.Procedure {
    // Map status
    const status: fhir.Procedure['status'] = this.mapStatus(surgicalCase.status);

    // Build code (procedure)
    const code: fhir.CodeableConcept = {
      coding: [],
      text: surgicalCase.procedureName,
    };

    // Add CPT code if available
    if (surgicalCase.procedureCodeCpt) {
      code.coding.push({
        system: 'http://www.ama-assn.org/go/cpt',
        code: surgicalCase.procedureCodeCpt,
        display: surgicalCase.procedureName,
      });
    }

    // Add SNOMED code if available
    if (surgicalCase.procedureCodeSnomed) {
      code.coding.push({
        system: 'http://snomed.info/sct',
        code: surgicalCase.procedureCodeSnomed,
        display: surgicalCase.procedureName,
      });
    }

    // Build subject (patient)
    const subject: fhir.Reference = {
      reference: `Patient/${surgicalCase.patientId}`,
    };
    if (tenantId) {
      subject.identifier = {
        system: `http://${tenantId}.co.zw/patients`,
        value: surgicalCase.patientId,
      };
    }

    // Build performed period (actual start/end time)
    const performedPeriod: fhir.Period | undefined = 
      surgicalCase.actualStartTime && surgicalCase.actualEndTime
        ? {
            start: surgicalCase.actualStartTime.toISOString(),
            end: surgicalCase.actualEndTime.toISOString(),
          }
        : surgicalCase.actualStartTime
        ? {
            start: surgicalCase.actualStartTime.toISOString(),
          }
        : surgicalCase.scheduledDate
        ? {
            start: `${surgicalCase.scheduledDate.toISOString().split('T')[0]}T${surgicalCase.scheduledStartTime}`,
          }
        : undefined;

    // Build performed dateTime (fallback if no period)
    const performedDateTime: string | undefined = 
      !performedPeriod && surgicalCase.actualStartTime
        ? surgicalCase.actualStartTime.toISOString()
        : !performedPeriod && surgicalCase.scheduledDate
        ? `${surgicalCase.scheduledDate.toISOString().split('T')[0]}T${surgicalCase.scheduledStartTime}`
        : undefined;

    // Build performer (surgeons and staff)
    const performer: fhir.ProcedurePerformer[] = [];
    
    if (surgicalCase.primarySurgeonId) {
      performer.push({
        function: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '304292004',
            display: 'Surgeon',
          }],
          text: 'Primary Surgeon',
        },
        actor: {
          reference: `Practitioner/${surgicalCase.primarySurgeonId}`,
        },
      });
    }

    if (surgicalCase.assistantSurgeonId) {
      performer.push({
        function: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '304292004',
            display: 'Surgeon',
          }],
          text: 'Assistant Surgeon',
        },
        actor: {
          reference: `Practitioner/${surgicalCase.assistantSurgeonId}`,
        },
      });
    }

    if (surgicalCase.anesthesiologistId) {
      performer.push({
        function: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '309343006',
            display: 'Anesthesiologist',
          }],
          text: 'Anesthesiologist',
        },
        actor: {
          reference: `Practitioner/${surgicalCase.anesthesiologistId}`,
        },
      });
    }

    // Build reason reference (diagnosis)
    const reasonReference: fhir.Reference[] = [];
    if (surgicalCase.primaryDiagnosis) {
      reasonReference.push({
        display: surgicalCase.primaryDiagnosis,
      });
    }

    // Build body site (laterality)
    const bodySite: fhir.CodeableConcept[] | undefined = surgicalCase.laterality
      ? [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: this.mapLateralityToSnomed(surgicalCase.laterality),
            display: surgicalCase.laterality,
          }],
          text: surgicalCase.laterality,
        }]
      : undefined;

    // Build outcome
    const outcome: fhir.CodeableConcept | undefined = surgicalCase.complications
      ? {
          text: surgicalCase.complications,
        }
      : surgicalCase.disposition
      ? {
          text: surgicalCase.disposition,
        }
      : undefined;

    // Build note
    const note: fhir.Annotation[] = [];
    if (surgicalCase.notes) {
      note.push({
        text: surgicalCase.notes,
        time: surgicalCase.updatedAt?.toISOString() || surgicalCase.createdAt.toISOString(),
      });
    }
    if (surgicalCase.findings) {
      note.push({
        text: `Findings: ${surgicalCase.findings}`,
        time: surgicalCase.updatedAt?.toISOString() || surgicalCase.createdAt.toISOString(),
      });
    }
    if (surgicalCase.procedurePerformed) {
      note.push({
        text: `Procedure Performed: ${surgicalCase.procedurePerformed}`,
        time: surgicalCase.updatedAt?.toISOString() || surgicalCase.createdAt.toISOString(),
      });
    }

    // Build location (operating room)
    const location: fhir.Reference | undefined = surgicalCase.operatingRoomId
      ? {
          reference: `Location/${surgicalCase.operatingRoomId}`,
          display: surgicalCase.operatingRoom?.roomName || 'Operating Room',
        }
      : undefined;

    return {
      resourceType: 'Procedure',
      id: surgicalCase.id,
      meta: {
        versionId: '1',
        lastUpdated: surgicalCase.updatedAt?.toISOString() || surgicalCase.createdAt.toISOString(),
      },
      status,
      code,
      subject,
      performedPeriod,
      performedDateTime,
      performer: performer.length > 0 ? performer : undefined,
      location,
      reasonReference: reasonReference.length > 0 ? reasonReference : undefined,
      bodySite,
      outcome,
      note: note.length > 0 ? note : undefined,
      report: surgicalCase.admissionId
        ? [{
            reference: `Encounter/${surgicalCase.admissionId}`,
          }]
        : undefined,
    };
  }

  /**
   * Convert FHIR Procedure to SurgicalCase entity data
   */
  static fromFhir(fhirProcedure: fhir.Procedure, tenantId?: string): Partial<SurgicalCase> {
    const code = fhirProcedure.code;
    const procedureName = code?.text || code?.coding?.[0]?.display || 'Unknown Procedure';
    
    // Extract CPT and SNOMED codes
    const cptCode = code?.coding?.find(c => c.system?.includes('cpt'))?.code;
    const snomedCode = code?.coding?.find(c => c.system?.includes('snomed'))?.code;

    // Extract performed date/time
    const performedDate = fhirProcedure.performedDateTime
      ? new Date(fhirProcedure.performedDateTime)
      : fhirProcedure.performedPeriod?.start
      ? new Date(fhirProcedure.performedPeriod.start)
      : new Date();

    const scheduledDate = new Date(performedDate.toISOString().split('T')[0]);
    const scheduledStartTime = performedDate.toISOString().split('T')[1]?.split('.')[0] || '09:00:00';
    const scheduledEndTime = fhirProcedure.performedPeriod?.end
      ? new Date(fhirProcedure.performedPeriod.end).toISOString().split('T')[1]?.split('.')[0] || '10:00:00'
      : '10:00:00';

    const actualStartTime = fhirProcedure.performedPeriod?.start
      ? new Date(fhirProcedure.performedPeriod.start)
      : fhirProcedure.performedDateTime
      ? new Date(fhirProcedure.performedDateTime)
      : undefined;

    const actualEndTime = fhirProcedure.performedPeriod?.end
      ? new Date(fhirProcedure.performedPeriod.end)
      : undefined;

    // Extract primary surgeon
    const primarySurgeon = fhirProcedure.performer?.find(p => 
      p.function?.text?.toLowerCase().includes('primary') || 
      p.function?.coding?.[0]?.display?.toLowerCase().includes('surgeon')
    );
    const primarySurgeonId = primarySurgeon?.actor?.reference?.split('/')[1];

    // Extract assistant surgeon
    const assistantSurgeon = fhirProcedure.performer?.find(p => 
      p.function?.text?.toLowerCase().includes('assistant')
    );
    const assistantSurgeonId = assistantSurgeon?.actor?.reference?.split('/')[1];

    // Extract anesthesiologist
    const anesthesiologist = fhirProcedure.performer?.find(p => 
      p.function?.coding?.[0]?.display?.toLowerCase().includes('anesthesiologist')
    );
    const anesthesiologistId = anesthesiologist?.actor?.reference?.split('/')[1];

    // Extract diagnosis
    const primaryDiagnosis = fhirProcedure.reasonReference?.[0]?.display || undefined;

    // Extract laterality
    const laterality = fhirProcedure.bodySite?.[0]?.text || fhirProcedure.bodySite?.[0]?.coding?.[0]?.display || undefined;

    // Extract notes
    const notes = fhirProcedure.note?.map(n => n.text).join('\n') || undefined;

    // Extract complications/outcome
    const complications = fhirProcedure.outcome?.text || undefined;

    // Map status
    const status = this.mapStatusFromFhir(fhirProcedure.status);

    return {
      caseNumber: `CASE-${Date.now()}`,
      procedureName,
      procedureCodeCpt: cptCode,
      procedureCodeSnomed: snomedCode,
      primaryDiagnosis,
      laterality,
      scheduledDate,
      scheduledStartTime,
      scheduledEndTime,
      actualStartTime,
      actualEndTime,
      primarySurgeonId: primarySurgeonId || '',
      assistantSurgeonId,
      anesthesiologistId,
      status,
      notes,
      complications,
    };
  }

  /**
   * Map SurgicalCase status to FHIR Procedure status
   */
  private static mapStatus(status: string): fhir.Procedure['status'] {
    const statusMap: Record<string, fhir.Procedure['status']> = {
      'scheduled': 'preparation',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'cancelled': 'not-done',
      'postponed': 'preparation',
      'on-hold': 'on-hold',
    };
    return statusMap[status.toLowerCase()] || 'preparation';
  }

  /**
   * Map FHIR Procedure status to SurgicalCase status
   */
  private static mapStatusFromFhir(status?: fhir.Procedure['status']): string {
    const statusMap: Record<string, string> = {
      'preparation': 'scheduled',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'not-done': 'cancelled',
      'on-hold': 'on-hold',
      'stopped': 'cancelled',
      'entered-in-error': 'cancelled',
    };
    return statusMap[status || 'preparation'] || 'scheduled';
  }

  /**
   * Map laterality to SNOMED code
   */
  private static mapLateralityToSnomed(laterality: string): string {
    const lateralityMap: Record<string, string> = {
      'left': '7771000',
      'right': '24028007',
      'bilateral': '51440002',
    };
    return lateralityMap[laterality.toLowerCase()] || '7771000';
  }
}

