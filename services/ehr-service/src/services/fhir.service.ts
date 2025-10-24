import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { Prescription } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';

@Injectable()
export class FhirService {
  
  getCapabilityStatement() {
    return {
      resourceType: 'CapabilityStatement',
      id: 'medicore-fhir-server',
      url: 'http://medicore.co.zw/fhir/CapabilityStatement/medicore-fhir-server',
      version: '1.0.0',
      name: 'MediCore FHIR Server',
      title: 'MediCore FHIR R4 Server',
      status: 'active',
      experimental: false,
      date: new Date().toISOString(),
      publisher: 'MediCore Solutions',
      description: 'FHIR R4 compliant server for MediCore EHR system',
      kind: 'instance',
      software: {
        name: 'MediCore EHR',
        version: '1.0.0'
      },
      implementation: {
        description: 'MediCore FHIR Server',
        url: 'http://medicore.co.zw/fhir'
      },
      fhirVersion: '4.0.1',
      format: ['json', 'xml'],
      rest: [{
        mode: 'server',
        resource: [
          {
            type: 'Patient',
            interaction: [
              { code: 'read' },
              { code: 'create' },
              { code: 'update' },
              { code: 'search-type' }
            ],
            searchParam: [
              { name: 'identifier', type: 'token' },
              { name: 'name', type: 'string' },
              { name: 'birthdate', type: 'date' },
              { name: 'gender', type: 'token' }
            ]
          },
          {
            type: 'Observation',
            interaction: [
              { code: 'read' },
              { code: 'create' },
              { code: 'search-type' }
            ]
          },
          {
            type: 'Encounter',
            interaction: [
              { code: 'read' },
              { code: 'create' },
              { code: 'search-type' }
            ]
          },
          {
            type: 'MedicationRequest',
            interaction: [
              { code: 'read' },
              { code: 'create' },
              { code: 'search-type' }
            ]
          },
          {
            type: 'DiagnosticReport',
            interaction: [
              { code: 'read' },
              { code: 'create' },
              { code: 'search-type' }
            ]
          }
        ]
      }]
    };
  }

  async searchPatients(query: any, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    
    let queryBuilder = patientRepository.createQueryBuilder('patient')
      .where('patient.isActive = :isActive', { isActive: true });

    // Apply FHIR search parameters
    if (query.name) {
      queryBuilder.andWhere(
        '(patient.firstName ILIKE :name OR patient.lastName ILIKE :name)',
        { name: `%${query.name}%` }
      );
    }

    if (query.identifier) {
      queryBuilder.andWhere(
        '(patient.patientNumber = :identifier OR patient.nationalId = :identifier)',
        { identifier: query.identifier }
      );
    }

    if (query.birthdate) {
      queryBuilder.andWhere('patient.dateOfBirth = :birthdate', { birthdate: query.birthdate });
    }

    if (query.gender) {
      queryBuilder.andWhere('patient.gender = :gender', { gender: query.gender });
    }

    const patients = await queryBuilder.getMany();

    return {
      resourceType: 'Bundle',
      id: `search-patients-${Date.now()}`,
      type: 'searchset',
      total: patients.length,
      entry: patients.map(patient => ({
        resource: this.patientToFhir(patient),
        search: { mode: 'match' }
      }))
    };
  }

  async getPatient(id: string, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await patientRepository.findOne({ where: { id } });
    
    if (!patient) {
      throw new Error('Patient not found');
    }

    return this.patientToFhir(patient);
  }

  async createPatient(fhirPatient: any, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    
    const patient = this.fhirToPatient(fhirPatient);
    const savedPatient = await patientRepository.save(patient);
    
    return this.patientToFhir(savedPatient);
  }

  async updatePatient(id: string, fhirPatient: any, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    
    const existingPatient = await patientRepository.findOne({ where: { id } });
    if (!existingPatient) {
      throw new Error('Patient not found');
    }

    const updatedData = this.fhirToPatient(fhirPatient);
    Object.assign(existingPatient, updatedData);
    
    const savedPatient = await patientRepository.save(existingPatient);
    return this.patientToFhir(savedPatient);
  }

  async searchObservations(query: any, tenantDb: DataSource) {
    // Implementation for observations (vital signs, lab results)
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: []
    };
  }

  async searchEncounters(query: any, tenantDb: DataSource) {
    // Implementation for encounters (appointments, visits)
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: []
    };
  }

  async searchMedicationRequests(query: any, tenantDb: DataSource) {
    // Implementation for medication requests (prescriptions)
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: []
    };
  }

  async searchDiagnosticReports(query: any, tenantDb: DataSource) {
    // Implementation for diagnostic reports (lab reports, imaging)
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: []
    };
  }

  private patientToFhir(patient: Patient): any {
    return {
      resourceType: 'Patient',
      id: patient.id,
      identifier: [
        {
          use: 'usual',
          system: 'http://medicore.co.zw/patient-number',
          value: patient.patientNumber
        },
        ...(patient.nationalId ? [{
          use: 'official',
          system: 'http://zimbabwe.gov.zw/national-id',
          value: patient.nationalId
        }] : [])
      ],
      active: patient.isActive,
      name: [{
        use: 'official',
        family: patient.lastName,
        given: [patient.firstName, ...(patient.middleName ? [patient.middleName] : [])]
      }],
      telecom: [
        {
          system: 'phone',
          value: patient.phone,
          use: 'mobile'
        },
        ...(patient.email ? [{
          system: 'email',
          value: patient.email
        }] : [])
      ],
      gender: patient.gender,
      birthDate: patient.dateOfBirth.toISOString().split('T')[0],
      address: [{
        use: 'home',
        text: patient.address,
        city: patient.city,
        state: patient.province,
        postalCode: patient.postalCode
      }],
      maritalStatus: patient.maritalStatus ? {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: patient.maritalStatus.toUpperCase(),
          display: patient.maritalStatus
        }]
      } : undefined,
      contact: patient.emergencyContactName ? [{
        relationship: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
            code: 'E',
            display: 'Emergency Contact'
          }]
        }],
        name: {
          text: patient.emergencyContactName
        },
        telecom: [{
          system: 'phone',
          value: patient.emergencyContactPhone
        }]
      }] : undefined
    };
  }

  private fhirToPatient(fhirPatient: any): Partial<Patient> {
    const name = fhirPatient.name?.[0];
    
    return {
      firstName: name?.given?.[0] || '',
      lastName: name?.family || '',
      middleName: name?.given?.[1],
      dateOfBirth: new Date(fhirPatient.birthDate),
      gender: fhirPatient.gender,
      phone: fhirPatient.telecom?.find(t => t.system === 'phone')?.value || '',
      email: fhirPatient.telecom?.find(t => t.system === 'email')?.value,
      address: fhirPatient.address?.[0]?.text || '',
      city: fhirPatient.address?.[0]?.city,
      province: fhirPatient.address?.[0]?.state,
      postalCode: fhirPatient.address?.[0]?.postalCode,
      nationalId: fhirPatient.identifier?.find(i => i.system === 'http://zimbabwe.gov.zw/national-id')?.value,
      isActive: fhirPatient.active !== false
    };
  }
}