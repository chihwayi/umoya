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

  async createPatient(createPatientDto: CreatePatientDto, tenantDb: DataSource, tenantSlug: string): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    // Check for existing national ID
    const existingPatient = await patientRepository.findOne({
      where: { nationalId: createPatientDto.nationalId }
    });
    
    if (existingPatient) {
      throw new ConflictException('Patient with this National ID already exists');
    }
    
    const patient = patientRepository.create(createPatientDto);
    
    // Generate tenant-specific MRN
    if (!patient.patientNumber) {
      const tenantCode = tenantSlug.toUpperCase().replace(/-/g, '').substring(0, 3);
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      patient.patientNumber = `${tenantCode}${timestamp}${random}`;
    }
    
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
        '(patient.firstName ILIKE :query OR patient.lastName ILIKE :query OR patient.nationalId ILIKE :query OR patient.phone ILIKE :query OR patient.patientNumber ILIKE :query OR patient.email ILIKE :query OR patient.medicalAidNumber ILIKE :query)',
        { query: `%${query}%` }
      )
      .orderBy('patient.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }

  async getStats(tenantDb: DataSource): Promise<{ totalPatients: number; newPatientsThisMonth: number }> {
    const patientRepository = tenantDb.getRepository(Patient);
    
    const totalPatients = await patientRepository.count({
      where: { isActive: true }
    });
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newPatientsThisMonth = await patientRepository
      .createQueryBuilder('patient')
      .where('patient.isActive = :isActive', { isActive: true })
      .andWhere('patient.createdAt >= :startOfMonth', { startOfMonth })
      .getCount();
      
    return {
      totalPatients,
      newPatientsThisMonth
    };
  }

  async advancedSearch(
    filters: {
      searchTerm?: string;
      gender?: string;
      ageMin?: number;
      ageMax?: number;
      dateFrom?: Date;
      dateTo?: Date;
      medicalAidProvider?: string;
      city?: string;
      page?: number;
      limit?: number;
    },
    tenantDb: DataSource
  ): Promise<{ patients: Patient[]; total: number; pages: number }> {
    const patientRepository = tenantDb.getRepository(Patient);
    const queryBuilder = patientRepository
      .createQueryBuilder('patient')
      .where('patient.isActive = :isActive', { isActive: true });

    // Search term filter
    if (filters.searchTerm) {
      queryBuilder.andWhere(
        '(patient.firstName ILIKE :searchTerm OR patient.lastName ILIKE :searchTerm OR patient.nationalId ILIKE :searchTerm OR patient.phone ILIKE :searchTerm OR patient.patientNumber ILIKE :searchTerm OR patient.email ILIKE :searchTerm OR patient.medicalAidNumber ILIKE :searchTerm)',
        { searchTerm: `%${filters.searchTerm}%` }
      );
    }

    // Gender filter
    if (filters.gender) {
      queryBuilder.andWhere('patient.gender = :gender', { gender: filters.gender });
    }

    // Age range filter
    if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
      const today = new Date();
      if (filters.ageMax !== undefined) {
        const minDate = new Date(today.getFullYear() - filters.ageMax - 1, today.getMonth(), today.getDate());
        queryBuilder.andWhere('patient.dateOfBirth >= :minDate', { minDate });
      }
      if (filters.ageMin !== undefined) {
        const maxDate = new Date(today.getFullYear() - filters.ageMin, today.getMonth(), today.getDate());
        queryBuilder.andWhere('patient.dateOfBirth <= :maxDate', { maxDate });
      }
    }

    // Date range filter (registration date)
    if (filters.dateFrom) {
      queryBuilder.andWhere('patient.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      queryBuilder.andWhere('patient.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    // Medical aid provider filter
    if (filters.medicalAidProvider) {
      queryBuilder.andWhere('patient.medicalAidProvider ILIKE :medicalAidProvider', {
        medicalAidProvider: `%${filters.medicalAidProvider}%`,
      });
    }

    // City filter
    if (filters.city) {
      queryBuilder.andWhere('patient.city ILIKE :city', { city: `%${filters.city}%` });
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.orderBy('patient.createdAt', 'DESC').skip(skip).take(limit);

    const [patients, total] = await queryBuilder.getManyAndCount();

    return {
      patients,
      total,
      pages: Math.ceil(total / limit),
    };
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