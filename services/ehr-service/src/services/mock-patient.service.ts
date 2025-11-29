import { Injectable } from '@nestjs/common';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';

@Injectable()
export class MockPatientService {
  async create(payload: CreatePatientDto, userId: string) {
    return {
      id: `mock-${Date.now()}`,
      createdBy: userId,
      ...payload,
    };
  }

  async findAll(query: any) {
    // Mock patient data
    const patients = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        patientNumber: 'P001',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        phoneNumber: '+263123456789',
        email: 'john.doe@email.com',
        address: '123 Main St, Bulawayo',
        bloodType: 'O+',
        allergies: ['Penicillin'],
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phoneNumber: '+263987654321'
        }
      },
      {
        id: '2',
        firstName: 'Mary',
        lastName: 'Smith',
        patientNumber: 'P002',
        dateOfBirth: '1985-05-15',
        gender: 'female',
        phoneNumber: '+263123456790',
        email: 'mary.smith@email.com',
        address: '456 Oak Ave, Bulawayo',
        bloodType: 'A+',
        allergies: [],
        emergencyContact: {
          name: 'Bob Smith',
          relationship: 'Brother',
          phoneNumber: '+263987654322'
        }
      }
    ];

    return {
      patients,
      total: patients.length
    };
  }

  async findOne(id: string) {
    const patients = await this.findAll({});
    return patients.patients.find(p => p.id === id);
  }

  async update(id: string, payload: UpdatePatientDto) {
    return {
      id,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
  }

  async remove(id: string) {
    return { id, deleted: true };
  }
}


