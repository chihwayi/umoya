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
          url: 'http://medicore.co.zw/fhir/StructureDefinition/virtual-meeting-url',
          valueString: appointment.virtualMeetingUrl,
        }] : []),
        ...(appointment.priorityLevel ? [{
          url: 'http://medicore.co.zw/fhir/StructureDefinition/priority-level',
          valueString: appointment.priorityLevel,
        }] : []),
        ...(appointment.waitTimeMinutes ? [{
          url: 'http://medicore.co.zw/fhir/StructureDefinition/wait-time-minutes',
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
          url: 'http://medicore.co.zw/fhir/StructureDefinition/admission-number',
          valueString: admission.admissionNumber,
        }] : []),
        ...(admission.admissionSource ? [{
          url: 'http://medicore.co.zw/fhir/StructureDefinition/admission-source',
          valueString: admission.admissionSource,
        }] : []),
        ...(admission.referringFacility ? [{
          url: 'http://medicore.co.zw/fhir/StructureDefinition/referring-facility',
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
}

