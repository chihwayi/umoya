import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { MedicalRecord, RecordType } from '../entities/medical-record.entity';
import { Prescription, PrescriptionStatus } from '../entities/prescription.entity';
import { LabOrder, LabOrderStatus, Priority } from '../entities/lab-order.entity';
import { Vitals } from '../entities/vitals.entity';
import { Appointment } from '../entities/appointment.entity';
import { Allergy } from '../entities/allergy.entity';
import { Problem } from '../entities/problem.entity';

type BundleEntry = {
  resource: any;
  search?: {
    mode: 'match' | 'include' | 'outcome';
  };
};

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
          this.buildResourceCapability('Observation'),
          this.buildResourceCapability('Encounter'),
          this.buildResourceCapability('MedicationRequest'),
          this.buildResourceCapability('DiagnosticReport'),
          this.buildResourceCapability('Condition'),
          this.buildResourceCapability('AllergyIntolerance'),
          this.buildResourceCapability('ServiceRequest'),
          this.buildResourceCapability('DocumentReference')
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
    const vitalsRepository = tenantDb.getRepository(Vitals);

    const where: Record<string, any> = {};
    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }
    if (query.date) {
      where.recordedAt = query.date;
    }

    const vitals = await vitalsRepository.find({
      where,
      order: { recordedAt: 'DESC' },
    });

    const entries: BundleEntry[] = vitals
      .map((record) => this.vitalsToObservation(record))
      .filter((resource): resource is any => !!resource)
      .map((resource) => ({
        resource,
        search: { mode: 'match' as const },
      }));

    return this.buildBundle(entries);
  }

  async searchEncounters(query: any, tenantDb: DataSource) {
    const appointmentRepository = tenantDb.getRepository(Appointment);
    const where: Record<string, any> = {};

    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }
    if (query.status) {
      where.status = query.status;
    }

    const appointments = await appointmentRepository.find({
      where,
      order: { appointmentDate: 'DESC' },
    });

    const entries = appointments.map((appointment) => ({
      resource: this.appointmentToEncounter(appointment),
      search: { mode: 'match' as const },
    }));

    return this.buildBundle(entries);
  }

  async searchMedicationRequests(query: any, tenantDb: DataSource) {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    const where: Record<string, any> = {};

    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }
    if (query.status) {
      where.status = (query.status as PrescriptionStatus) ?? PrescriptionStatus.ACTIVE;
    }

    const prescriptions = await prescriptionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const entries = prescriptions.map((prescription) => ({
      resource: this.prescriptionToMedicationRequest(prescription),
      search: { mode: 'match' as const },
    }));

    return this.buildBundle(entries);
  }

  async searchDiagnosticReports(query: any, tenantDb: DataSource) {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const where: Record<string, any> = {};

    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }
    if (query.status) {
      where.status = query.status;
    }

    const labOrders = await labOrderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const entries = labOrders.map((order) => ({
      resource: this.labOrderToDiagnosticReport(order),
      search: { mode: 'match' as const },
    }));

    return this.buildBundle(entries);
  }

  async searchConditions(query: any, tenantDb: DataSource) {
    const problemRepository = tenantDb.getRepository(Problem);
    const where: Record<string, any> = {};

    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }
    if (query.status) {
      where.status = query.status;
    }

    const problems = await problemRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const entries = problems.map((problem) => ({
      resource: this.problemToCondition(problem),
      search: { mode: 'match' as const },
    }));

    return this.buildBundle(entries);
  }

  async searchAllergyIntolerances(query: any, tenantDb: DataSource) {
    const allergyRepository = tenantDb.getRepository(Allergy);
    const where: Record<string, any> = {};

    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }

    const allergies = await allergyRepository.find({
      where,
      order: { recordedAt: 'DESC' },
    });

    const entries = allergies.map((allergy) => ({
      resource: this.allergyToFhir(allergy),
      search: { mode: 'match' as const },
    }));

    return this.buildBundle(entries);
  }

  async searchServiceRequests(query: any, tenantDb: DataSource) {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const where: Record<string, any> = {};

    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }
    if (query.status) {
      where.status = query.status;
    }

    const labOrders = await labOrderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const entries = labOrders.map((order) => ({
      resource: this.labOrderToServiceRequest(order),
      search: { mode: 'match' as const },
    }));

    return this.buildBundle(entries);
  }

  async searchDocumentReferences(query: any, tenantDb: DataSource) {
    const medicalRecordRepository = tenantDb.getRepository(MedicalRecord);
    const where: Record<string, any> = {};

    if (query.patient) {
      where.patientId = this.extractId(query.patient);
    }
    if (query.type) {
      where.type = query.type;
    }

    const records = await medicalRecordRepository.find({
      where,
      order: { recordDate: 'DESC' },
    });

    const entries = records.map((record) => ({
      resource: this.medicalRecordToDocumentReference(record),
      search: { mode: 'match' as const },
    }));

    return this.buildBundle(entries);
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

  private vitalsToObservation(vitals: Vitals | null): any | null {
    if (!vitals) {
      return null;
    }

    const components = [];

    if (vitals.bloodPressure) {
      const [systolic, diastolic] = vitals.bloodPressure.split('/').map((value) => parseInt(value, 10));
      if (!Number.isNaN(systolic)) {
        components.push({
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure',
              },
            ],
            text: 'Systolic blood pressure',
          },
          valueQuantity: {
            value: systolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        });
      }
      if (!Number.isNaN(diastolic)) {
        components.push({
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure',
              },
            ],
            text: 'Diastolic blood pressure',
          },
          valueQuantity: {
            value: diastolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        });
      }
    }

    if (vitals.heartRate !== undefined && vitals.heartRate !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8867-4',
              display: 'Heart rate',
            },
          ],
          text: 'Heart rate',
        },
        valueQuantity: {
          value: vitals.heartRate,
          unit: 'beats/minute',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
      });
    }

    if (vitals.temperature !== undefined && vitals.temperature !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8310-5',
              display: 'Body temperature',
            },
          ],
          text: 'Body temperature',
        },
        valueQuantity: {
          value: Number(vitals.temperature),
          unit: '°C',
          system: 'http://unitsofmeasure.org',
          code: 'Cel',
        },
      });
    }

    if (vitals.oxygenSaturation !== undefined && vitals.oxygenSaturation !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '59408-5',
              display: 'Oxygen saturation in Arterial blood by Pulse oximetry',
            },
          ],
          text: 'Oxygen saturation',
        },
        valueQuantity: {
          value: vitals.oxygenSaturation,
          unit: '%',
          system: 'http://unitsofmeasure.org',
          code: '%',
        },
      });
    }

    if (vitals.respiratoryRate !== undefined && vitals.respiratoryRate !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '9279-1',
              display: 'Respiratory rate',
            },
          ],
          text: 'Respiratory rate',
        },
        valueQuantity: {
          value: vitals.respiratoryRate,
          unit: 'breaths/minute',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
      });
    }

    if (vitals.weight !== undefined && vitals.weight !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '29463-7',
              display: 'Body weight',
            },
          ],
          text: 'Body weight',
        },
        valueQuantity: {
          value: Number(vitals.weight),
          unit: 'kg',
          system: 'http://unitsofmeasure.org',
          code: 'kg',
        },
      });
    }

    if (vitals.height !== undefined && vitals.height !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8302-2',
              display: 'Body height',
            },
          ],
          text: 'Body height',
        },
        valueQuantity: {
          value: Number(vitals.height),
          unit: 'cm',
          system: 'http://unitsofmeasure.org',
          code: 'cm',
        },
      });
    }

    if (vitals.bmi !== undefined && vitals.bmi !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '39156-5',
              display: 'Body mass index (BMI) [Ratio]',
            },
          ],
          text: 'Body mass index',
        },
        valueQuantity: {
          value: Number(vitals.bmi),
          unit: 'kg/m2',
          system: 'http://unitsofmeasure.org',
          code: 'kg/m2',
        },
      });
    }

    if (vitals.painLevel !== undefined && vitals.painLevel !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '72514-3',
              display: 'Pain severity - 0-10 verbal numeric rating [Score]',
            },
          ],
          text: 'Pain level',
        },
        valueQuantity: {
          value: vitals.painLevel,
        },
      });
    }

    if (vitals.bloodGlucose !== undefined && vitals.bloodGlucose !== null) {
      components.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '15074-8',
              display: 'Glucose [Moles/volume] in Blood',
            },
          ],
          text: 'Blood glucose',
        },
        valueQuantity: {
          value: Number(vitals.bloodGlucose),
          unit: 'mmol/L',
          system: 'http://unitsofmeasure.org',
          code: 'mmol/L',
        },
      });
    }

    if (components.length === 0) {
      return null;
    }

    const observation: any = {
      resourceType: 'Observation',
      id: vitals.id,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
          text: 'Vital Signs',
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85353-1',
            display: 'Vital signs, weight, height, head circumference, oxygen saturation and BMI panel',
          },
        ],
        text: 'Vital signs panel',
      },
      subject: {
        reference: `Patient/${vitals.patientId}`,
      },
      effectiveDateTime: vitals.recordedAt?.toISOString(),
      issued: vitals.recordedAt?.toISOString(),
      component: components,
    };

    if (vitals.recordedBy) {
      observation.performer = [
        {
          reference: `Practitioner/${vitals.recordedBy}`,
        },
      ];
    }

    if (vitals.notes) {
      observation.note = [
        {
          text: vitals.notes,
        },
      ];
    }

    return observation;
  }

  private appointmentToEncounter(appointment: Appointment): any {
    const status = this.mapEncounterStatus(appointment.status);
    const start = appointment.actualStartTime || appointment.appointmentDate;
    const end = appointment.actualEndTime || (appointment.durationMinutes
      ? new Date((appointment.actualStartTime || appointment.appointmentDate).getTime() + appointment.durationMinutes * 60000)
      : null);

    return {
      resourceType: 'Encounter',
      id: appointment.id,
      status,
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: appointment.isTelehealth ? 'VR' : 'AMB',
        display: appointment.isTelehealth ? 'Virtual' : 'Ambulatory',
      },
      type: appointment.appointmentType
        ? [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
                  code: appointment.appointmentType,
                },
              ],
              text: appointment.appointmentType,
            },
          ]
        : undefined,
      subject: {
        reference: `Patient/${appointment.patientId}`,
      },
      participant: appointment.doctorId
        ? [
            {
              individual: {
                reference: `Practitioner/${appointment.doctorId}`,
              },
            },
          ]
        : undefined,
      period: {
        start: start?.toISOString(),
        end: end?.toISOString(),
      },
      reasonCode: appointment.reason
        ? [
            {
              text: appointment.reason,
            },
          ]
        : undefined,
      statusHistory: [
        {
          status,
          period: {
            start: appointment.createdAt?.toISOString(),
            end: appointment.updatedAt?.toISOString(),
          },
        },
      ],
    };
  }

  private prescriptionToMedicationRequest(prescription: Prescription): any {
    const status = this.mapMedicationStatus(prescription.status);

    return {
      resourceType: 'MedicationRequest',
      id: prescription.id,
      status,
      intent: 'order',
      medicationCodeableConcept: {
        text: prescription.medicationName,
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: prescription.medicationName,
            display: prescription.medicationName,
          },
        ],
      },
      subject: {
        reference: `Patient/${prescription.patientId}`,
      },
      requester: prescription.prescriberId
        ? {
            reference: `Practitioner/${prescription.prescriberId}`,
          }
        : undefined,
      authoredOn: prescription.createdAt?.toISOString(),
      dosageInstruction: [
        {
          text: prescription.instructions || `${prescription.dosage} ${prescription.frequency} via ${prescription.route}`,
          timing: {
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: 'd',
            },
          },
          route: {
            text: prescription.route,
          },
          doseAndRate: [
            {
              doseQuantity: {
                value: prescription.quantity,
              },
            },
          ],
        },
      ],
      dispenseRequest: {
        quantity: {
          value: prescription.quantity,
        },
        numberOfRepeatsAllowed: prescription.refills ?? 0,
        expectedSupplyDuration:
          prescription.startDate && prescription.endDate
            ? {
                value:
                  (prescription.endDate.getTime() - prescription.startDate.getTime()) /
                  (1000 * 60 * 60 * 24),
                unit: 'days',
              }
            : undefined,
      },
      note: prescription.pharmacyNotes
        ? [
            {
              text: prescription.pharmacyNotes,
            },
          ]
        : undefined,
      reasonCode: prescription.indication
        ? [
            {
              text: prescription.indication,
            },
          ]
        : undefined,
    };
  }

  private labOrderToDiagnosticReport(order: LabOrder): any {
    const tests = order.tests || [];
    const primaryTest = tests[0];

    const conclusionParts: string[] = [];
    if (order.results) {
      order.results.forEach((result) => {
        const summary = `${result.testName || result.testCode}: ${result.value} ${result.unit || ''} (${result.flag || 'normal'})`;
        conclusionParts.push(summary.trim());
      });
    }
    if (order.interpretation) {
      conclusionParts.push(order.interpretation);
    }

    return {
      resourceType: 'DiagnosticReport',
      id: order.id,
      status: this.mapDiagnosticReportStatus(order.status),
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory',
            },
          ],
          text: 'Laboratory',
        },
      ],
      code: primaryTest
        ? {
            coding: [
              {
                system: 'http://loinc.org',
                code: primaryTest.testCode,
                display: primaryTest.testName,
              },
            ],
            text: primaryTest.testName || primaryTest.testCode,
          }
        : {
            text: 'Laboratory Report',
          },
      subject: {
        reference: `Patient/${order.patientId}`,
      },
      effectiveDateTime: (order.collectedAt || order.scheduledDateTime || order.createdAt)?.toISOString(),
      issued: (order.reviewedAt || order.createdAt)?.toISOString(),
      performer: order.orderingProviderId
        ? [
            {
              reference: `Practitioner/${order.orderingProviderId}`,
            },
          ]
        : undefined,
      conclusion: conclusionParts.length > 0 ? conclusionParts.join('\n') : undefined,
      presentedForm: order.attachments
        ? order.attachments.map((attachment, index) => ({
            contentType: attachment.type || 'application/pdf',
            url: attachment.url,
            title: attachment.filename || `Attachment ${index + 1}`,
          }))
        : undefined,
    };
  }

  private problemToCondition(problem: Problem): any {
    return {
      resourceType: 'Condition',
      id: problem.id,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: problem.status === 'resolved' ? 'resolved' : 'active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis',
            },
          ],
        },
      ],
      code: problem.snomedConceptId || problem.code
        ? {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: problem.snomedConceptId || problem.code,
                display: problem.snomedTerm || problem.description,
              },
            ],
            text: problem.snomedTerm || problem.description,
          }
        : {
            text: problem.description,
          },
      subject: {
        reference: `Patient/${problem.patientId}`,
      },
      onsetDateTime: problem.onsetDate?.toISOString(),
      abatementDateTime: problem.resolvedDate?.toISOString(),
      note: problem.notes
        ? [
            {
              text: problem.notes,
            },
          ]
        : undefined,
      recordedDate: problem.createdAt?.toISOString(),
    };
  }

  private allergyToFhir(allergy: Allergy): any {
    return {
      resourceType: 'AllergyIntolerance',
      id: allergy.id,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'confirmed',
          },
        ],
      },
      type: 'allergy',
      category: ['medication'],
      code: allergy.allergenSnomedCode
        ? {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: allergy.allergenSnomedCode,
                display: allergy.allergenSnomedTerm || allergy.allergen,
              },
            ],
            text: allergy.allergenSnomedTerm || allergy.allergen,
          }
        : {
            text: allergy.allergen,
          },
      patient: {
        reference: `Patient/${allergy.patientId}`,
      },
      recordedDate: allergy.recordedAt?.toISOString(),
      recorder: allergy.recordedBy
        ? {
            reference: `Practitioner/${allergy.recordedBy}`,
          }
        : undefined,
      reaction:
        allergy.reaction || allergy.severity
          ? [
              {
                description: allergy.reactionSnomedTerm || allergy.reaction || undefined,
                manifestation: allergy.reactionSnomedCode
                  ? [
                      {
                        coding: [
                          {
                            system: 'http://snomed.info/sct',
                            code: allergy.reactionSnomedCode,
                            display: allergy.reactionSnomedTerm || allergy.reaction,
                          },
                        ],
                        text: allergy.reactionSnomedTerm || allergy.reaction || undefined,
                      },
                    ]
                  : undefined,
                severity: allergy.severity,
              },
            ]
          : undefined,
    };
  }

  private labOrderToServiceRequest(order: LabOrder): any {
    const tests = order.tests ?? [];
    const primaryTest = tests[0];

    const categoryCoding = {
      system: 'http://terminology.hl7.org/CodeSystem/service-category',
      code: 'laboratory',
      display: 'Laboratory',
    };

    const code = primaryTest
      ? {
          text: primaryTest.testName,
          coding: primaryTest.testCode
            ? [
                {
                  system: 'http://loinc.org',
                  code: primaryTest.testCode,
                  display: primaryTest.testName,
                },
              ]
            : undefined,
        }
      : undefined;

    const specimen =
      tests.length > 0
        ? tests
            .filter((test) => !!test.specimenType)
            .map((test) => ({
              display: test.specimenType,
            }))
        : undefined;

    const additionalNotes: Array<{ text: string }> = [];
    if (order.specialInstructions) {
      additionalNotes.push({ text: order.specialInstructions });
    }
    if (order.clinicalInfo) {
      additionalNotes.push({ text: order.clinicalInfo });
    }

    return {
      resourceType: 'ServiceRequest',
      id: order.id,
      status: this.mapServiceRequestStatus(order.status),
      intent: 'order',
      category: [
        {
          coding: [categoryCoding],
        },
      ],
      priority: this.mapPriorityToFhir(order.priority),
      code,
      subject: {
        reference: `Patient/${order.patientId}`,
      },
      requester: order.orderingProviderId
        ? {
            reference: `Practitioner/${order.orderingProviderId}`,
          }
        : undefined,
      reasonCode: order.clinicalInfo
        ? [
            {
              text: order.clinicalInfo,
            },
          ]
        : undefined,
      occurrenceDateTime: order.scheduledDateTime
        ? order.scheduledDateTime.toISOString()
        : undefined,
      authoredOn: order.createdAt ? order.createdAt.toISOString() : undefined,
      specimen,
      note: additionalNotes.length ? additionalNotes : undefined,
      supportingInfo:
        tests.length > 1
          ? tests.slice(1).map((test) => ({
              display: test.testName,
            }))
          : undefined,
    };
  }

  private mapServiceRequestStatus(status: LabOrderStatus): string {
    switch (status) {
      case LabOrderStatus.AWAITING_PAYMENT:
        return 'draft';
      case LabOrderStatus.ORDERED:
        return 'active';
      case LabOrderStatus.IN_PROGRESS:
      case LabOrderStatus.COLLECTED:
        return 'in-progress';
      case LabOrderStatus.COMPLETED:
        return 'completed';
      case LabOrderStatus.CANCELLED:
        return 'revoked';
      default:
        return 'unknown';
    }
  }

  private mapPriorityToFhir(priority: Priority | null | undefined): string | undefined {
    switch (priority) {
      case Priority.URGENT:
        return 'urgent';
      case Priority.STAT:
        return 'stat';
      case Priority.ROUTINE:
        return 'routine';
      default:
        return undefined;
    }
  }
}