import { Appointment } from '../../entities/appointment.entity';
import { Admission } from '../../entities/admission.entity';
import type * as fhir from 'fhir/r4';

export class EncounterMapper {
  /**
   * Convert Appointment entity to FHIR Encounter resource
   */
  static appointmentToFhir(appointment: Appointment, tenantId?: string): fhir.Encounter {
    const status = this.mapAppointmentStatus(appointment.status);
    const endDate = appointment.actualEndTime || 
      (appointment.appointmentDate && appointment.durationMinutes
        ? new Date(appointment.appointmentDate.getTime() + appointment.durationMinutes * 60000)
        : undefined);

    return {
      resourceType: 'Encounter',
      id: appointment.id,
      meta: {
        versionId: '1',
        lastUpdated: appointment.updatedAt?.toISOString() || appointment.createdAt.toISOString(),
      },
      status,
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: appointment.isTelehealth ? 'VR' : 'AMB',
        display: appointment.isTelehealth ? 'virtual' : 'ambulatory',
      },
      type: appointment.appointmentType ? [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: appointment.appointmentType,
          display: appointment.appointmentType,
        }],
        text: appointment.appointmentType,
      }] : undefined,
      subject: {
        reference: `Patient/${appointment.patientId}`,
      },
      period: {
        start: appointment.appointmentDate.toISOString(),
        end: endDate?.toISOString(),
      },
      participant: appointment.doctorId ? [{
        type: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
            code: 'ATND',
            display: 'attending',
          }],
        }],
        individual: {
          reference: `Practitioner/${appointment.doctorId}`,
        },
      }] : undefined,
      reasonCode: appointment.reason ? [{
        text: appointment.reason,
      }] : undefined,
      extension: [
        ...(appointment.virtualMeetingUrl ? [{
          url: 'http://medicore.health/fhir/StructureDefinition/virtual-meeting-url',
          valueString: appointment.virtualMeetingUrl,
        }] : []),
        ...(appointment.priorityLevel ? [{
          url: 'http://medicore.health/fhir/StructureDefinition/priority-level',
          valueString: appointment.priorityLevel,
        }] : []),
        ...(appointment.waitTimeMinutes ? [{
          url: 'http://medicore.health/fhir/StructureDefinition/wait-time-minutes',
          valueInteger: appointment.waitTimeMinutes,
        }] : []),
      ],
    };
  }

  /**
   * Convert Admission entity to FHIR Encounter resource
   */
  static admissionToFhir(admission: Admission, tenantId?: string): fhir.Encounter {
    const status = this.mapAdmissionStatus(admission.admissionStatus);
    
    return {
      resourceType: 'Encounter',
      id: admission.id,
      meta: {
        versionId: '1',
        lastUpdated: admission.updatedAt?.toISOString() || admission.createdAt.toISOString(),
      },
      status,
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: this.mapAdmissionType(admission.admissionType),
        display: admission.admissionType,
      },
      type: admission.admissionType ? [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: admission.admittingDiagnosisSnomed || admission.admittingDiagnosisIcd10 || '',
          display: admission.admittingDiagnosis,
        }],
        text: admission.admittingDiagnosis,
      }] : undefined,
      subject: {
        reference: `Patient/${admission.patientId}`,
      },
      period: {
        start: admission.admissionDate.toISOString(),
        end: admission.estimatedDischargeDate?.toISOString(),
      },
      participant: admission.admittingProvider ? [{
        type: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
            code: 'ADM',
            display: 'admitting',
          }],
        }],
        individual: {
          reference: `Practitioner/${admission.admittingProvider}`,
        },
      }] : undefined,
      reasonCode: admission.admittingDiagnosis ? [{
        coding: admission.admittingDiagnosisIcd10 ? [{
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: admission.admittingDiagnosisIcd10,
        }] : undefined,
        text: admission.admittingDiagnosis,
      }] : undefined,
      location: admission.currentBedId ? [{
        location: {
          reference: `Location/${admission.currentBedId}`,
        },
        status: 'active',
        period: {
          start: admission.admissionDate.toISOString(),
        },
      }] : undefined,
      extension: [
        ...(admission.admissionNumber ? [{
          url: 'http://medicore.health/fhir/StructureDefinition/admission-number',
          valueString: admission.admissionNumber,
        }] : []),
        ...(admission.admissionSource ? [{
          url: 'http://medicore.health/fhir/StructureDefinition/admission-source',
          valueString: admission.admissionSource,
        }] : []),
        ...(admission.referringFacility ? [{
          url: 'http://medicore.health/fhir/StructureDefinition/referring-facility',
          valueString: admission.referringFacility,
        }] : []),
      ],
    };
  }

  /**
   * Map appointment status to FHIR encounter status
   */
  private static mapAppointmentStatus(status: string): fhir.Encounter['status'] {
    const statusMap: Record<string, fhir.Encounter['status']> = {
      'scheduled': 'planned',
      'confirmed': 'planned',
      'checked-in': 'arrived',
      'in-progress': 'in-progress',
      'completed': 'finished',
      'cancelled': 'cancelled',
      'no-show': 'cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'planned';
  }

  /**
   * Map admission status to FHIR encounter status
   */
  private static mapAdmissionStatus(status: string): fhir.Encounter['status'] {
    const statusMap: Record<string, fhir.Encounter['status']> = {
      'active': 'in-progress',
      'discharged': 'finished',
      'transferred': 'finished',
      'cancelled': 'cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'in-progress';
  }

  /**
   * Map admission type to FHIR encounter class code
   */
  private static mapAdmissionType(admissionType: string): string {
    const typeMap: Record<string, string> = {
      'emergency': 'EMER',
      'inpatient': 'IMP',
      'outpatient': 'AMB',
      'observation': 'OBSENC',
      'day_surgery': 'AMB',
    };
    return typeMap[admissionType?.toLowerCase()] || 'IMP';
  }

  /**
   * Convert FHIR Encounter to Appointment entity data
   */
  static fromFhirToAppointment(fhirEncounter: fhir.Encounter, tenantId?: string): Partial<Appointment> {
    const startDate = fhirEncounter.period?.start
      ? new Date(fhirEncounter.period.start)
      : new Date();
    
    const endDate = fhirEncounter.period?.end
      ? new Date(fhirEncounter.period.end)
      : undefined;

    const durationMinutes = endDate
      ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
      : 30; // Default 30 minutes

    const status = this.mapStatusFromFhir(fhirEncounter.status);
    const isTelehealth = fhirEncounter.class?.code === 'VR';

    // Extract virtual meeting URL from extension
    const virtualMeetingUrl = fhirEncounter.extension?.find(
      ext => ext.url?.includes('virtual-meeting-url')
    )?.valueString;

    // Extract priority from extension
    const priorityLevel = fhirEncounter.extension?.find(
      ext => ext.url?.includes('priority-level')
    )?.valueString || 'normal';

    return {
      appointmentDate: startDate,
      durationMinutes,
      appointmentType: fhirEncounter.type?.[0]?.text || fhirEncounter.type?.[0]?.coding?.[0]?.display || 'Consultation',
      status,
      reason: fhirEncounter.reasonCode?.[0]?.text,
      isTelehealth,
      virtualMeetingUrl,
      priorityLevel,
      doctorId: fhirEncounter.participant?.[0]?.individual?.reference?.split('/')[1] || '',
    };
  }

  /**
   * Convert FHIR Encounter to Admission entity data
   */
  static fromFhirToAdmission(fhirEncounter: fhir.Encounter, tenantId?: string): Partial<Admission> {
    const startDate = fhirEncounter.period?.start
      ? new Date(fhirEncounter.period.start)
      : new Date();

    const endDate = fhirEncounter.period?.end
      ? new Date(fhirEncounter.period.end)
      : undefined;

    const status = this.mapAdmissionStatusFromFhir(fhirEncounter.status);
    const admissionType = this.mapClassToAdmissionType(fhirEncounter.class?.code);

    // Extract admission number from extension
    const admissionNumber = fhirEncounter.extension?.find(
      ext => ext.url?.includes('admission-number')
    )?.valueString;

    // Extract admission source from extension
    const admissionSource = fhirEncounter.extension?.find(
      ext => ext.url?.includes('admission-source')
    )?.valueString;

    // Extract referring facility from extension
    const referringFacility = fhirEncounter.extension?.find(
      ext => ext.url?.includes('referring-facility')
    )?.valueString;

    const admittingProvider = fhirEncounter.participant?.[0]?.individual?.reference?.split('/')[1];
    const currentBedId = fhirEncounter.location?.[0]?.location?.reference?.split('/')[1];
    
    return {
      admissionNumber: admissionNumber || `ADM-${Date.now()}`,
      admissionDate: startDate,
      estimatedDischargeDate: endDate,
      admissionType,
      admissionStatus: status,
      admittingDiagnosis: fhirEncounter.reasonCode?.[0]?.text || fhirEncounter.reasonCode?.[0]?.coding?.[0]?.display,
      admittingDiagnosisIcd10: fhirEncounter.reasonCode?.[0]?.coding?.find(c => c.system?.includes('icd-10'))?.code,
      admittingDiagnosisSnomed: fhirEncounter.type?.[0]?.coding?.find(c => c.system?.includes('snomed'))?.code,
      ...(admittingProvider ? { admittingProvider } : {}),
      admissionSource,
      referringFacility,
      ...(currentBedId ? { currentBedId } : {}),
    };
  }

  /**
   * Map FHIR encounter status to appointment status
   */
  private static mapStatusFromFhir(status?: fhir.Encounter['status']): string {
    const statusMap: Record<string, string> = {
      'planned': 'scheduled',
      'arrived': 'checked-in',
      'in-progress': 'in-progress',
      'finished': 'completed',
      'cancelled': 'cancelled',
    };
    return statusMap[status || 'planned'] || 'scheduled';
  }

  /**
   * Map FHIR encounter status to admission status
   */
  private static mapAdmissionStatusFromFhir(status?: fhir.Encounter['status']): string {
    const statusMap: Record<string, string> = {
      'in-progress': 'active',
      'finished': 'discharged',
      'cancelled': 'cancelled',
    };
    return statusMap[status || 'in-progress'] || 'active';
  }

  /**
   * Map FHIR encounter class code to admission type
   */
  private static mapClassToAdmissionType(classCode?: string): string {
    const typeMap: Record<string, string> = {
      'EMER': 'emergency',
      'IMP': 'inpatient',
      'AMB': 'outpatient',
      'OBSENC': 'observation',
    };
    return typeMap[classCode || 'IMP'] || 'inpatient';
  }
}

