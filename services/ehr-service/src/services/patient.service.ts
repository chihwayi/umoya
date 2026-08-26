import { Injectable, NotFoundException, ConflictException, Logger, Optional } from '@nestjs/common';
import { randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { PatientSdoh } from '../entities/patient-sdoh.entity';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';
import { MedicalNlpService } from './medical-nlp.service';

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(@Optional() private readonly medicalNlpService?: MedicalNlpService) {}

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

    const [
      latestVitalsRows,
      labOrderRows,
      labOrderActiveCountRows,
      imagingReportRows,
      imagingActionableUnacknowledgedCountRows,
      hivEnrollmentRows,
      maternityEnrollmentRows,
      oncologyCaseRows,
      oncologyActiveCountRows,
      cardiologyEncounterRows,
      ophthalmologyEncounterRows,
      edVisitRows,
      sepsisScreeningRows,
      sepsisBundleRows,
      bloodTransfusionRows,
      bloodTransfusionActiveCountRows,
      telemedicineConsultationRows,
      labCriticalAlertRows,
      labCriticalAlertOpenCountRows,
      pharmacyPrescriptionRows,
      pharmacyPrescriptionActiveCountRows,
    ] = await Promise.all([
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
          order_number,
          status,
          priority,
          test_name,
          clinical_info,
          special_instructions,
          ordered_at
        FROM lab_orders
        WHERE patient_id = $1
        ORDER BY COALESCE(ordered_at, created_at) DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT COUNT(*)::int AS active_count
        FROM lab_orders
        WHERE patient_id = $1
          AND COALESCE(status, 'pending') NOT IN ('completed', 'cancelled')
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          r.id,
          r.imaging_order_id,
          r.report_status,
          r.report_datetime,
          r.signed_at,
          r.impression,
          r.recommendations,
          r.critical_findings,
          r.is_critical,
          r.severity,
          r.follow_up_recommended,
          r.follow_up_interval,
          io.priority AS order_priority,
          io.clinical_indication,
          io.clinical_history,
          st.study_name,
          m.modality_name
        FROM imaging_reports r
        INNER JOIN imaging_orders io ON io.id = r.imaging_order_id
        LEFT JOIN imaging_study_types st ON st.id = io.study_type_id
        LEFT JOIN imaging_modalities m ON m.id = st.modality_id
        WHERE io.patient_id = $1
        ORDER BY COALESCE(r.report_datetime, r.signed_at, r.created_at) DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT COUNT(*)::int AS active_count
        FROM imaging_reports r
        INNER JOIN imaging_orders io ON io.id = r.imaging_order_id
        WHERE io.patient_id = $1
          AND LOWER(COALESCE(r.report_status, '')) = 'final'
          AND (
            COALESCE(r.is_critical, false) = true
            OR COALESCE(r.follow_up_recommended, false) = true
          )
          AND NOT EXISTS (
            SELECT 1
            FROM imaging_report_acknowledgements ack
            WHERE ack.imaging_report_id = r.id
          )
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
          gravida,
          para,
          parity_term,
          parity_preterm,
          parity_abortions,
          parity_living,
          previous_cesarean,
          previous_complications,
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
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          encounter_date,
          encounter_type,
          visit_reason,
          risk_score,
          care_status,
          payment_status,
          follow_up_plan
        FROM cardiology_encounters
        WHERE patient_id = $1
        ORDER BY encounter_date DESC, updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          encounter_date,
          encounter_type,
          chief_complaint,
          assessment,
          plan,
          payment_status
        FROM ophthalmology_encounters
        WHERE patient_id = $1
        ORDER BY encounter_date DESC, updated_at DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          ed_visit_number,
          arrival_date,
          chief_complaint,
          presenting_symptoms,
          allergies,
          current_medications,
          triage_level,
          triage_acuity,
          ed_status,
          disposition,
          follow_up_instructions
        FROM ed_visits
        WHERE patient_id = $1
        ORDER BY arrival_date DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          admission_id,
          screening_location,
          screening_datetime,
          qsofa_score,
          sirs_score,
          lactate,
          sepsis_suspected,
          sepsis_alert_triggered
        FROM sepsis_screenings
        WHERE patient_id = $1
        ORDER BY screening_datetime DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          admission_id,
          sepsis_screening_id,
          bundle_start_time,
          three_hour_bundle_complete,
          six_hour_bundle_complete,
          overall_compliance,
          managed_by
        FROM sepsis_bundles
        WHERE patient_id = $1
        ORDER BY bundle_start_time DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          bt.id,
          bt.inventory_id,
          bt.cross_match_id,
          bt.order_date,
          bt.start_time,
          bt.end_time,
          bt.indication,
          bt.transfusion_status,
          bt.consent_obtained,
          bt.transfusion_reaction,
          bt.reaction_type,
          bt.reaction_severity,
          bt.reaction_time,
          bt.reaction_management,
          bi.unit_number,
          bi.component_type,
          bi.blood_group,
          bi.rh_factor
        FROM blood_transfusions bt
        LEFT JOIN blood_inventory bi ON bi.id = bt.inventory_id
        WHERE bt.patient_id = $1
        ORDER BY
          CASE
            WHEN bt.transfusion_status = 'in_progress' THEN 1
            WHEN bt.transfusion_status = 'ordered' THEN 2
            ELSE 3
          END,
          COALESCE(bt.start_time, bt.order_date, bt.created_at) DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT COUNT(*)::int AS active_count
        FROM blood_transfusions
        WHERE patient_id = $1
          AND transfusion_status IN ('ordered', 'in_progress')
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          id,
          doctor_id,
          consultation_type,
          status,
          scheduled_start_time,
          actual_start_time,
          patient_consent,
          consent_date,
          technical_issues,
          notes
        FROM telemedicine_consultations
        WHERE patient_id = $1
        ORDER BY COALESCE(actual_start_time, scheduled_start_time, created_at) DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          lca.id,
          lca.lab_order_id,
          lca.component_name,
          lca.result_value,
          lca.critical_range,
          lca.severity,
          lca.alert_status,
          lca.alerted_at,
          lca.acknowledged_at,
          lo.status AS lab_order_status
        FROM lab_critical_alerts lca
        LEFT JOIN lab_orders lo ON lo.id = lca.lab_order_id
        WHERE lca.patient_id = $1
        ORDER BY COALESCE(lca.alerted_at, lca.created_at) DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT COUNT(*)::int AS active_count
        FROM lab_critical_alerts
        WHERE patient_id = $1
          AND COALESCE(alert_status, 'pending') NOT IN ('resolved', 'closed')
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT
          p.id,
          p.prescription_number,
          p.medication_name,
          p.generic_name,
          p.dosage,
          p.frequency,
          p.quantity,
          p.status,
          p.prescribed_date,
          p.created_at,
          p.doctor_id,
          u.first_name || ' ' || u.last_name AS prescriber_name
        FROM prescriptions p
        LEFT JOIN users u ON u.id = p.doctor_id
        WHERE p.patient_id = $1
        ORDER BY COALESCE(p.prescribed_date, p.created_at) DESC
        LIMIT 1
        `,
        [patientId],
      ),
      this.safeQuery(
        tenantDb,
        `
        SELECT COUNT(*)::int AS active_count
        FROM prescriptions
        WHERE patient_id = $1
          AND COALESCE(status, 'active') = 'active'
        `,
        [patientId],
      ),
    ]);

    const latestVitals = latestVitalsRows[0] || null;
    const latestHivEnrollment = hivEnrollmentRows[0] || null;
    const latestMaternityEnrollment = maternityEnrollmentRows[0] || null;
    const latestOncologyCase = oncologyCaseRows[0] || null;
    const oncologyActiveCaseCount = Number(oncologyActiveCountRows[0]?.active_count || 0);
    const latestCardiologyEncounter = cardiologyEncounterRows[0] || null;
    const latestOphthalmologyEncounter = ophthalmologyEncounterRows[0] || null;
    const latestEdVisit = edVisitRows[0] || null;
    const latestSepsisScreening = sepsisScreeningRows[0] || null;
    const latestSepsisBundle = sepsisBundleRows[0] || null;
    const latestBloodTransfusion = bloodTransfusionRows[0] || null;
    const bloodTransfusionActiveCount = Number(bloodTransfusionActiveCountRows[0]?.active_count || 0);
    const latestTelemedicineConsultation = telemedicineConsultationRows[0] || null;
    const latestLabCriticalAlert = labCriticalAlertRows[0] || null;
    const labCriticalAlertOpenCount = Number(labCriticalAlertOpenCountRows[0]?.active_count || 0);
    const latestLabOrder = labOrderRows[0] || null;
    const labOrderActiveCount = Number(labOrderActiveCountRows[0]?.active_count || 0);
    const latestImagingReport = imagingReportRows[0] || null;
    const imagingActionableUnacknowledgedCount = Number(
      imagingActionableUnacknowledgedCountRows[0]?.active_count || 0,
    );
    const latestPharmacyPrescription = pharmacyPrescriptionRows[0] || null;
    const pharmacyPrescriptionActiveCount = Number(
      pharmacyPrescriptionActiveCountRows[0]?.active_count || 0,
    );

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
        cardiology: {
          latestEncounter: latestCardiologyEncounter,
        },
        ophthalmology: {
          latestEncounter: latestOphthalmologyEncounter,
        },
        ed: {
          latestVisit: latestEdVisit,
        },
        sepsis: {
          latestScreening: latestSepsisScreening,
          latestBundle: latestSepsisBundle,
        },
        bloodBank: {
          latestTransfusion: latestBloodTransfusion,
          activeTransfusionCount: bloodTransfusionActiveCount,
        },
        telemedicine: {
          latestConsultation: latestTelemedicineConsultation,
        },
        lab: {
          latestCriticalAlert: latestLabCriticalAlert,
          unresolvedAlertCount: labCriticalAlertOpenCount,
          latestOrder: latestLabOrder,
          activeOrderCount: labOrderActiveCount,
        },
        imaging: {
          latestReport: latestImagingReport,
          actionableUnacknowledgedCount: imagingActionableUnacknowledgedCount,
        },
        pharmacy: {
          latestPrescription: latestPharmacyPrescription,
          activePrescriptionCount: pharmacyPrescriptionActiveCount,
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

    // Generate tenant-specific MRN. patientNumber has a DB-level unique
    // constraint, so a collision (possible under bursty concurrent
    // registration since the random suffix has limited entropy) fails the
    // save with a 23505 error rather than corrupting data — retry with a
    // fresh suffix instead of surfacing that as a hard failure to the caller.
    if (!patient.patientNumber) {
      const tenantCode = tenantSlug.toUpperCase().replace(/-/g, '').substring(0, 3);
      const timestamp = Date.now().toString().slice(-6);
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const random = randomInt(0, 1000).toString().padStart(3, '0');
        patient.patientNumber = `${tenantCode}${timestamp}${random}`;
        try {
          return await patientRepository.save(patient);
        } catch (error: any) {
          const isUniqueViolation = error?.code === '23505';
          if (!isUniqueViolation || attempt === maxAttempts) {
            throw error;
          }
          this.logger.warn(
            `Patient number collision on "${patient.patientNumber}", retrying (attempt ${attempt}/${maxAttempts})`,
          );
        }
      }
    }

    return patientRepository.save(patient);
  }

  async updatePatient(id: string, updatePatientDto: UpdatePatientDto, tenantDb: DataSource): Promise<Patient> {
    const patientRepository = tenantDb.getRepository(Patient);
    const patient = await this.getPatientById(id, tenantDb);
    
    const allergiesChanged = updatePatientDto.allergies !== undefined
      && updatePatientDto.allergies !== patient.allergies;

    Object.assign(patient, updatePatientDto);
    const saved = await patientRepository.save(patient);

    if (allergiesChanged && this.medicalNlpService) {
      try {
        await this.medicalNlpService.reconcilePatientAllergies(tenantDb, id);
      } catch (e) {
        this.logger.warn(`NLP allergy reconciliation failed for patient ${id}: ${e.message}`);
      }
    }

    return saved;
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

  // ── SDOH ──────────────────────────────────────────────────────────────────

  async getPatientSdoh(patientId: string, tenantDb: DataSource): Promise<PatientSdoh[]> {
    // Verify patient exists
    await this.getPatientById(patientId, tenantDb);

    try {
      const repo = tenantDb.getRepository(PatientSdoh);
      return repo.find({
        where: { patientId },
        order: { assessmentDate: 'DESC' },
        take: 10,
      });
    } catch (error) {
      if (this.isMissingRelationError(error)) return [];
      throw error;
    }
  }

  async createPatientSdoh(
    patientId: string,
    data: Partial<PatientSdoh>,
    assessedBy: string,
    tenantDb: DataSource,
  ): Promise<PatientSdoh> {
    await this.getPatientById(patientId, tenantDb);

    const repo   = tenantDb.getRepository(PatientSdoh);
    const record = repo.create({
      ...data,
      patientId,
      assessedBy,
      assessmentDate: data.assessmentDate ?? new Date(),
    });
    return repo.save(record);
  }
}
