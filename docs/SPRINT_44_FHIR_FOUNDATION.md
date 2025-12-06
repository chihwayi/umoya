# Sprint 44: FHIR Foundation & Core Resources

## Recommendation: **FHIR.js (Node.js) + Custom NestJS Implementation**

### Why This Approach?
✅ **Matches your stack** - Node.js/TypeScript (no Java needed)  
✅ **Already have `@types/fhir`** installed  
✅ **Easier integration** - Direct with NestJS services  
✅ **Faster development** - No language switch  
✅ **Lower complexity** - Single service, unified codebase  

**Alternative (HAPI FHIR) would require:**
- ❌ Separate Java service
- ❌ Different language/ecosystem
- ❌ More complex deployment
- ❌ Network latency between services

---

## Sprint 44 Goals (2 Weeks)

### Week 1: Setup & Patient Resource
### Week 2: Encounter & Observation Resources

---

## 📋 Detailed Tasks

### **Day 1-2: Setup & Dependencies**

#### Install Required Packages
```bash
cd services/ehr-service
npm install fhir-kit-client
npm install fhirpath
npm install --save-dev @types/fhir@latest
```

#### Create FHIR Module Structure
```
services/ehr-service/src/
├── fhir/
│   ├── mappers/
│   │   ├── patient.mapper.ts
│   │   ├── encounter.mapper.ts
│   │   └── observation.mapper.ts
│   ├── validators/
│   │   └── fhir-validator.service.ts
│   ├── search/
│   │   └── fhir-search.service.ts
│   └── types/
│       └── fhir-resource.types.ts
```

**Tasks:**
- [ ] Install FHIR libraries
- [ ] Create directory structure
- [ ] Set up FHIR resource types
- [ ] Create base mapper interface

---

### **Day 3-5: Patient Resource (CRUD + Search)**

#### Implement Patient Mapper
```typescript
// services/ehr-service/src/fhir/mappers/patient.mapper.ts
import { Patient } from '../../entities/patient.entity';
import * as fhir from 'fhir/r4';

export class PatientMapper {
  static toFhir(patient: Patient): fhir.Patient {
    return {
      resourceType: 'Patient',
      id: patient.id,
      meta: {
        versionId: patient.version?.toString() || '1',
        lastUpdated: patient.updatedAt?.toISOString() || patient.createdAt.toISOString(),
      },
      identifier: [
        {
          system: `http://${patient.tenantId || 'medicore'}.co.zw/patients`,
          value: patient.patientNumber || patient.id,
        },
        ...(patient.nationalId ? [{
          system: 'http://national-id.zimbabwe',
          value: patient.nationalId,
        }] : []),
      ],
      active: patient.isActive !== false,
      name: [
        {
          family: patient.lastName,
          given: [patient.firstName, ...(patient.middleName ? [patient.middleName] : [])],
          use: 'official',
        },
      ],
      telecom: [
        ...(patient.phone ? [{
          system: 'phone',
          value: patient.phone,
          use: 'mobile',
        }] : []),
        ...(patient.email ? [{
          system: 'email',
          value: patient.email,
        }] : []),
      ],
      gender: this.mapGender(patient.gender),
      birthDate: patient.dateOfBirth?.toISOString().split('T')[0],
      address: patient.address ? [{
        use: 'home',
        line: [patient.address],
        city: patient.city,
        state: patient.province,
        postalCode: patient.postalCode,
        country: patient.country || 'ZW',
      }] : [],
      maritalStatus: patient.maritalStatus ? {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: this.mapMaritalStatus(patient.maritalStatus),
        }],
      } : undefined,
      contact: patient.emergencyContact ? [{
        relationship: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
            code: 'C',
            display: 'Emergency Contact',
          }],
        }],
        name: {
          text: patient.emergencyContact,
        },
        telecom: patient.emergencyPhone ? [{
          system: 'phone',
          value: patient.emergencyPhone,
        }] : [],
      }] : [],
    };
  }

  static fromFhir(fhirPatient: fhir.Patient): Partial<Patient> {
    const name = fhirPatient.name?.[0];
    return {
      firstName: name?.given?.[0] || '',
      lastName: name?.family || '',
      middleName: name?.given?.[1],
      gender: this.mapGenderFromFhir(fhirPatient.gender),
      dateOfBirth: fhirPatient.birthDate ? new Date(fhirPatient.birthDate) : undefined,
      phone: fhirPatient.telecom?.find(t => t.system === 'phone')?.value,
      email: fhirPatient.telecom?.find(t => t.system === 'email')?.value,
      address: fhirPatient.address?.[0]?.line?.[0],
      city: fhirPatient.address?.[0]?.city,
      province: fhirPatient.address?.[0]?.state,
      postalCode: fhirPatient.address?.[0]?.postalCode,
      country: fhirPatient.address?.[0]?.country || 'ZW',
      nationalId: fhirPatient.identifier?.find(i => i.system?.includes('national-id'))?.value,
      isActive: fhirPatient.active !== false,
    };
  }

  private static mapGender(gender: string): fhir.Patient['gender'] {
    const map: Record<string, fhir.Patient['gender']> = {
      'male': 'male',
      'female': 'female',
      'other': 'other',
      'unknown': 'unknown',
    };
    return map[gender?.toLowerCase()] || 'unknown';
  }

  private static mapGenderFromFhir(gender?: fhir.Patient['gender']): string {
    return gender || 'unknown';
  }

  private static mapMaritalStatus(status: string): string {
    const map: Record<string, string> = {
      'single': 'S',
      'married': 'M',
      'divorced': 'D',
      'widowed': 'W',
    };
    return map[status?.toLowerCase()] || 'U';
  }
}
```

#### Enhance FhirService Patient Methods
```typescript
// Update services/ehr-service/src/services/fhir.service.ts

async getPatient(id: string, tenantDb: DataSource): Promise<fhir.Patient> {
  const patientRepository = tenantDb.getRepository(Patient);
  const patient = await patientRepository.findOne({ where: { id, isActive: true } });
  
  if (!patient) {
    throw new NotFoundException(`Patient with ID ${id} not found`);
  }
  
  return PatientMapper.toFhir(patient);
}

async createPatient(fhirPatient: fhir.Patient, tenantDb: DataSource): Promise<fhir.Patient> {
  // Validate FHIR resource
  await this.validateResource(fhirPatient, 'Patient');
  
  // Map to entity
  const patientData = PatientMapper.fromFhir(fhirPatient);
  
  // Save to database
  const patientRepository = tenantDb.getRepository(Patient);
  const patient = patientRepository.create(patientData);
  const saved = await patientRepository.save(patient);
  
  // Return FHIR resource
  return PatientMapper.toFhir(saved);
}

async updatePatient(id: string, fhirPatient: fhir.Patient, tenantDb: DataSource): Promise<fhir.Patient> {
  // Validate
  await this.validateResource(fhirPatient, 'Patient');
  
  // Get existing
  const patientRepository = tenantDb.getRepository(Patient);
  const existing = await patientRepository.findOne({ where: { id } });
  
  if (!existing) {
    throw new NotFoundException(`Patient with ID ${id} not found`);
  }
  
  // Update
  const updates = PatientMapper.fromFhir(fhirPatient);
  Object.assign(existing, updates);
  const saved = await patientRepository.save(existing);
  
  return PatientMapper.toFhir(saved);
}

async searchPatients(query: any, tenantDb: DataSource): Promise<fhir.Bundle> {
  const patientRepository = tenantDb.getRepository(Patient);
  let queryBuilder = patientRepository.createQueryBuilder('patient')
    .where('patient.isActive = :isActive', { isActive: true });

  // FHIR Search Parameters
  if (query.name) {
    queryBuilder.andWhere(
      '(patient.firstName ILIKE :name OR patient.lastName ILIKE :name)',
      { name: `%${query.name}%` }
    );
  }

  if (query.identifier) {
    const identifierValue = query.identifier.split('|')[1] || query.identifier;
    queryBuilder.andWhere(
      '(patient.patientNumber = :identifier OR patient.nationalId = :identifier)',
      { identifier: identifierValue }
    );
  }

  if (query.birthdate) {
    const date = new Date(query.birthdate);
    queryBuilder.andWhere('patient.dateOfBirth = :birthdate', { birthdate: date });
  }

  if (query.gender) {
    queryBuilder.andWhere('patient.gender = :gender', { gender: query.gender });
  }

  // Pagination
  const page = parseInt(query._page) || 1;
  const count = Math.min(parseInt(query._count) || 10, 100);
  const offset = (page - 1) * count;

  queryBuilder.skip(offset).take(count);

  const [patients, total] = await queryBuilder.getManyAndCount();

  // Convert to FHIR Bundle
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total,
    entry: patients.map(patient => ({
      resource: PatientMapper.toFhir(patient),
      search: { mode: 'match' },
    })),
  };
}
```

**Tasks:**
- [ ] Create PatientMapper class
- [ ] Implement toFhir() method
- [ ] Implement fromFhir() method
- [ ] Update getPatient() to use mapper
- [ ] Update createPatient() with validation
- [ ] Update updatePatient() with validation
- [ ] Enhance searchPatients() with all FHIR search parameters
- [ ] Add unit tests for Patient mapper
- [ ] Add integration tests for Patient CRUD

---

### **Day 6-7: FHIR Validation Service**

#### Create FHIR Validator
```typescript
// services/ehr-service/src/fhir/validators/fhir-validator.service.ts
import { Injectable } from '@nestjs/common';
import * as fhir from 'fhir/r4';

@Injectable()
export class FhirValidatorService {
  async validateResource(resource: any, resourceType: string): Promise<void> {
    // Basic validation
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
      // Add more as needed
    }
  }

  private validatePatient(patient: fhir.Patient): void {
    if (!patient.name || patient.name.length === 0) {
      throw new BadRequestException('Patient must have at least one name');
    }

    if (!patient.gender) {
      throw new BadRequestException('Patient must have a gender');
    }

    if (!patient.birthDate) {
      throw new BadRequestException('Patient must have a birthDate');
    }
  }

  private validateEncounter(encounter: fhir.Encounter): void {
    if (!encounter.status) {
      throw new BadRequestException('Encounter must have a status');
    }

    if (!encounter.class) {
      throw new BadRequestException('Encounter must have a class');
    }
  }

  private validateObservation(observation: fhir.Observation): void {
    if (!observation.status) {
      throw new BadRequestException('Observation must have a status');
    }

    if (!observation.code) {
      throw new BadRequestException('Observation must have a code');
    }
  }
}
```

**Tasks:**
- [ ] Create FhirValidatorService
- [ ] Implement basic validation
- [ ] Add resource-specific validations
- [ ] Add unit tests

---

### **Day 8-10: Encounter Resource**

#### Create Encounter Mapper
```typescript
// services/ehr-service/src/fhir/mappers/encounter.mapper.ts
import { Appointment, Admission } from '../../entities/...';
import * as fhir from 'fhir/r4';

export class EncounterMapper {
  static toFhir(encounter: Appointment | Admission): fhir.Encounter {
    // Map based on entity type
    if ('appointmentDate' in encounter) {
      return this.appointmentToFhir(encounter as Appointment);
    } else {
      return this.admissionToFhir(encounter as Admission);
    }
  }

  private static appointmentToFhir(appointment: Appointment): fhir.Encounter {
    return {
      resourceType: 'Encounter',
      id: appointment.id,
      status: this.mapAppointmentStatus(appointment.status),
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      type: appointment.appointmentType ? [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: appointment.appointmentType,
        }],
      }] : [],
      subject: {
        reference: `Patient/${appointment.patientId}`,
      },
      period: {
        start: appointment.appointmentDate.toISOString(),
        end: appointment.endDate?.toISOString(),
      },
      participant: appointment.doctorId ? [{
        individual: {
          reference: `Practitioner/${appointment.doctorId}`,
        },
      }] : [],
    };
  }

  private static admissionToFhir(admission: Admission): fhir.Encounter {
    return {
      resourceType: 'Encounter',
      id: admission.id,
      status: this.mapAdmissionStatus(admission.admissionStatus),
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'IMP',
        display: 'inpatient encounter',
      },
      subject: {
        reference: `Patient/${admission.patientId}`,
      },
      period: {
        start: admission.admissionDate.toISOString(),
        end: admission.dischargeDate?.toISOString(),
      },
      location: admission.currentBedId ? [{
        location: {
          reference: `Location/${admission.currentBedId}`,
        },
      }] : [],
    };
  }

  // ... mapping helper methods
}
```

**Tasks:**
- [ ] Create EncounterMapper
- [ ] Map from Appointment entity
- [ ] Map from Admission entity
- [ ] Implement searchEncounters() with FHIR search
- [ ] Add unit tests

---

### **Day 11-14: Observation Resource**

#### Create Observation Mapper
```typescript
// services/ehr-service/src/fhir/mappers/observation.mapper.ts
import { Vitals, LabTest } from '../../entities/...';
import * as fhir from 'fhir/r4';

export class ObservationMapper {
  static vitalsToFhir(vitals: Vitals): fhir.Observation {
    // Map vitals to FHIR Observation
    return {
      resourceType: 'Observation',
      id: vitals.id,
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs',
        }],
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: this.mapVitalType(vitals.type),
          display: vitals.type,
        }],
      },
      subject: {
        reference: `Patient/${vitals.patientId}`,
      },
      effectiveDateTime: vitals.recordedAt.toISOString(),
      valueQuantity: {
        value: vitals.value,
        unit: vitals.unit,
        system: 'http://unitsofmeasure.org',
        code: vitals.unit,
      },
      performer: vitals.recordedBy ? [{
        reference: `Practitioner/${vitals.recordedBy}`,
      }] : [],
    };
  }

  static labTestToFhir(labTest: LabTest): fhir.Observation {
    // Map lab test to FHIR Observation
    return {
      resourceType: 'Observation',
      id: labTest.id,
      status: this.mapLabStatus(labTest.status),
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'laboratory',
          display: 'Laboratory',
        }],
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: labTest.testCode,
          display: labTest.testName,
        }],
      },
      subject: {
        reference: `Patient/${labTest.patientId}`,
      },
      effectiveDateTime: labTest.orderDate.toISOString(),
      valueQuantity: labTest.resultValue ? {
        value: parseFloat(labTest.resultValue),
        unit: labTest.unit,
      } : undefined,
      interpretation: labTest.resultInterpretation ? [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: labTest.resultInterpretation,
        }],
      }] : undefined,
    };
  }

  // ... helper methods
}
```

**Tasks:**
- [ ] Create ObservationMapper
- [ ] Map from Vitals entity
- [ ] Map from LabTest entity
- [ ] Implement searchObservations() with FHIR search
- [ ] Support for composite observations (blood pressure, etc.)
- [ ] Add unit tests

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] PatientMapper.toFhir() - all fields mapped correctly
- [ ] PatientMapper.fromFhir() - all fields mapped correctly
- [ ] EncounterMapper - appointment and admission mapping
- [ ] ObservationMapper - vitals and lab test mapping
- [ ] FhirValidatorService - all validation rules

### Integration Tests
- [ ] GET /fhir/Patient/:id - returns valid FHIR Patient
- [ ] POST /fhir/Patient - creates patient and returns FHIR
- [ ] PUT /fhir/Patient/:id - updates patient and returns FHIR
- [ ] GET /fhir/Patient?name=John - search works
- [ ] GET /fhir/Patient?identifier=123 - identifier search works
- [ ] GET /fhir/Encounter - returns valid FHIR Bundle
- [ ] GET /fhir/Observation - returns valid FHIR Bundle

### FHIR Compliance Tests
- [ ] Capability statement includes Patient, Encounter, Observation
- [ ] All resources pass FHIR validation
- [ ] Search parameters work as specified
- [ ] Resource references are valid

---

## 📊 Success Criteria

### Week 1
- ✅ Patient resource fully functional (CRUD + Search)
- ✅ FHIR validation working
- ✅ All Patient search parameters working
- ✅ Unit tests passing

### Week 2
- ✅ Encounter resource fully functional
- ✅ Observation resource fully functional
- ✅ All search parameters working
- ✅ Resource references working
- ✅ Integration tests passing

---

## 🚀 Next Steps After Sprint 44

**Sprint 45: Additional Core Resources**
- Condition resource
- Medication resource
- Procedure resource
- DiagnosticReport resource
- Bundle operations

---

## 📚 Resources

- **FHIR R4 Specification**: https://www.hl7.org/fhir/R4/
- **FHIR.js**: https://github.com/FHIR/fhir.js
- **FHIR Search Parameters**: https://www.hl7.org/fhir/R4/search.html
- **FHIR Validator**: https://confluence.hl7.org/display/FHIR/Using+the+FHIR+Validator

---

**Ready to start? Let's begin with Day 1-2: Setup & Dependencies!**


