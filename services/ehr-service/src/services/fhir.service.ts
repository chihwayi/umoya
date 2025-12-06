import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { MedicalRecord, RecordType } from '../entities/medical-record.entity';
import { Prescription, PrescriptionStatus } from '../entities/prescription.entity';
import { LabOrder, LabOrderStatus, Priority } from '../entities/lab-order.entity';
import { Vitals } from '../entities/vitals.entity';
import { Appointment } from '../entities/appointment.entity';
import { Admission } from '../entities/admission.entity';
import { Allergy } from '../entities/allergy.entity';
import { Problem } from '../entities/problem.entity';
import { User } from '../entities/user.entity';
import { PatientMapper } from '../fhir/mappers/patient.mapper';
import { EncounterMapper } from '../fhir/mappers/encounter.mapper';
import { ObservationMapper } from '../fhir/mappers/observation.mapper';
import { MedicationRequestMapper } from '../fhir/mappers/medication-request.mapper';
import { DiagnosticReportMapper } from '../fhir/mappers/diagnostic-report.mapper';
import { ConditionMapper } from '../fhir/mappers/condition.mapper';
import { MedicationMapper } from '../fhir/mappers/medication.mapper';
import { MedicationDispenseMapper } from '../fhir/mappers/medication-dispense.mapper';
import { ImmunizationMapper } from '../fhir/mappers/immunization.mapper';
import { ProcedureMapper } from '../fhir/mappers/procedure.mapper';
import { Drug } from '../entities/drug.entity';
import { PharmacyDispensing } from '../entities/pharmacy-dispensing.entity';
import { PharmacyDispensingItem } from '../entities/pharmacy-dispensing-item.entity';
import { Immunization } from '../entities/immunization.entity';
import { SurgicalCase } from '../entities/surgical-case.entity';
import { FhirValidatorService } from '../fhir/validators/fhir-validator.service';

type BundleEntry = {
  resource: any;
  search?: {
    mode: 'match' | 'include' | 'outcome';
  };
};

@Injectable()
export class FhirService {
  constructor(private readonly fhirValidator?: FhirValidatorService) {}
  
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
          this.buildResourceCapability('Medication'),
          this.buildResourceCapability('MedicationDispense'),
          this.buildResourceCapability('DiagnosticReport'),
          this.buildResourceCapability('Condition'),
          this.buildResourceCapability('AllergyIntolerance'),
          this.buildResourceCapability('ServiceRequest'),
          this.buildResourceCapability('DocumentReference'),
          this.buildResourceCapability('Immunization'),
          this.buildResourceCapability('Procedure'),
          this.buildResourceCapability('CarePlan'),
          this.buildResourceCapability('Location'),
          this.buildResourceCapability('Organization'),
          this.buildResourceCapability('Practitioner'),
          this.buildResourceCapability('PractitionerRole')
        ]
      }]
    };
  }

  async searchPatients(query: any, tenantDb: DataSource, tenantId: string) {
    try {
      console.log('🔍 searchPatients called with query:', JSON.stringify(query));
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
        // Support format: system|value or just value
        const identifierParts = query.identifier.split('|');
        const identifierValue = identifierParts.length > 1 ? identifierParts[1] : identifierParts[0];
        queryBuilder.andWhere(
          '(patient.patientNumber = :identifier OR patient.nationalId = :identifier)',
          { identifier: identifierValue }
        );
      }

      if (query.birthdate) {
        // Support date ranges: birthdate=le2020-01-01, birthdate=ge2020-01-01, birthdate=2020-01-01
        if (query.birthdate.startsWith('le')) {
          const date = query.birthdate.substring(2);
          queryBuilder.andWhere('patient.dateOfBirth <= :birthdate', { birthdate: date });
        } else if (query.birthdate.startsWith('ge')) {
          const date = query.birthdate.substring(2);
          queryBuilder.andWhere('patient.dateOfBirth >= :birthdate', { birthdate: date });
        } else {
          queryBuilder.andWhere('patient.dateOfBirth = :birthdate', { birthdate: query.birthdate });
        }
      }

      if (query.gender) {
        queryBuilder.andWhere('patient.gender = :gender', { gender: query.gender });
      }

      if (query.phone) {
        queryBuilder.andWhere('patient.phone = :phone', { phone: query.phone });
      }

      if (query.email) {
        queryBuilder.andWhere('patient.email = :email', { email: query.email });
      }

      // Pagination
      const page = parseInt(query._page) || 1;
      const count = Math.min(parseInt(query._count) || 10, 100); // Max 100 per page
      const offset = (page - 1) * count;

      queryBuilder.skip(offset).take(count);

      // Get total count for pagination
      console.log('🔍 [FHIR] Executing count query...');
      const total = await queryBuilder.getCount();
      console.log(`📊 [FHIR] Found ${total} patients`);
      console.log('🔍 [FHIR] Executing getMany query...');
      const patients = await queryBuilder.getMany();
      console.log(`📋 [FHIR] Retrieved ${patients.length} patients for mapping`);
      console.log('🔍 [FHIR] First patient sample:', patients[0] ? {
        id: patients[0].id,
        patientNumber: patients[0].patientNumber,
        firstName: patients[0].firstName,
        lastName: patients[0].lastName,
        dateOfBirth: patients[0].dateOfBirth,
        gender: patients[0].gender,
        hasKeys: Object.keys(patients[0]).length
      } : 'No patients');

      return {
        resourceType: 'Bundle',
        id: `search-patients-${Date.now()}`,
        type: 'searchset',
        total,
        link: [
          {
            relation: 'self',
            url: `?${new URLSearchParams(query).toString()}`,
          },
          ...(page > 1 ? [{
            relation: 'previous',
            url: `?_page=${page - 1}&_count=${count}`,
          }] : []),
          ...(offset + count < total ? [{
            relation: 'next',
            url: `?_page=${page + 1}&_count=${count}`,
          }] : []),
        ],
        entry: patients.map((patient, index) => {
          try {
            console.log(`🔄 [FHIR] Mapping patient ${index + 1}/${patients.length}: ${patient.id}`);
            console.log(`🔄 [FHIR] Patient data:`, {
              id: patient.id,
              patientNumber: patient.patientNumber,
              firstName: patient.firstName,
              lastName: patient.lastName,
              dateOfBirth: patient.dateOfBirth,
              gender: patient.gender,
              phone: patient.phone,
              email: patient.email,
              isActive: patient.isActive,
              createdAt: patient.createdAt,
              updatedAt: patient.updatedAt
            });
            const fhirPatient = PatientMapper.toFhir(patient, tenantId);
            console.log(`✅ [FHIR] Successfully mapped patient ${patient.id}`);
            return {
              resource: fhirPatient,
              search: { mode: 'match' as const }
            };
          } catch (error: any) {
            console.error(`❌ [FHIR] Error mapping patient ${patient?.id || 'unknown'}:`, error?.message || error);
            console.error(`❌ [FHIR] Error type: ${error?.constructor?.name}`);
            console.error(`❌ [FHIR] Error stack:`, error?.stack?.substring(0, 500));
            console.error(`❌ [FHIR] Patient keys:`, patient ? Object.keys(patient) : 'null');
            // Return a minimal FHIR patient instead of throwing
            return {
              resource: {
                resourceType: 'Patient',
                id: patient?.id || 'unknown',
                active: false,
                name: [{ family: 'Error', given: ['Mapping'] }]
              },
              search: { mode: 'match' as const }
            };
          }
        })
      };
    } catch (error: any) {
      console.error('❌ [FHIR] Error in searchPatients:', error?.message || error);
      console.error('❌ [FHIR] Error type:', error?.constructor?.name);
      console.error('❌ [FHIR] Error stack:', error?.stack);
      console.error('❌ [FHIR] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      throw error;
    }
  }

  async getPatient(id: string, tenantDb: DataSource, tenantId: string) {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await patientRepository.findOne({ where: { id, isActive: true } });
    
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return PatientMapper.toFhir(patient, tenantId);
  }

  async createPatient(fhirPatient: any, tenantDb: DataSource, tenantId: string) {
    // Validate FHIR resource
    if (this.fhirValidator) {
      await this.fhirValidator.validateResource(fhirPatient, 'Patient');
    }
    
    // Map to entity
    const patientRepository = tenantDb.getRepository(Patient);
    const patientData = PatientMapper.fromFhir(fhirPatient);
    
    // Generate patient number if not provided
    if (!patientData.patientNumber) {
      // Generate patient number (you may want to use your existing logic)
      const count = await patientRepository.count();
      patientData.patientNumber = `PAT-${String(count + 1).padStart(6, '0')}`;
    }
    
    // Create and save
    const patient = patientRepository.create(patientData);
    const savedPatient = await patientRepository.save(patient);
    
    return PatientMapper.toFhir(savedPatient, tenantId);
  }

  async updatePatient(id: string, fhirPatient: any, tenantDb: DataSource, tenantId: string) {
    // Validate FHIR resource
    if (this.fhirValidator) {
      await this.fhirValidator.validateResource(fhirPatient, 'Patient');
    }
    
    // Get existing patient
    const patientRepository = tenantDb.getRepository(Patient);
    const existingPatient = await patientRepository.findOne({ where: { id } });
    
    if (!existingPatient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // Update with mapped data (preserve patientNumber and ID)
    const updatedData = PatientMapper.fromFhir(fhirPatient);
    // Don't overwrite patientNumber or ID
    delete updatedData.patientNumber;
    
    Object.assign(existingPatient, updatedData);
    const savedPatient = await patientRepository.save(existingPatient);
    
    return PatientMapper.toFhir(savedPatient, tenantId);
  }

  async searchObservations(query: any, tenantDb: DataSource, tenantId: string) {
    const vitalsRepository = tenantDb.getRepository(Vitals);
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const entries: BundleEntry[] = [];

    // Search Vitals
    let vitalsQueryBuilder = vitalsRepository.createQueryBuilder('vitals');
    
    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        vitalsQueryBuilder.andWhere('vitals.patientId = :patientId', { patientId });
      }
    }
    
    if (query.date) {
      // Support date ranges: date=le2020-01-01, date=ge2020-01-01, date=2020-01-01
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        vitalsQueryBuilder.andWhere('vitals.recordedAt <= :date', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        vitalsQueryBuilder.andWhere('vitals.recordedAt >= :date', { date });
      } else {
        vitalsQueryBuilder.andWhere('DATE(vitals.recordedAt) = :date', { date: query.date });
      }
    }

    if (query.code) {
      // Search by LOINC code (e.g., code=http://loinc.org|8480-6)
      const codeParts = query.code.split('|');
      const loincCode = codeParts.length > 1 ? codeParts[1] : codeParts[0];
      // Map LOINC codes to vital types (simplified - can be enhanced)
      const vitalTypeMap: Record<string, string> = {
        '8480-6': 'bloodPressure',
        '8462-4': 'bloodPressure',
        '8867-4': 'heartRate',
        '8310-5': 'temperature',
        '59408-5': 'oxygenSaturation',
        '9279-1': 'respiratoryRate',
        '29463-7': 'weight',
        '8302-2': 'height',
        '39156-5': 'bmi',
        '2339-0': 'bloodGlucose',
      };
      // This is a simplified approach - in production, you'd want more sophisticated mapping
    }

    vitalsQueryBuilder.orderBy('vitals.recordedAt', 'DESC').take(100);
    const vitals = await vitalsQueryBuilder.getMany();

    // Convert vitals to observations
    vitals.forEach(vital => {
      const observations = ObservationMapper.vitalsToFhir(vital, tenantId);
      observations.forEach(obs => {
        entries.push({
          resource: obs,
          search: { mode: 'match' as const },
        });
      });
    });

    // Search Lab Orders
    let labQueryBuilder = labOrderRepository.createQueryBuilder('labOrder');
    
    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        labQueryBuilder.andWhere('labOrder.patientId = :patientId', { patientId });
      }
    }
    
    if (query.date) {
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        labQueryBuilder.andWhere('(labOrder.scheduledDateTime <= :date OR labOrder.collectedAt <= :date OR labOrder.createdAt <= :date)', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        labQueryBuilder.andWhere('(labOrder.scheduledDateTime >= :date OR labOrder.collectedAt >= :date OR labOrder.createdAt >= :date)', { date });
      } else {
        labQueryBuilder.andWhere('(DATE(labOrder.scheduledDateTime) = :date OR DATE(labOrder.collectedAt) = :date OR DATE(labOrder.createdAt) = :date)', { date: query.date });
      }
    }

    labQueryBuilder.orderBy('labOrder.createdAt', 'DESC').take(100);
    const labOrders = await labQueryBuilder.getMany();

    // Convert lab orders to observations
    labOrders.forEach(labOrder => {
      const observations = ObservationMapper.labOrderToFhir(labOrder, tenantId);
      observations.forEach(obs => {
        entries.push({
          resource: obs,
          search: { mode: 'match' as const },
        });
      });
    });

    // Pagination
    const page = parseInt(query._page) || 1;
    const count = Math.min(parseInt(query._count) || 10, 100);
    const offset = (page - 1) * count;
    const paginatedEntries = entries.slice(offset, offset + count);

    return {
      resourceType: 'Bundle',
      id: `search-observations-${Date.now()}`,
      type: 'searchset',
      total: entries.length,
      link: [
        {
          relation: 'self',
          url: `?${new URLSearchParams(query).toString()}`,
        },
        ...(page > 1 ? [{
          relation: 'previous',
          url: `?_page=${page - 1}&_count=${count}`,
        }] : []),
        ...(offset + count < entries.length ? [{
          relation: 'next',
          url: `?_page=${page + 1}&_count=${count}`,
        }] : []),
      ],
      entry: paginatedEntries,
    };
  }

  async searchEncounters(query: any, tenantDb: DataSource, tenantId: string) {
    const appointmentRepository = tenantDb.getRepository(Appointment);
    const admissionRepository = tenantDb.getRepository(Admission);
    const entries: BundleEntry[] = [];

    // Search Appointments using QueryBuilder
    let appointmentQueryBuilder = appointmentRepository.createQueryBuilder('appointment');

    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        appointmentQueryBuilder.andWhere('appointment.patientId = :patientId', { patientId });
      }
    }
    if (query.status) {
      // Map FHIR status to appointment status
      const statusMap: Record<string, string> = {
        'planned': 'scheduled',
        'arrived': 'checked-in',
        'in-progress': 'in-progress',
        'finished': 'completed',
        'cancelled': 'cancelled',
      };
      const mappedStatus = statusMap[query.status] || query.status;
      appointmentQueryBuilder.andWhere('appointment.status = :status', { status: mappedStatus });
    }
    if (query.date) {
      // Support date ranges: date=le2020-01-01, date=ge2020-01-01, date=2020-01-01
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        appointmentQueryBuilder.andWhere('appointment.appointmentDate <= :date', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        appointmentQueryBuilder.andWhere('appointment.appointmentDate >= :date', { date });
      } else {
        appointmentQueryBuilder.andWhere('DATE(appointment.appointmentDate) = :date', { date: query.date });
      }
    }

    appointmentQueryBuilder.orderBy('appointment.appointmentDate', 'DESC').take(100);
    const appointments = await appointmentQueryBuilder.getMany();

    appointments.forEach(appointment => {
      entries.push({
        resource: EncounterMapper.appointmentToFhir(appointment, tenantId),
        search: { mode: 'match' as const },
      });
    });

    // Search Admissions using QueryBuilder
    let admissionQueryBuilder = admissionRepository.createQueryBuilder('admission');

    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        admissionQueryBuilder.andWhere('admission.patientId = :patientId', { patientId });
      }
    }
    if (query.status) {
      const statusMap: Record<string, string> = {
        'in-progress': 'active',
        'finished': 'discharged',
        'cancelled': 'cancelled',
      };
      const mappedStatus = statusMap[query.status] || query.status;
      admissionQueryBuilder.andWhere('admission.admissionStatus = :status', { status: mappedStatus });
    }
    if (query.date) {
      // Support date ranges: date=le2020-01-01, date=ge2020-01-01, date=2020-01-01
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        admissionQueryBuilder.andWhere('admission.admissionDate <= :date', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        admissionQueryBuilder.andWhere('admission.admissionDate >= :date', { date });
      } else {
        admissionQueryBuilder.andWhere('DATE(admission.admissionDate) = :date', { date: query.date });
      }
    }

    admissionQueryBuilder.orderBy('admission.admissionDate', 'DESC').take(100);
    const admissions = await admissionQueryBuilder.getMany();

    admissions.forEach(admission => {
      entries.push({
        resource: EncounterMapper.admissionToFhir(admission, tenantId),
        search: { mode: 'match' as const },
      });
    });

    // Pagination
    const page = parseInt(query._page) || 1;
    const count = Math.min(parseInt(query._count) || 10, 100);
    const offset = (page - 1) * count;
    const paginatedEntries = entries.slice(offset, offset + count);

    return {
      resourceType: 'Bundle',
      id: `search-encounters-${Date.now()}`,
      type: 'searchset',
      total: entries.length,
      link: [
        {
          relation: 'self',
          url: `?${new URLSearchParams(query).toString()}`,
        },
        ...(page > 1 ? [{
          relation: 'previous',
          url: `?_page=${page - 1}&_count=${count}`,
        }] : []),
        ...(offset + count < entries.length ? [{
          relation: 'next',
          url: `?_page=${page + 1}&_count=${count}`,
        }] : []),
      ],
      entry: paginatedEntries,
    };
  }

  async searchMedicationRequests(query: any, tenantDb: DataSource, tenantId: string) {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    let queryBuilder = prescriptionRepository.createQueryBuilder('prescription');

    // FHIR Search Parameters
    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        queryBuilder.andWhere('prescription.patientId = :patientId', { patientId });
      }
    }

    if (query.status) {
      // Map FHIR status to PrescriptionStatus
      const statusMap: Record<string, PrescriptionStatus> = {
        'active': PrescriptionStatus.ACTIVE,
        'completed': PrescriptionStatus.COMPLETED,
        'cancelled': PrescriptionStatus.CANCELLED,
        'stopped': PrescriptionStatus.EXPIRED,
        'entered-in-error': PrescriptionStatus.CANCELLED,
        'draft': PrescriptionStatus.ACTIVE,
        'on-hold': PrescriptionStatus.ACTIVE,
      };
      const mappedStatus = statusMap[query.status] || PrescriptionStatus.ACTIVE;
      queryBuilder.andWhere('prescription.status = :status', { status: mappedStatus });
    }

    if (query.medication) {
      // Search by medication name or SNOMED code (RxNorm columns don't exist in DB)
      const medicationValue = this.extractId(query.medication) || query.medication;
      queryBuilder.andWhere(
        '(prescription.medication_name ILIKE :medication OR prescription.medication_name_snomed_code = :medicationCode)',
        { medication: `%${medicationValue}%`, medicationCode: medicationValue }
      );
    }

    if (query.date) {
      // Support date ranges: date=le2020-01-01, date=ge2020-01-01, date=2020-01-01
      // Use prescribed_date column (not startDate which doesn't exist)
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('prescription.prescribed_date <= :date', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('prescription.prescribed_date >= :date', { date });
      } else {
        queryBuilder.andWhere('DATE(prescription.prescribed_date) = :date', { date: query.date });
      }
    }

    if (query.intent) {
      // All prescriptions are 'order' intent, but we can filter if needed
      // For now, just validate it's 'order'
      if (query.intent !== 'order') {
        // Return empty bundle if intent is not 'order'
        return this.buildBundle([]);
      }
    }

    // Pagination
    const page = parseInt(query._page) || 1;
    const count = Math.min(parseInt(query._count) || 10, 100);
    const offset = (page - 1) * count;

    queryBuilder.orderBy('prescription.createdAt', 'DESC').skip(offset).take(count);
    const [prescriptions, total] = await queryBuilder.getManyAndCount();

    const entries = prescriptions.map((prescription) => ({
      resource: MedicationRequestMapper.toFhir(prescription, tenantId),
      search: { mode: 'match' as const },
    }));

    return {
      resourceType: 'Bundle',
      id: `search-medication-requests-${Date.now()}`,
      type: 'searchset',
      total,
      link: [
        {
          relation: 'self',
          url: `MedicationRequest?${new URLSearchParams(query).toString()}`,
        },
      ],
      entry: entries,
    };
  }

  async getMedicationRequest(id: string, tenantDb: DataSource, tenantId: string) {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    const prescription = await prescriptionRepository.findOne({ where: { id } });

    if (!prescription) {
      throw new NotFoundException(`MedicationRequest with ID ${id} not found`);
    }

    return MedicationRequestMapper.toFhir(prescription, tenantId);
  }

  async createMedicationRequest(fhirMedicationRequest: any, tenantDb: DataSource, tenantId: string) {
    // Validate FHIR resource
    if (fhirMedicationRequest.resourceType !== 'MedicationRequest') {
      throw new BadRequestException('Resource must be of type MedicationRequest');
    }

    // Map from FHIR to entity
    const prescriptionData = MedicationRequestMapper.fromFhir(fhirMedicationRequest, tenantId);
    
    // Extract patient ID from subject reference
    const patientId = this.fhirValidator?.extractIdFromReference(fhirMedicationRequest.subject?.reference) ||
                      this.extractId(fhirMedicationRequest.subject?.reference) ||
                      fhirMedicationRequest.subject?.reference?.split('/')[1];
    
    if (!patientId) {
      throw new BadRequestException('Patient reference is required');
    }

    // Extract prescriber ID from requester reference
    const prescriberId = this.fhirValidator?.extractIdFromReference(fhirMedicationRequest.requester?.reference) ||
                         this.extractId(fhirMedicationRequest.requester?.reference) ||
                         fhirMedicationRequest.requester?.reference?.split('/')[1];
    
    if (!prescriberId) {
      throw new BadRequestException('Requester (prescriber) reference is required');
    }

    // Create prescription
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    // Map only fields that exist in database schema (RxNorm columns don't exist)
    const prescription = prescriptionRepository.create({
      medicationName: prescriptionData.medicationName,
      medicationNameSnomedCode: prescriptionData.medicationNameSnomedCode,
      medicationNameSnomedTerm: prescriptionData.medicationNameSnomedTerm,
      medicationNameSnomedModuleId: prescriptionData.medicationNameSnomedModuleId,
      medicationNameSnomedDefinitionStatus: prescriptionData.medicationNameSnomedDefinitionStatus,
      dosage: prescriptionData.dosage || '',
      frequency: prescriptionData.frequency || '',
      duration: prescriptionData.duration,
      quantity: prescriptionData.quantity || 1,
      instructions: prescriptionData.instructions,
      status: prescriptionData.status || PrescriptionStatus.ACTIVE,
      patientId,
      prescriberId: prescriberId, // Maps to doctor_id column
      medicalRecordId: prescriptionData.medicalRecordId,
      prescribedDate: prescriptionData.startDate ? new Date(prescriptionData.startDate) : new Date(),
    } as any);

    const saved = await prescriptionRepository.save(prescription);
    return MedicationRequestMapper.toFhir(saved, tenantId);
  }

  async updateMedicationRequest(id: string, fhirMedicationRequest: any, tenantDb: DataSource, tenantId: string) {
    // Validate
    if (fhirMedicationRequest.resourceType !== 'MedicationRequest') {
      throw new BadRequestException('Resource must be of type MedicationRequest');
    }

    // Get existing
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    const existing = await prescriptionRepository.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`MedicationRequest with ID ${id} not found`);
    }

    // Update - only update fields that exist in database schema
    const updates = MedicationRequestMapper.fromFhir(fhirMedicationRequest, tenantId);
    const updateData: any = {
      medicationName: updates.medicationName || existing.medicationName,
      medicationNameSnomedCode: updates.medicationNameSnomedCode,
      medicationNameSnomedTerm: updates.medicationNameSnomedTerm,
      medicationNameSnomedModuleId: updates.medicationNameSnomedModuleId,
      medicationNameSnomedDefinitionStatus: updates.medicationNameSnomedDefinitionStatus,
      dosage: updates.dosage || existing.dosage,
      frequency: updates.frequency || existing.frequency,
      duration: updates.duration,
      quantity: updates.quantity !== undefined ? updates.quantity : existing.quantity,
      instructions: updates.instructions,
      status: updates.status || existing.status,
    };
    if (updates.startDate) {
      updateData.prescribedDate = new Date(updates.startDate);
    }
    
    await prescriptionRepository.update(id, updateData);
    // Use query builder to avoid updated_at column issue
    const saved = await prescriptionRepository
      .createQueryBuilder('prescription')
      .where('prescription.id = :id', { id })
      .getOne();

    if (!saved) {
      throw new NotFoundException(`MedicationRequest with ID ${id} not found after update`);
    }

    return MedicationRequestMapper.toFhir(saved, tenantId);
  }

  async deleteMedicationRequest(id: string, tenantDb: DataSource, tenantId: string) {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    const prescription = await prescriptionRepository.findOne({ where: { id } });

    if (!prescription) {
      throw new NotFoundException(`MedicationRequest with ID ${id} not found`);
    }

    // Cancel the prescription (soft delete by changing status)
    // Use update() instead of save() to avoid updated_at column issue
    await prescriptionRepository.update(id, { status: PrescriptionStatus.CANCELLED });
    // Use query builder to avoid updated_at column issue
    const saved = await prescriptionRepository
      .createQueryBuilder('prescription')
      .where('prescription.id = :id', { id })
      .getOne();

    if (!saved) {
      throw new NotFoundException(`MedicationRequest with ID ${id} not found after cancellation`);
    }

    return MedicationRequestMapper.toFhir(saved, tenantId);
  }

  async searchDiagnosticReports(query: any, tenantDb: DataSource, tenantId: string) {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    let queryBuilder = labOrderRepository.createQueryBuilder('labOrder');

    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        queryBuilder.andWhere('labOrder.patient_id = :patientId', { patientId });
      }
    }

    if (query.status) {
      // Map FHIR status to LabOrderStatus
      const statusMap: Record<string, LabOrderStatus> = {
        'registered': LabOrderStatus.ORDERED,
        'partial': LabOrderStatus.COLLECTED,
        'preliminary': LabOrderStatus.IN_PROGRESS,
        'final': LabOrderStatus.COMPLETED,
        'amended': LabOrderStatus.COMPLETED,
        'corrected': LabOrderStatus.COMPLETED,
        'appended': LabOrderStatus.COMPLETED,
        'cancelled': LabOrderStatus.CANCELLED,
      };
      const mappedStatus = statusMap[query.status] || LabOrderStatus.ORDERED;
      queryBuilder.andWhere('labOrder.status = :status', { status: mappedStatus });
    }

    if (query.date) {
      // Support date ranges: date=le2020-01-01, date=ge2020-01-01, date=2020-01-01
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('labOrder.collected_at <= :date OR labOrder.scheduled_date_time <= :date', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('labOrder.collected_at >= :date OR labOrder.scheduled_date_time >= :date', { date });
      } else {
        queryBuilder.andWhere('DATE(labOrder.collected_at) = :date OR DATE(labOrder.scheduled_date_time) = :date', { date: query.date });
      }
    }

    if (query.code) {
      // Search by LOINC, SNOMED, or CPT code
      const codeValue = this.extractId(query.code) || query.code;
      queryBuilder.andWhere(
        '(labOrder.loinc_code = :code OR labOrder.snomed_concept_id = :code OR labOrder.cpt_code = :code)',
        { code: codeValue }
      );
    }

    // Pagination
    const page = parseInt(query._page) || 1;
    const count = Math.min(parseInt(query._count) || 10, 100);
    const offset = (page - 1) * count;

    queryBuilder.orderBy('labOrder.created_at', 'DESC').skip(offset).take(count);
    const [labOrders, total] = await queryBuilder.getManyAndCount();

    const entries = labOrders.map((labOrder) => ({
      resource: DiagnosticReportMapper.toFhir(labOrder, tenantId),
      search: { mode: 'match' as const },
    }));

    return {
      resourceType: 'Bundle',
      id: `search-diagnostic-reports-${Date.now()}`,
      type: 'searchset',
      total,
      link: [
        {
          relation: 'self',
          url: `DiagnosticReport?${new URLSearchParams(query).toString()}`,
        },
      ],
      entry: entries,
    };
  }

  async getDiagnosticReport(id: string, tenantDb: DataSource, tenantId: string) {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const labOrder = await labOrderRepository.findOne({ where: { id } });

    if (!labOrder) {
      throw new NotFoundException(`DiagnosticReport with ID ${id} not found`);
    }

    return DiagnosticReportMapper.toFhir(labOrder, tenantId);
  }

  async createDiagnosticReport(fhirDiagnosticReport: any, tenantDb: DataSource, tenantId: string) {
    if (fhirDiagnosticReport.resourceType !== 'DiagnosticReport') {
      throw new BadRequestException('Resource must be of type DiagnosticReport');
    }

    const labOrderData = DiagnosticReportMapper.fromFhir(fhirDiagnosticReport, tenantId);
    
    const patientId = this.fhirValidator?.extractIdFromReference(fhirDiagnosticReport.subject?.reference) ||
                      this.extractId(fhirDiagnosticReport.subject?.reference) ||
                      fhirDiagnosticReport.subject?.reference?.split('/')[1];
    
    if (!patientId) {
      throw new BadRequestException('Patient reference is required');
    }

    const orderingProviderId = this.fhirValidator?.extractIdFromReference(fhirDiagnosticReport.performer?.[0]?.reference) ||
                               this.extractId(fhirDiagnosticReport.performer?.[0]?.reference) ||
                               fhirDiagnosticReport.performer?.[0]?.reference?.split('/')[1];
    
    if (!orderingProviderId) {
      throw new BadRequestException('Performer (ordering provider) reference is required');
    }

    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const labOrder = labOrderRepository.create({
      ...labOrderData,
      patientId,
      orderingProviderId,
    } as any);

    const saved = await labOrderRepository.save(labOrder);
    return DiagnosticReportMapper.toFhir(saved, tenantId);
  }

  async updateDiagnosticReport(id: string, fhirDiagnosticReport: any, tenantDb: DataSource, tenantId: string) {
    if (fhirDiagnosticReport.resourceType !== 'DiagnosticReport') {
      throw new BadRequestException('Resource must be of type DiagnosticReport');
    }

    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const existing = await labOrderRepository.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`DiagnosticReport with ID ${id} not found`);
    }

    const updates = DiagnosticReportMapper.fromFhir(fhirDiagnosticReport, tenantId);
    
    // Update only fields that exist in database schema
    const updateData: any = {
      tests: updates.tests || existing.tests,
      loincCode: updates.loincCode,
      loincLongName: updates.loincLongName,
      snomedConceptId: updates.snomedConceptId,
      snomedTerm: updates.snomedTerm,
      cptCode: updates.cptCode,
      status: updates.status || existing.status,
      priority: updates.priority || existing.priority,
      clinicalInfo: updates.clinicalInfo,
      specialInstructions: updates.specialInstructions,
      scheduledDateTime: updates.scheduledDateTime,
      collectedAt: updates.collectedAt,
      collectedById: updates.collectedById,
      results: updates.results,
      interpretation: updates.interpretation,
      reviewedById: updates.reviewedById,
      reviewedAt: updates.reviewedAt,
      attachments: updates.attachments,
    };
    
    await labOrderRepository.update(id, updateData);
    const saved = await labOrderRepository
      .createQueryBuilder('labOrder')
      .where('labOrder.id = :id', { id })
      .getOne();

    if (!saved) {
      throw new NotFoundException(`DiagnosticReport with ID ${id} not found after update`);
    }

    return DiagnosticReportMapper.toFhir(saved, tenantId);
  }

  async searchConditions(query: any, tenantDb: DataSource, tenantId: string) {
    const problemRepository = tenantDb.getRepository(Problem);
    let queryBuilder = problemRepository.createQueryBuilder('problem');

    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        queryBuilder.andWhere('problem.patient_id = :patientId', { patientId });
      }
    }

    if (query['clinical-status']) {
      // Map FHIR clinical status to Problem status
      const clinicalStatus = query['clinical-status'];
      if (clinicalStatus === 'resolved' || clinicalStatus === 'inactive') {
        queryBuilder.andWhere('problem.status = :status', { status: 'resolved' });
      } else if (clinicalStatus === 'active' || clinicalStatus === 'recurrence' || clinicalStatus === 'relapse') {
        queryBuilder.andWhere('problem.status = :status', { status: 'active' });
      }
    }

    if (query.category) {
      // Category filtering - for now we only support problem-list-item
      // Could be extended to filter by encounter-diagnosis if we add that field
      if (query.category !== 'problem-list-item') {
        // Return empty bundle if category doesn't match
        return {
          resourceType: 'Bundle',
          id: `search-conditions-${Date.now()}`,
          type: 'searchset',
          total: 0,
          entry: [],
        };
      }
    }

    if (query.severity) {
      // Severity is stored in notes, so we search in notes
      const severityValue = query.severity.toLowerCase();
      queryBuilder.andWhere('LOWER(problem.notes) LIKE :severity', { severity: `%${severityValue}%` });
    }

    if (query['onset-date']) {
      // Support date ranges: onset-date=le2020-01-01, onset-date=ge2020-01-01, onset-date=2020-01-01
      const dateParam = query['onset-date'];
      if (dateParam.startsWith('le')) {
        const date = dateParam.substring(2);
        queryBuilder.andWhere('problem.onset_date <= :date', { date });
      } else if (dateParam.startsWith('ge')) {
        const date = dateParam.substring(2);
        queryBuilder.andWhere('problem.onset_date >= :date', { date });
      } else {
        queryBuilder.andWhere('DATE(problem.onset_date) = :date', { date: dateParam });
      }
    }

    // Pagination
    const page = parseInt(query._page) || 1;
    const count = Math.min(parseInt(query._count) || 10, 100);
    const offset = (page - 1) * count;

    queryBuilder.orderBy('problem.created_at', 'DESC').skip(offset).take(count);
    const [problems, total] = await queryBuilder.getManyAndCount();

    const entries = problems.map((problem) => ({
      resource: ConditionMapper.toFhir(problem, tenantId),
      search: { mode: 'match' as const },
    }));

    return {
      resourceType: 'Bundle',
      id: `search-conditions-${Date.now()}`,
      type: 'searchset',
      total,
      link: [
        {
          relation: 'self',
          url: `Condition?${new URLSearchParams(query).toString()}`,
        },
      ],
      entry: entries,
    };
  }

  async getCondition(id: string, tenantDb: DataSource, tenantId: string) {
    const problemRepository = tenantDb.getRepository(Problem);
    const problem = await problemRepository.findOne({ where: { id } });

    if (!problem) {
      throw new NotFoundException(`Condition with ID ${id} not found`);
    }

    return ConditionMapper.toFhir(problem, tenantId);
  }

  async createCondition(fhirCondition: any, tenantDb: DataSource, tenantId: string) {
    if (fhirCondition.resourceType !== 'Condition') {
      throw new BadRequestException('Resource must be of type Condition');
    }

    const problemData = ConditionMapper.fromFhir(fhirCondition, tenantId);
    
    const patientId = this.fhirValidator?.extractIdFromReference(fhirCondition.subject?.reference) ||
                      this.extractId(fhirCondition.subject?.reference) ||
                      fhirCondition.subject?.reference?.split('/')[1];
    
    if (!patientId) {
      throw new BadRequestException('Patient reference is required');
    }

    const problemRepository = tenantDb.getRepository(Problem);
    const problem = problemRepository.create({
      ...problemData,
      patientId,
    } as any);

    const saved = await problemRepository.save(problem);
    return ConditionMapper.toFhir(saved, tenantId);
  }

  async updateCondition(id: string, fhirCondition: any, tenantDb: DataSource, tenantId: string) {
    if (fhirCondition.resourceType !== 'Condition') {
      throw new BadRequestException('Resource must be of type Condition');
    }

    const problemRepository = tenantDb.getRepository(Problem);
    const existing = await problemRepository.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Condition with ID ${id} not found`);
    }

    const updates = ConditionMapper.fromFhir(fhirCondition, tenantId);
    
    // Update only fields that exist in database schema
    const updateData: any = {
      code: updates.code || existing.code,
      codeSystem: updates.codeSystem || existing.codeSystem,
      snomedConceptId: updates.snomedConceptId,
      snomedTerm: updates.snomedTerm,
      description: updates.description || existing.description,
      status: updates.status || existing.status,
      onsetDate: updates.onsetDate,
      resolvedDate: updates.resolvedDate,
      notes: updates.notes,
    };
    
    await problemRepository.update(id, updateData);
    const saved = await problemRepository
      .createQueryBuilder('problem')
      .where('problem.id = :id', { id })
      .getOne();

    if (!saved) {
      throw new NotFoundException(`Condition with ID ${id} not found after update`);
    }

    return ConditionMapper.toFhir(saved, tenantId);
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

  patientToFhir(patient: Patient): any {
    const extendedPatient = patient as Patient & {
      middleName?: string;
      province?: string;
      postalCode?: string;
      maritalStatus?: string;
    };
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
      name: [
        {
          use: 'official',
          family: patient.lastName,
          given: [patient.firstName, ...(extendedPatient.middleName ? [extendedPatient.middleName] : [])],
        },
      ],
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
        state: extendedPatient.province,
        postalCode: extendedPatient.postalCode,
      }],
      maritalStatus: extendedPatient.maritalStatus
        ? {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
            code: extendedPatient.maritalStatus.toUpperCase(),
            display: extendedPatient.maritalStatus,
        }]
          }
        : undefined,
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
      dateOfBirth: new Date(fhirPatient.birthDate),
      gender: fhirPatient.gender,
      phone: fhirPatient.telecom?.find(t => t.system === 'phone')?.value || '',
      email: fhirPatient.telecom?.find(t => t.system === 'email')?.value,
      address: fhirPatient.address?.[0]?.text || '',
      city: fhirPatient.address?.[0]?.city,
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

  appointmentToEncounter(appointment: Appointment): any {
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

  prescriptionToMedicationRequest(prescription: Prescription): any {
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

  // Removed: labOrderToDiagnosticReport - now using DiagnosticReportMapper

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

  private buildResourceCapability(resourceType: string) {
    return {
      type: resourceType,
      interaction: [
        { code: 'read' },
        { code: 'search-type' },
        { code: 'create' },
        { code: 'update' },
      ],
      versioning: 'no-version',
      readHistory: false,
      updateCreate: false,
    };
  }

  private extractId(reference?: string | null): string | undefined {
    if (!reference) {
      return undefined;
    }
    const parts = reference.split('/');
    return parts[parts.length - 1] || undefined;
  }

  private buildBundle(entries: BundleEntry[], type: 'searchset' | 'collection' = 'searchset') {
    return {
      resourceType: 'Bundle',
      id: `bundle-${Date.now()}`,
      type,
      total: entries.length,
      entry: entries,
    };
  }

  private mapEncounterStatus(status: string) {
    switch (status) {
      case 'completed':
        return 'finished';
      case 'in_progress':
      case 'in-progress':
        return 'in-progress';
      case 'cancelled':
        return 'cancelled';
      case 'no_show':
      case 'no-show':
        return 'cancelled';
      default:
        return 'planned';
    }
  }

  private mapMedicationStatus(status: string) {
    switch (status) {
      case 'active':
      case 'issued':
        return 'active';
      case 'completed':
        return 'completed';
      case 'stopped':
      case 'cancelled':
        return 'stopped';
      case 'draft':
        return 'draft';
      default:
        return 'active';
    }
  }

  // Removed: mapDiagnosticReportStatus - now using DiagnosticReportMapper

  private medicalRecordToDocumentReference(record: MedicalRecord) {
    const narrative =
      [record.chiefComplaint, record.historyOfPresentIllness, record.assessment, record.plan]
        .filter(Boolean)
        .join('\n\n') || 'Clinical note';

    return {
      resourceType: 'DocumentReference',
      id: record.id,
      status: 'current',
      type: {
        text: record.type,
      },
      subject: {
        reference: `Patient/${record.patientId}`,
      },
      author: record.providerId
        ? [
            {
              reference: `Practitioner/${record.providerId}`,
            },
          ]
        : undefined,
      date: record.recordDate?.toISOString(),
      description: record.chiefComplaint,
      content: record.attachments?.length
        ? record.attachments.map((attachment) => ({
            attachment: {
              title: attachment.filename,
              url: attachment.url,
              contentType: attachment.type || 'application/octet-stream',
            },
          }))
        : [
            {
              attachment: {
                contentType: 'text/plain',
                data: Buffer.from(narrative).toString('base64'),
              },
            },
          ],
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

  // ========== Immunization Resource ==========

  async searchImmunizations(query: any, tenantDb: DataSource, tenantId: string) {
    const immunizationRepository = tenantDb.getRepository(Immunization);
    let queryBuilder = immunizationRepository.createQueryBuilder('immunization');

    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        queryBuilder.andWhere('immunization.patient_id = :patientId', { patientId });
      }
    }

    if (query.status) {
      // Map FHIR status to completionStatus
      const statusMap: Record<string, string> = {
        'completed': 'completed',
        'entered-in-error': 'entered-in-error',
        'not-done': 'not-done',
      };
      const mappedStatus = statusMap[query.status] || 'completed';
      queryBuilder.andWhere('immunization.completion_status = :status', { status: mappedStatus });
    }

    if (query.date) {
      // Support date ranges: date=le2020-01-01, date=ge2020-01-01, date=2020-01-01
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('immunization.administration_date <= :date', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('immunization.administration_date >= :date', { date });
      } else {
        queryBuilder.andWhere('DATE(immunization.administration_date) = :date', { date: query.date });
      }
    }

    if (query['vaccine-code']) {
      // Search by vaccine code (CVX) or name
      const vaccineValue = this.extractId(query['vaccine-code']) || query['vaccine-code'];
      queryBuilder.andWhere(
        '(immunization.vaccine_code = :vaccineCode OR immunization.vaccine_name ILIKE :vaccineName)',
        { vaccineCode: vaccineValue, vaccineName: `%${vaccineValue}%` }
      );
    }

    // Pagination
    const page = parseInt(query._page) || 1;
    const count = Math.min(parseInt(query._count) || 10, 100);
    const offset = (page - 1) * count;

    queryBuilder.orderBy('immunization.administration_date', 'DESC').skip(offset).take(count);
    const [immunizations, total] = await queryBuilder.getManyAndCount();

    const entries = immunizations.map((immunization) => ({
      resource: ImmunizationMapper.toFhir(immunization, tenantId),
      search: { mode: 'match' as const },
    }));

    return {
      resourceType: 'Bundle',
      id: `search-immunizations-${Date.now()}`,
      type: 'searchset',
      total,
      link: [
        {
          relation: 'self',
          url: `Immunization?${new URLSearchParams(query).toString()}`,
        },
      ],
      entry: entries,
    };
  }

  async getImmunization(id: string, tenantDb: DataSource, tenantId: string) {
    const immunizationRepository = tenantDb.getRepository(Immunization);
    const immunization = await immunizationRepository.findOne({ where: { id } });

    if (!immunization) {
      throw new NotFoundException(`Immunization with ID ${id} not found`);
    }

    return ImmunizationMapper.toFhir(immunization, tenantId);
  }

  async createImmunization(fhirImmunization: any, tenantDb: DataSource, tenantId: string) {
    if (fhirImmunization.resourceType !== 'Immunization') {
      throw new BadRequestException('Resource must be of type Immunization');
    }

    const immunizationData = ImmunizationMapper.fromFhir(fhirImmunization, tenantId);
    
    const patientId = this.fhirValidator?.extractIdFromReference(fhirImmunization.patient?.reference) ||
                      this.extractId(fhirImmunization.patient?.reference) ||
                      fhirImmunization.patient?.reference?.split('/')[1];
    
    if (!patientId) {
      throw new BadRequestException('Patient reference is required');
    }

    const immunizationRepository = tenantDb.getRepository(Immunization);
    const immunization = immunizationRepository.create({
      ...immunizationData,
      patientId,
    } as any);

    const saved = await immunizationRepository.save(immunization);
    return ImmunizationMapper.toFhir(saved, tenantId);
  }

  async updateImmunization(id: string, fhirImmunization: any, tenantDb: DataSource, tenantId: string) {
    if (fhirImmunization.resourceType !== 'Immunization') {
      throw new BadRequestException('Resource must be of type Immunization');
    }

    const immunizationRepository = tenantDb.getRepository(Immunization);
    const existing = await immunizationRepository.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Immunization with ID ${id} not found`);
    }

    const updates = ImmunizationMapper.fromFhir(fhirImmunization, tenantId);
    await immunizationRepository.update(id, updates);
    
    const saved = await immunizationRepository
      .createQueryBuilder('immunization')
      .where('immunization.id = :id', { id })
      .getOne();

    if (!saved) {
      throw new NotFoundException(`Immunization with ID ${id} not found after update`);
    }

    return ImmunizationMapper.toFhir(saved, tenantId);
  }

  // ========== Procedure Resource ==========

  async searchProcedures(query: any, tenantDb: DataSource, tenantId: string) {
    const surgicalCaseRepository = tenantDb.getRepository(SurgicalCase);
    let queryBuilder = surgicalCaseRepository.createQueryBuilder('surgicalCase');

    if (query.patient) {
      const patientId = this.fhirValidator?.extractIdFromReference(query.patient) || this.extractId(query.patient);
      if (patientId) {
        queryBuilder.andWhere('surgicalCase.patient_id = :patientId', { patientId });
      }
    }

    if (query.status) {
      // Map FHIR status to SurgicalCase status
      const statusMap: Record<string, string> = {
        'preparation': 'scheduled',
        'in-progress': 'in-progress',
        'completed': 'completed',
        'not-done': 'cancelled',
        'on-hold': 'on-hold',
      };
      const mappedStatus = statusMap[query.status] || 'scheduled';
      queryBuilder.andWhere('surgicalCase.status = :status', { status: mappedStatus });
    }

    if (query.date) {
      // Support date ranges: date=le2020-01-01, date=ge2020-01-01, date=2020-01-01
      if (query.date.startsWith('le')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('surgicalCase.scheduled_date <= :date OR surgicalCase.actual_start_time <= :date', { date });
      } else if (query.date.startsWith('ge')) {
        const date = query.date.substring(2);
        queryBuilder.andWhere('surgicalCase.scheduled_date >= :date OR surgicalCase.actual_start_time >= :date', { date });
      } else {
        queryBuilder.andWhere('DATE(surgicalCase.scheduled_date) = :date OR DATE(surgicalCase.actual_start_time) = :date', { date: query.date });
      }
    }

    if (query.code) {
      // Search by CPT or SNOMED code
      const codeValue = this.extractId(query.code) || query.code;
      queryBuilder.andWhere(
        '(surgicalCase.procedure_code_cpt = :code OR surgicalCase.procedure_code_snomed = :code)',
        { code: codeValue }
      );
    }

    // Pagination
    const page = parseInt(query._page) || 1;
    const count = Math.min(parseInt(query._count) || 10, 100);
    const offset = (page - 1) * count;

    queryBuilder.orderBy('surgicalCase.scheduled_date', 'DESC').skip(offset).take(count);
    const [surgicalCases, total] = await queryBuilder.getManyAndCount();

    const entries = surgicalCases.map((surgicalCase) => ({
      resource: ProcedureMapper.toFhir(surgicalCase, tenantId),
      search: { mode: 'match' as const },
    }));

    return {
      resourceType: 'Bundle',
      id: `search-procedures-${Date.now()}`,
      type: 'searchset',
      total,
      link: [
        {
          relation: 'self',
          url: `Procedure?${new URLSearchParams(query).toString()}`,
        },
      ],
      entry: entries,
    };
  }

  async getProcedure(id: string, tenantDb: DataSource, tenantId: string) {
    const surgicalCaseRepository = tenantDb.getRepository(SurgicalCase);
    const surgicalCase = await surgicalCaseRepository.findOne({ where: { id } });

    if (!surgicalCase) {
      throw new NotFoundException(`Procedure with ID ${id} not found`);
    }

    return ProcedureMapper.toFhir(surgicalCase, tenantId);
  }

  async createProcedure(fhirProcedure: any, tenantDb: DataSource, tenantId: string) {
    if (fhirProcedure.resourceType !== 'Procedure') {
      throw new BadRequestException('Resource must be of type Procedure');
    }

    const procedureData = ProcedureMapper.fromFhir(fhirProcedure, tenantId);
    
    const patientId = this.fhirValidator?.extractIdFromReference(fhirProcedure.subject?.reference) ||
                      this.extractId(fhirProcedure.subject?.reference) ||
                      fhirProcedure.subject?.reference?.split('/')[1];
    
    if (!patientId) {
      throw new BadRequestException('Patient reference is required');
    }

    const surgicalCaseRepository = tenantDb.getRepository(SurgicalCase);
    const surgicalCase = surgicalCaseRepository.create({
      ...procedureData,
      patientId,
    } as any);

    const saved = await surgicalCaseRepository.save(surgicalCase);
    return ProcedureMapper.toFhir(saved, tenantId);
  }

  async updateProcedure(id: string, fhirProcedure: any, tenantDb: DataSource, tenantId: string) {
    if (fhirProcedure.resourceType !== 'Procedure') {
      throw new BadRequestException('Resource must be of type Procedure');
    }

    const surgicalCaseRepository = tenantDb.getRepository(SurgicalCase);
    const existing = await surgicalCaseRepository.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Procedure with ID ${id} not found`);
    }

    const updates = ProcedureMapper.fromFhir(fhirProcedure, tenantId);
    await surgicalCaseRepository.update(id, updates);
    
    const saved = await surgicalCaseRepository
      .createQueryBuilder('surgicalCase')
      .where('surgicalCase.id = :id', { id })
      .getOne();

    if (!saved) {
      throw new NotFoundException(`Procedure with ID ${id} not found after update`);
    }

    return ProcedureMapper.toFhir(saved, tenantId);
  }

  private procedureToFhir(proc: any, record: MedicalRecord): any {
    return {
      resourceType: 'Procedure',
      id: `${record.id}-${proc.code || 'proc'}`,
      status: 'completed',
      code: {
        text: proc.description || proc.code || 'Procedure',
        coding: proc.code ? [
          {
            system: 'http://snomed.info/sct',
            code: proc.code,
            display: proc.description,
          },
        ] : undefined,
      },
      subject: {
        reference: `Patient/${record.patientId}`,
      },
      performedDateTime: proc.date ? new Date(proc.date).toISOString() : record.recordDate?.toISOString(),
      performer: proc.provider ? [
        {
          actor: {
            display: proc.provider,
          },
        },
      ] : record.providerId ? [
        {
          actor: {
            reference: `Practitioner/${record.providerId}`,
          },
        },
      ] : undefined,
    };
  }

  // ========== Location Resource ==========

  async searchLocations(query: any, tenantDb: DataSource) {
    // Return default clinic location
    // In a real system, you'd have a locations table
    const location = {
      resourceType: 'Location',
      id: 'clinic',
      status: 'active',
      name: 'MediCore Clinic',
      description: 'Primary clinic location',
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: 'HOSP',
              display: 'Hospital',
            },
          ],
        },
      ],
      address: {
        use: 'work',
      },
    };

    return this.buildBundle([
      {
        resource: location,
        search: { mode: 'match' as const }
      }
    ]);
  }

  async getLocation(id: string, tenantDb: DataSource) {
    return {
      resourceType: 'Location',
      id: id,
      status: 'active',
      name: 'MediCore Clinic',
      description: 'Primary clinic location',
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: 'HOSP',
              display: 'Hospital',
            },
          ],
        },
      ],
    };
  }

  // ========== Organization Resource ==========

  async searchOrganizations(query: any, tenantDb: DataSource) {
    // Return default organization
    const organization = {
      resourceType: 'Organization',
      id: 'medicore',
      active: true,
      name: 'MediCore Solutions',
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'prov',
              display: 'Healthcare Provider',
            },
          ],
        },
      ],
    };

    return this.buildBundle([
      {
        resource: organization,
        search: { mode: 'match' as const }
      }
    ]);
  }

  async getOrganization(id: string, tenantDb: DataSource) {
    return {
      resourceType: 'Organization',
      id: id,
      active: true,
      name: 'MediCore Solutions',
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'prov',
              display: 'Healthcare Provider',
            },
          ],
        },
      ],
    };
  }

  // ========== Practitioner Resource ==========

  async searchPractitioners(query: any, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    
    let queryBuilder = userRepository.createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true });

    if (query.name) {
      queryBuilder.andWhere(
        '(user.firstName ILIKE :name OR user.lastName ILIKE :name)',
        { name: `%${query.name}%` }
      );
    }

    if (query.identifier) {
      queryBuilder.andWhere(
        '(user.licenseNumber = :identifier OR user.email = :identifier)',
        { identifier: query.identifier }
      );
    }

    const users = await queryBuilder.getMany();

    return this.buildBundle(
      users.map(user => ({
        resource: this.userToPractitioner(user),
        search: { mode: 'match' as const }
      }))
    );
  }

  async getPractitioner(id: string, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new Error('Practitioner not found');
    }

    return this.userToPractitioner(user);
  }

  private userToPractitioner(user: User): any {
    return {
      resourceType: 'Practitioner',
      id: user.id,
      active: user.isActive,
      name: [
        {
          use: 'official',
          family: user.lastName,
          given: [user.firstName],
        },
      ],
      telecom: [
        ...(user.email ? [{
          system: 'email',
          value: user.email,
        }] : []),
        ...(user.phone ? [{
          system: 'phone',
          value: user.phone,
        }] : []),
      ],
      identifier: user.licenseNumber ? [
        {
          system: 'http://medicore.co.zw/license',
          value: user.licenseNumber,
        },
      ] : undefined,
      qualification: user.specialization ? [
        {
          code: {
            text: user.specialization,
          },
        },
      ] : undefined,
    };
  }

  // ========== PractitionerRole Resource ==========

  async searchPractitionerRoles(query: any, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    
    let queryBuilder = userRepository.createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true });

    if (query.practitioner) {
      const practitionerId = this.extractId(query.practitioner);
      if (practitionerId) {
        queryBuilder.andWhere('user.id = :practitionerId', { practitionerId });
      }
    }

    const users = await queryBuilder.getMany();

    return this.buildBundle(
      users.map(user => ({
        resource: this.userToPractitionerRole(user),
        search: { mode: 'match' as const }
      }))
    );
  }

  async getPractitionerRole(id: string, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new Error('PractitionerRole not found');
    }

    return this.userToPractitionerRole(user);
  }

  private userToPractitionerRole(user: User): any {
    const roleCode = this.mapUserRoleToFhir(user.role);

    return {
      resourceType: 'PractitionerRole',
      id: `${user.id}-role`,
      active: user.isActive,
      practitioner: {
        reference: `Practitioner/${user.id}`,
      },
      organization: {
        reference: 'Organization/medicore',
      },
      code: roleCode ? [
        {
          coding: [roleCode],
        },
      ] : undefined,
      specialty: user.specialization ? [
        {
          coding: [
            {
              text: user.specialization,
            },
          ],
        },
      ] : undefined,
    };
  }

  private mapUserRoleToFhir(role: string): any {
    const roleMap: Record<string, any> = {
      doctor: {
        system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
        code: 'doctor',
        display: 'Doctor',
      },
      nurse: {
        system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
        code: 'nurse',
        display: 'Nurse',
      },
      pharmacist: {
        system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
        code: 'pharmacist',
        display: 'Pharmacist',
      },
      lab_tech: {
        system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
        code: 'lab',
        display: 'Laboratory Technician',
      },
      radiologist: {
        system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
        code: 'radiologist',
        display: 'Radiologist',
      },
    };

    return roleMap[role];
  }

  // ========== CarePlan Resource ==========

  async searchCarePlans(query: any, tenantDb: DataSource) {
    // Care plans can be derived from various sources
    // For now, return empty bundle - can be extended with diabetes care plans, oncology care plans, etc.
    return this.buildBundle([]);
  }

  async getCarePlan(id: string, tenantDb: DataSource) {
    // Placeholder - can be extended to fetch from diabetes_registry, oncology_cases, etc.
    throw new Error('CarePlan not found');
  }

  // ========== Medication Resource ==========

  async searchMedications(query: any, tenantDb: DataSource, tenantId: string) {
    const drugRepository = tenantDb.getRepository(Drug);
    const queryBuilder = drugRepository.createQueryBuilder('drug');

    // Search by code (RxNorm, SNOMED, ATC, NDC)
    if (query.code) {
      queryBuilder.andWhere(
        '(drug.rxnormCode = :code OR drug.snomedCode = :code OR drug.atcCode = :code OR drug.ndcCode = :code)',
        { code: query.code }
      );
    }

    // Search by status
    if (query.status) {
      queryBuilder.andWhere('drug.status = :status', { status: query.status });
    } else {
      // Default to active medications
      queryBuilder.andWhere('(drug.status = :status OR drug.isActive = :isActive)', {
        status: 'active',
        isActive: true,
      });
    }

    // Search by form (dosage form)
    if (query.form) {
      queryBuilder.andWhere('drug.dosageForms @> ARRAY[:form]', { form: query.form });
    }

    // Search by ingredient (active ingredient)
    if (query.ingredient) {
      queryBuilder.andWhere('drug.activeIngredients @> ARRAY[:ingredient]', {
        ingredient: query.ingredient,
      });
    }

    // Search by name (generic name or RxNorm name)
    if (query.name) {
      queryBuilder.andWhere(
        '(LOWER(drug.genericName) LIKE LOWER(:name) OR LOWER(drug.rxnormName) LIKE LOWER(:name))',
        { name: `%${query.name}%` }
      );
    }

    // Limit results
    const limit = query._count ? parseInt(query._count) : 50;
    queryBuilder.limit(Math.min(limit, 100));

    const drugs = await queryBuilder.getMany();

    return this.buildBundle(
      drugs.map(drug => ({
        resource: MedicationMapper.toFhir(drug, tenantId),
        search: { mode: 'match' as const },
      }))
    );
  }

  async getMedication(id: string, tenantDb: DataSource, tenantId: string) {
    const drugRepository = tenantDb.getRepository(Drug);
    const drug = await drugRepository.findOne({ where: { id } });

    if (!drug) {
      throw new NotFoundException(`Medication with ID ${id} not found`);
    }

    return MedicationMapper.toFhir(drug, tenantId);
  }

  async createMedication(fhirMedication: any, tenantDb: DataSource, tenantId: string) {
    // Validate FHIR resource
    if (this.fhirValidator) {
      await this.fhirValidator.validateResource(fhirMedication, 'Medication');
    }

    // Map to entity
    const drugRepository = tenantDb.getRepository(Drug);
    const drugData = MedicationMapper.fromFhir(fhirMedication);

    // Check if drug with same RxNorm code already exists
    if (drugData.rxnormCode) {
      const existing = await drugRepository.findOne({
        where: { rxnormCode: drugData.rxnormCode },
      });
      if (existing) {
        throw new BadRequestException(
          `Medication with RxNorm code ${drugData.rxnormCode} already exists`
        );
      }
    }

    // Create and save
    const drug = drugRepository.create(drugData);
    const savedDrug = await drugRepository.save(drug);

    return MedicationMapper.toFhir(savedDrug, tenantId);
  }

  async updateMedication(id: string, fhirMedication: any, tenantDb: DataSource, tenantId: string) {
    // Validate FHIR resource
    if (this.fhirValidator) {
      await this.fhirValidator.validateResource(fhirMedication, 'Medication');
    }

    const drugRepository = tenantDb.getRepository(Drug);
    const drug = await drugRepository.findOne({ where: { id } });

    if (!drug) {
      throw new NotFoundException(`Medication with ID ${id} not found`);
    }

    // Map to entity
    const drugData = MedicationMapper.fromFhir(fhirMedication);

    // Update drug
    Object.assign(drug, drugData);
    const updatedDrug = await drugRepository.save(drug);

    return MedicationMapper.toFhir(updatedDrug, tenantId);
  }

  async deleteMedication(id: string, tenantDb: DataSource) {
    const drugRepository = tenantDb.getRepository(Drug);
    const drug = await drugRepository.findOne({ where: { id } });

    if (!drug) {
      throw new NotFoundException(`Medication with ID ${id} not found`);
    }

    // Soft delete by setting status to inactive
    drug.status = 'inactive';
    drug.isActive = false;
    await drugRepository.save(drug);

    return { status: 'deleted', id };
  }

  // ========== MedicationDispense Resource ==========

  async searchMedicationDispenses(query: any, tenantDb: DataSource, tenantId: string) {
    const dispensingRepository = tenantDb.getRepository(PharmacyDispensing);
    const queryBuilder = dispensingRepository.createQueryBuilder('dispensing')
      .leftJoinAndSelect('dispensing.patient', 'patient')
      .leftJoinAndSelect('dispensing.prescription', 'prescription')
      .leftJoinAndSelect('dispensing.dispensedBy', 'dispensedBy');

    // Search by patient
    if (query.patient) {
      const patientId = this.extractId(query.patient);
      if (patientId) {
        queryBuilder.andWhere('dispensing.patientId = :patientId', { patientId });
      }
    }

    // Search by status
    if (query.status) {
      queryBuilder.andWhere('dispensing.status = :status', { status: query.status });
    }

    // Search by prescription (MedicationRequest)
    if (query.prescription) {
      const prescriptionId = this.extractId(query.prescription);
      if (prescriptionId) {
        queryBuilder.andWhere('dispensing.prescriptionId = :prescriptionId', { prescriptionId });
      }
    }

    // Search by performer (pharmacist)
    if (query.performer) {
      const performerId = this.extractId(query.performer);
      if (performerId) {
        queryBuilder.andWhere('dispensing.dispensedById = :performerId', { performerId });
      }
    }

    // Search by medication (via items) - will filter after loading items
    // Note: This requires loading items separately for accurate filtering
    // For now, we'll load all and filter in memory if needed
    
    // Search by code (RxNorm code) - will filter after loading items

    // Limit results
    const limit = query._count ? parseInt(query._count) : 50;
    queryBuilder.limit(Math.min(limit, 100));
    queryBuilder.orderBy('dispensing.dispensingDate', 'DESC');

    const dispensings = await queryBuilder.getMany();

    // Load items for each dispensing
    const itemsRepository = tenantDb.getRepository(PharmacyDispensingItem);
    const results = await Promise.all(
      dispensings.map(async (dispensing) => {
        const items = await itemsRepository.find({
          where: { dispensingId: dispensing.id },
        });
        return {
          dispensing,
          items,
        };
      })
    );

    // Filter out null results if filtering was applied
    const validResults = results.filter((r): r is { dispensing: PharmacyDispensing; items: PharmacyDispensingItem[] } => r !== null);
    
    return this.buildBundle(
      validResults.map(({ dispensing, items }) => ({
        resource: MedicationDispenseMapper.toFhir(
          dispensing,
          items,
          dispensing.prescription,
          tenantId
        ),
        search: { mode: 'match' as const },
      }))
    );
  }

  async getMedicationDispense(id: string, tenantDb: DataSource, tenantId: string) {
    const dispensingRepository = tenantDb.getRepository(PharmacyDispensing);
    const dispensing = await dispensingRepository.findOne({
      where: { id },
      relations: ['patient', 'prescription', 'dispensedBy'],
    });

    if (!dispensing) {
      throw new NotFoundException(`MedicationDispense with ID ${id} not found`);
    }

    // Load items (without relations to avoid TypeORM issues)
    const itemsRepository = tenantDb.getRepository(PharmacyDispensingItem);
    const items = await itemsRepository.find({
      where: { dispensingId: dispensing.id },
    });

    return MedicationDispenseMapper.toFhir(
      dispensing,
      items,
      dispensing.prescription,
      tenantId
    );
  }

  async createMedicationDispense(fhirDispense: any, tenantDb: DataSource, tenantId: string) {
    // Validate FHIR resource
    if (this.fhirValidator) {
      await this.fhirValidator.validateResource(fhirDispense, 'MedicationDispense');
    }

    // Map to entity
    const dispensingRepository = tenantDb.getRepository(PharmacyDispensing);
    const dispensingData = MedicationDispenseMapper.fromFhir(fhirDispense);

    // Create dispensing
    const dispensing = dispensingRepository.create(dispensingData);
    const savedDispensing = await dispensingRepository.save(dispensing);

    // Load items for response (if any exist)
    // Note: Items may not exist yet for a new dispensing, so we load empty array
    const itemsRepository = tenantDb.getRepository(PharmacyDispensingItem);
    const items: PharmacyDispensingItem[] = await itemsRepository.find({
      where: { dispensingId: savedDispensing.id },
    });

    // Load prescription if available
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    const prescription = savedDispensing.prescriptionId
      ? await prescriptionRepository.findOne({
          where: { id: savedDispensing.prescriptionId },
        })
      : undefined;

    return MedicationDispenseMapper.toFhir(
      savedDispensing,
      items,
      prescription as any,
      tenantId
    );
  }

  async updateMedicationDispense(id: string, fhirDispense: any, tenantDb: DataSource, tenantId: string) {
    // Validate FHIR resource
    if (this.fhirValidator) {
      await this.fhirValidator.validateResource(fhirDispense, 'MedicationDispense');
    }

    const dispensingRepository = tenantDb.getRepository(PharmacyDispensing);
    const dispensing = await dispensingRepository.findOne({
      where: { id },
      relations: ['patient', 'prescription', 'dispensedBy'],
    });

    if (!dispensing) {
      throw new NotFoundException(`MedicationDispense with ID ${id} not found`);
    }

    // Map to entity
    const dispensingData = MedicationDispenseMapper.fromFhir(fhirDispense);

    // Update dispensing
    Object.assign(dispensing, dispensingData);
    const updatedDispensing = await dispensingRepository.save(dispensing);

    // Load items for response
    const itemsRepository = tenantDb.getRepository(PharmacyDispensingItem);
    const items = await itemsRepository.find({
      where: { dispensingId: updatedDispensing.id },
    });

    return MedicationDispenseMapper.toFhir(
      updatedDispensing,
      items,
      updatedDispensing.prescription,
      tenantId
    );
  }

  async deleteMedicationDispense(id: string, tenantDb: DataSource) {
    const dispensingRepository = tenantDb.getRepository(PharmacyDispensing);
    const dispensing = await dispensingRepository.findOne({ where: { id } });

    if (!dispensing) {
      throw new NotFoundException(`MedicationDispense with ID ${id} not found`);
    }

    // Soft delete by setting status to cancelled
    dispensing.status = 'cancelled';
    await dispensingRepository.save(dispensing);

    return { status: 'deleted', id };
  }
}