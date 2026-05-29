import { Patient } from '../../entities/patient.entity';
import type * as fhir from 'fhir/r4';

export class PatientMapper {
  /**
   * Convert Patient entity to FHIR Patient resource
   */
  static toFhir(patient: Patient, tenantId?: string): fhir.Patient {
    const identifiers: fhir.Identifier[] = [
      {
        system: `http://${tenantId || 'umoya'}.co.zw/patients`,
        value: patient.patientNumber || patient.id,
      },
    ];

    if (patient.nationalId) {
      identifiers.push({
        system: 'http://umoya.health/fhir/national-id',
        value: patient.nationalId,
      });
    }

    if (patient.medicalAidNumber) {
      identifiers.push({
        system: `http://${patient.medicalAidProvider || 'medical-aid'}.co.zw`,
        value: patient.medicalAidNumber,
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'MB',
            display: 'Member Number',
          }],
        },
      });
    }

    const telecom: fhir.ContactPoint[] = [];
    if (patient.phone) {
      telecom.push({
        system: 'phone',
        value: patient.phone,
        use: 'mobile',
      });
    }
    if (patient.email) {
      telecom.push({
        system: 'email',
        value: patient.email,
      });
    }

    const addresses: fhir.Address[] = [];
    if (patient.address || patient.city) {
      addresses.push({
        use: 'home',
        line: patient.address ? [patient.address] : [],
        city: patient.city,
        state: patient.city, // Using city as state if province not available
        postalCode: undefined,
        country: 'ZW',
      });
    }

    const contact: fhir.PatientContact[] = [];
    if (patient.emergencyContactName || patient.emergencyContactPhone) {
      contact.push({
        relationship: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
            code: 'C',
            display: 'Emergency Contact',
          }],
        }],
        name: patient.emergencyContactName ? {
          text: patient.emergencyContactName,
        } : undefined,
        telecom: patient.emergencyContactPhone ? [{
          system: 'phone',
          value: patient.emergencyContactPhone,
        }] : [],
      });
    }

    const extensions: fhir.Extension[] = [];
    if (patient.bloodType) {
      extensions.push({
        url: 'http://umoya.health/fhir/StructureDefinition/blood-type',
        valueString: patient.bloodType,
      });
    }
    if (patient.allergies) {
      extensions.push({
        url: 'http://umoya.health/fhir/StructureDefinition/allergies',
        valueString: patient.allergies,
      });
    }
    if (patient.medicalHistory) {
      extensions.push({
        url: 'http://umoya.health/fhir/StructureDefinition/medical-history',
        valueString: patient.medicalHistory,
      });
    }

    return {
      resourceType: 'Patient',
      id: patient.id,
      meta: {
        versionId: '1',
        lastUpdated: patient.updatedAt?.toISOString() || patient.createdAt.toISOString(),
      },
      identifier: identifiers,
      active: patient.isActive !== false,
      name: [
        {
          family: patient.lastName,
          given: [patient.firstName],
          use: 'official',
        },
      ],
      telecom: telecom.length > 0 ? telecom : undefined,
      gender: this.mapGender(patient.gender),
      birthDate: patient.dateOfBirth 
        ? (patient.dateOfBirth instanceof Date 
            ? patient.dateOfBirth.toISOString().split('T')[0]
            : new Date(patient.dateOfBirth).toISOString().split('T')[0])
        : undefined,
      address: addresses.length > 0 ? addresses : undefined,
      contact: contact.length > 0 ? contact : undefined,
      extension: extensions.length > 0 ? extensions : undefined,
    };
  }

  /**
   * Convert FHIR Patient resource to Patient entity data
   */
  static fromFhir(fhirPatient: fhir.Patient): Partial<Patient> {
    const name = fhirPatient.name?.[0];
    const phone = fhirPatient.telecom?.find(t => t.system === 'phone')?.value;
    const email = fhirPatient.telecom?.find(t => t.system === 'email')?.value;
    const address = fhirPatient.address?.[0];
    const emergencyContact = fhirPatient.contact?.[0];

    // Extract identifiers
    const patientNumber = fhirPatient.identifier?.find(
      i => i.system?.includes('/patients')
    )?.value;
    const nationalId = fhirPatient.identifier?.find(
      i => i.system?.includes('national-id')
    )?.value;
    const medicalAidNumber = fhirPatient.identifier?.find(
      i => i.type?.coding?.[0]?.code === 'MB'
    )?.value;
    const medicalAidProvider = fhirPatient.identifier?.find(
      i => i.type?.coding?.[0]?.code === 'MB'
    )?.system?.replace('http://', '').replace('.co.zw', '');

    // Extract extensions
    const bloodType = fhirPatient.extension?.find(
      e => e.url?.includes('blood-type')
    )?.valueString;
    const allergies = fhirPatient.extension?.find(
      e => e.url?.includes('allergies')
    )?.valueString;
    const medicalHistory = fhirPatient.extension?.find(
      e => e.url?.includes('medical-history')
    )?.valueString;

    return {
      patientNumber: patientNumber || fhirPatient.id,
      firstName: name?.given?.[0] || '',
      lastName: name?.family || '',
      gender: this.mapGenderFromFhir(fhirPatient.gender),
      dateOfBirth: fhirPatient.birthDate ? new Date(fhirPatient.birthDate) : undefined,
      phone,
      email,
      address: address?.line?.[0],
      city: address?.city,
      nationalId,
      emergencyContactName: emergencyContact?.name?.text,
      emergencyContactPhone: emergencyContact?.telecom?.[0]?.value,
      medicalAidNumber,
      medicalAidProvider,
      bloodType,
      allergies,
      medicalHistory,
      isActive: fhirPatient.active !== false,
    };
  }

  /**
   * Map internal gender to FHIR gender
   */
  private static mapGender(gender: string): fhir.Patient['gender'] {
    const map: Record<string, fhir.Patient['gender']> = {
      'male': 'male',
      'female': 'female',
      'other': 'other',
      'unknown': 'unknown',
      'm': 'male',
      'f': 'female',
      'o': 'other',
      'u': 'unknown',
    };
    return map[gender?.toLowerCase()] || 'unknown';
  }

  /**
   * Map FHIR gender to internal gender
   */
  private static mapGenderFromFhir(gender?: fhir.Patient['gender']): string {
    return gender || 'unknown';
  }
}

