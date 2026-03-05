import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';

@Injectable()
export class PatientService {
  private isMissingRelationError(error: any): boolean {
    return (
      error?.code === '42P01' ||
      String(error?.message || '').toLowerCase().includes('does not exist')
    );
  }

  private async safeQuery(tenantDb: DataSource, sql: string, params: any[] = []) {
    try {
      return await tenantDb.query(sql, params);
    } catch (error) {
      if (this.isMissingRelationError(error)) {
        return [];
      }
      throw error;
    }
  }

  private normalizeToNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private calculateAge(dateOfBirth?: Date | string | null): number | null {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }

  private calculateBmiFromWeightHeight(weightKg: any, heightCm: any): number | null {
    const weight = this.normalizeToNumber(weightKg);
    const height = this.normalizeToNumber(heightCm);
    if (!weight || !height || height <= 0) return null;
    const bmi = weight / Math.pow(height / 100, 2);
    return Math.round(bmi * 100) / 100;
  }

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

  async getPatientContext(id: string, tenantDb: DataSource): Promise<any> {
    const patient = await this.getPatientById(id, tenantDb);
    const patientId = patient.id;

    const [latestVitalsRows, hivEnrollmentRows, maternityEnrollmentRows, oncologyCaseRows, oncologyActiveCountRows] = await Promise.all([
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          patient_id,
          blood_pressure,
          heart_rate,
          temperature,
          oxygen_saturation,
          respiratory_rate,
          weight,
          height,
          bmi,
          pain_level,
          blood_glucose,
          recorded_at,
          recorded_by
        FROM vitals
        WHERE patient_id = $1
        ORDER BY recorded_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          enrollment_number,
          enrollment_status,
          enrollment_date,
          date_confirmed_positive,
          art_start_date,
          baseline_cd4,
          baseline_viral_load,
          baseline_who_stage,
          current_regimen
        FROM hiv_care_enrollments
        WHERE patient_id = $1
        ORDER BY (enrollment_status = 'active') DESC, enrollment_date DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          enrollment_number,
          enrollment_status,
          enrollment_date,
          lmp_date,
          expected_delivery_date,
          risk_category,
          current_pregnancy_complications
        FROM maternity_enrollments
        WHERE patient_id = $1
        ORDER BY (enrollment_status = 'active') DESC, enrollment_date DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          status,
          primary_diagnosis,
          diagnosis_date,
          overall_stage,
          stage_at_diagnosis,
          oncologist_id,
          updated_at
        FROM oncology_cases
        WHERE patient_id = $1
        ORDER BY (status = 'active') DESC, updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT COUNT(*)::int AS active_count
        FROM oncology_cases
        WHERE patient_id = $1 AND status = 'active'
        `,
        [patientId],
      ),
    ]);

    const latestVitals = latestVitalsRows[0] || null;
    const latestHivEnrollment = hivEnrollmentRows[0] || null;
    const latestMaternityEnrollment = maternityEnrollmentRows[0] || null;
    const latestOncologyCase = oncologyCaseRows[0] || null;
    const oncologyActiveCaseCount = Number(oncologyActiveCountRows[0]?.active_count || 0);

    const [latestHivVisitRows, latestAncVisitRows, latestPostnatalVisitRows, latestDeliveryRows] = await Promise.all([
      latestHivEnrollment?.id
        ? this.safeQuery(
            tenantDb,
            `
            SELECT
              id,
              enrollment_id,
              visit_number,
              visit_date,
              visit_type,
              pregnancy_lactating_status,
              first_anc_booking_date,
              delivery_date,
              functional_status,
              who_clinical_stage,
              tb_screening,
              tpt_status,
              arv_status,
              arv_regimen_code,
              arv_regimen_name,
              cd4_count,
              cd4_test_date,
              viral_load,
              viral_load_unit,
              viral_load_test_date,
              next_review_date,
              visit_status
            FROM hiv_clinical_visits
            WHERE enrollment_id = $1
            ORDER BY visit_date DESC, created_at DESC
            LIMIT 1
            `,
            [latestHivEnrollment.id],
          )
        : Promise.resolve([]),
      latestMaternityEnrollment?.id
        ? this.safeQuery(
            tenantDb,
            `
            SELECT
              id,
              maternity_enrollment_id,
              visit_number,
              visit_date,
              next_visit_date,
              blood_pressure_systolic,
              blood_pressure_diastolic,
              weight,
              height,
              hiv_status
            FROM anc_visits
            WHERE maternity_enrollment_id = $1
            ORDER BY visit_date DESC, created_at DESC
            LIMIT 1
            `,
            [latestMaternityEnrollment.id],
          )
        : Promise.resolve([]),
      latestMaternityEnrollment?.id
        ? this.safeQuery(
            tenantDb,
            `
            SELECT
              id,
              maternity_enrollment_id,
              delivery_id,
              visit_date,
              days_postpartum,
              next_visit_date,
              family_planning_method,
              breastfeeding_status,
              newborn_status
            FROM postnatal_visits
            WHERE maternity_enrollment_id = $1
            ORDER BY visit_date DESC, created_at DESC
            LIMIT 1
            `,
            [latestMaternityEnrollment.id],
          )
        : Promise.resolve([]),
      latestMaternityEnrollment?.id
        ? this.safeQuery(
            tenantDb,
            `
            SELECT
              id,
              maternity_enrollment_id,
              delivery_date,
              delivery_time,
              delivery_type,
              maternal_outcome
            FROM deliveries
            WHERE maternity_enrollment_id = $1
            ORDER BY delivery_date DESC, created_at DESC
            LIMIT 1
            `,
            [latestMaternityEnrollment.id],
          )
        : Promise.resolve([]),
    ]);

    const latestHivVisit = latestHivVisitRows[0] || null;
    const latestAncVisit = latestAncVisitRows[0] || null;
    const latestPostnatalVisit = latestPostnatalVisitRows[0] || null;
    const latestDelivery = latestDeliveryRows[0] || null;

    const age = this.calculateAge(patient.dateOfBirth);
    const derivedBmi =
      latestVitals?.bmi ??
      this.calculateBmiFromWeightHeight(
        latestVitals?.weight ?? latestAncVisit?.weight,
        latestVitals?.height ?? latestAncVisit?.height,
      );

    return {
      patient: {
        id: patient.id,
        patientNumber: patient.patientNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        fullName: `${patient.firstName} ${patient.lastName}`.trim(),
        dateOfBirth: patient.dateOfBirth,
        age,
        gender: patient.gender,
        nationalId: patient.nationalId || null,
        phone: patient.phone || null,
        email: patient.email || null,
        address: patient.address || null,
        city: patient.city || null,
        bloodType: patient.bloodType || null,
        emergencyContactName: patient.emergencyContactName || null,
        emergencyContactPhone: patient.emergencyContactPhone || null,
        medicalAidProvider: patient.medicalAidProvider || null,
        medicalAidNumber: patient.medicalAidNumber || null,
      },
      latestVitals: latestVitals
        ? {
            id: latestVitals.id,
            recordedAt: latestVitals.recorded_at,
            bloodPressure: latestVitals.blood_pressure || null,
            heartRate: this.normalizeToNumber(latestVitals.heart_rate),
            temperature: this.normalizeToNumber(latestVitals.temperature),
            oxygenSaturation: this.normalizeToNumber(latestVitals.oxygen_saturation),
            respiratoryRate: this.normalizeToNumber(latestVitals.respiratory_rate),
            weightKg: this.normalizeToNumber(latestVitals.weight),
            heightCm: this.normalizeToNumber(latestVitals.height),
            bmi: this.normalizeToNumber(latestVitals.bmi) ?? derivedBmi,
          }
        : null,
      modules: {
        hiv: {
          latestEnrollment: latestHivEnrollment,
          latestClinicalVisit: latestHivVisit,
        },
        maternity: {
          latestEnrollment: latestMaternityEnrollment,
          latestAncVisit,
          latestPostnatalVisit,
          latestDelivery,
        },
        oncology: {
          latestCase: latestOncologyCase,
          activeCaseCount: oncologyActiveCaseCount,
        },
      },
      generatedAt: new Date().toISOString(),
    };
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
