import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Like } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from '../dto/patient.dto';

@Injectable()
export class PatientService {
  
  async create(createPatientDto: CreatePatientDto, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    // Generate patient number
    const patientCount = await patientRepository.count();
    const patientNumber = `P${String(patientCount + 1).padStart(6, '0')}`;
    
    const patient = patientRepository.create({
      ...createPatientDto,
      patientNumber,
      dateOfBirth: new Date(createPatientDto.dateOfBirth)
    });
    
    return patientRepository.save(patient);
  }

  async findAll(query: PatientSearchDto, tenantDb: DataSource) {
    const patientRepository = tenantDb.getRepository(Patient);
    const { page = 1, limit = 10, search } = query;
    
    const queryBuilder = patientRepository.createQueryBuilder('patient')
      .where('patient.isActive = :isActive', { isActive: true });
    
    if (search) {
      queryBuilder.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR patient.patientNumber ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${search}%` }
      );
    }
    
    const [patients, total] = await queryBuilder
      .orderBy('patient.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    
    return {
      patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(id: string, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    const patient = await patientRepository.findOne({
      where: { id, isActive: true }
    });
    
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    
    return patient;
  }

  async update(id: string, updatePatientDto: UpdatePatientDto, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    const patient = await this.findById(id, tenantDb);
    
    Object.assign(patient, {
      ...updatePatientDto,
      dateOfBirth: updatePatientDto.dateOfBirth ? new Date(updatePatientDto.dateOfBirth) : patient.dateOfBirth
    });
    
    return patientRepository.save(patient);
  }

  async deactivate(id: string, tenantDb: DataSource): Promise<{ message: string }> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    const patient = await this.findById(id, tenantDb);
    patient.isActive = false;
    
    await patientRepository.save(patient);
    
    return { message: 'Patient deactivated successfully' };
  }

  async getMedicalHistory(id: string, tenantDb: DataSource) {
    const patient = await this.findById(id, tenantDb);
    
    // This would typically join with medical records, appointments, etc.
    return {
      patient,
      medicalRecords: [], // TODO: Implement when medical records service is ready
      appointments: [], // TODO: Implement when appointments service is ready
      prescriptions: [], // TODO: Implement when prescriptions service is ready
      labOrders: [] // TODO: Implement when lab orders service is ready
    };
  }
}