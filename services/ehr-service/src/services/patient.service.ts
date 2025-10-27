import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';

@Injectable()
export class PatientService {
  async getAllPatients(tenantDb: DataSource, page: number = 1, limit: number = 20): Promise<{ patients: Patient[], total: number, pages: number }> {
    const patientRepository = tenantDb.getRepository(Patient);
    const [patients, total] = await patientRepository.findAndCount({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });
    
    return {
      patients,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  async getPatientById(id: string, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await patientRepository.findOne({ 
      where: { id, isActive: true } 
    });
    
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    
    return patient;
  }

  async getPatientByMRN(mrn: string, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await patientRepository.findOne({ 
      where: { mrn, isActive: true } 
    });
    
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    
    return patient;
  }

  async createPatient(createPatientDto: CreatePatientDto, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    // Check for existing national ID
    const existingPatient = await patientRepository.findOne({
      where: { nationalId: createPatientDto.nationalId }
    });
    
    if (existingPatient) {
      throw new ConflictException('Patient with this National ID already exists');
    }
    
    const patient = patientRepository.create(createPatientDto);
    return patientRepository.save(patient);
  }

  async updatePatient(id: string, updatePatientDto: UpdatePatientDto, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await this.getPatientById(id, tenantDb);
    
    Object.assign(patient, updatePatientDto);
    return patientRepository.save(patient);
  }

  async deactivatePatient(id: string, tenantDb: DataSource): Promise<{ message: string }> {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await this.getPatientById(id, tenantDb);
    
    patient.isActive = false;
    await patientRepository.save(patient);
    
    return { message: 'Patient deactivated successfully' };
  }

  async searchPatients(query: string, tenantDb: DataSource): Promise<Patient[]> {
    const patientRepository = tenantDb.getRepository(Patient);
    return patientRepository
      .createQueryBuilder('patient')
      .where('patient.isActive = :isActive', { isActive: true })
      .andWhere(
        '(patient.firstName ILIKE :query OR patient.lastName ILIKE :query OR patient.nationalId ILIKE :query OR patient.phone ILIKE :query OR patient.patientNumber ILIKE :query)',
        { query: `%${query}%` }
      )
      .orderBy('patient.createdAt', 'DESC')
      .limit(10)
      .getMany();
  }

  async getPatientStats(tenantDb: DataSource): Promise<any> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    const totalPatients = await patientRepository.count({ where: { isActive: true } });
    const newPatientsThisMonth = await patientRepository
      .createQueryBuilder('patient')
      .where('patient.isActive = :isActive', { isActive: true })
      .andWhere('patient.createdAt >= :startOfMonth', { 
        startOfMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
      })
      .getCount();
    
    return {
      totalPatients,
      newPatientsThisMonth
    };
  }
}