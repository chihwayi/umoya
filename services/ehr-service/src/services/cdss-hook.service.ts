import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CdssService } from './cdss.service';
import { Patient } from '../entities/patient.entity';

interface ConceptSummary {
  conceptId: string;
  term?: string;
  moduleId?: string;
  definitionStatus?: string;
}

interface TriageHookPayload {
  tenantId: string;
  tenantDb: DataSource;
  assessment: any;
  chiefComplaintConcept?: ConceptSummary | null;
  observationConcepts?: ConceptSummary[];
}

interface PrescriptionHookPayload {
  tenantId: string;
  tenantDb: DataSource;
  prescription: any;
}

interface VitalsHookPayload {
  tenantId: string;
  tenantDb: DataSource;
  vitals: any;
}

interface LabOrderHookPayload {
  tenantId?: string;
  tenantDb: DataSource;
  labOrder: any;
}

interface ImagingOrderHookPayload {
  tenantId?: string;
  tenantDb: DataSource;
  imagingOrder: any;
}

interface NursingNoteHookPayload {
  tenantId: string;
  tenantDb: DataSource;
  note: any;
  observations?: ConceptSummary[];
  interventions?: ConceptSummary[];
  outcomes?: ConceptSummary[];
}

@Injectable()
export class CdssHookService {
  private readonly logger = new Logger(CdssHookService.name);

  constructor(private readonly cdssService: CdssService) {}

  async handleTriageAssessment(payload: TriageHookPayload) {
    try {
      const { tenantDb, assessment, chiefComplaintConcept, observationConcepts } = payload;
      const patientId = assessment.patient_id ?? assessment.patientId;
      const { age, gender } = await this.getPatientContext(tenantDb, patientId);

      const vitalsPayload: Record<string, any> = {
        priority: assessment.priority,
        severity_score: assessment.severity_score,
        pain_score: assessment.pain_score,
        recorded_at: assessment.recorded_at ?? new Date().toISOString(),
      };

      const diagnosisTerms = [
        chiefComplaintConcept?.term || assessment.chief_complaint,
        ...(observationConcepts || []).map((obs) => obs.term).filter(Boolean),
      ].filter(Boolean) as string[];

      const medications = this.parseTextList(assessment.medications);
      const medicalHistory = this.parseTextList(assessment.history);

      const riskPayload = {
        patientId,
        age,
        gender,
        vitals: vitalsPayload,
        medications,
        diagnoses: diagnosisTerms,
        medicalHistory,
      };

      const [risk, diagnosis] = await Promise.all([
        this.cdssService.riskAssessment(riskPayload, tenantDb).catch((error) => {
          this.logger.warn(`CDSS risk hook failed: ${error?.message || error}`);
          return null;
        }),
        this.cdssService
          .diagnosisAssist({
            chiefComplaint: chiefComplaintConcept?.term || assessment.chief_complaint,
            symptoms: diagnosisTerms,
            vitals: vitalsPayload,
            age,
            gender,
          })
          .catch((error) => {
            this.logger.warn(`CDSS diagnosis hook failed: ${error?.message || error}`);
            return null;
          }),
      ]);

      if (!risk && !diagnosis) {
        return null;
      }

      return { risk, diagnosis };
    } catch (error) {
      this.logger.warn(`Failed to handle triage CDSS hook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  async handlePrescriptionCreated(payload: PrescriptionHookPayload) {
    try {
      const { tenantDb, prescription } = payload;
      const patientId = prescription.patient_id ?? prescription.patientId;
      const { age, gender } = await this.getPatientContext(tenantDb, patientId);

      const existingPrescriptions = await tenantDb.query(
        `
        SELECT medication_name, medication_name_snomed_code
        FROM prescriptions
        WHERE patient_id = $1
          AND status IN ('active', 'pending')
        `,
        [patientId],
      );

      const medicationEntries = [
        {
          name: prescription.medication_name,
          conceptId: prescription.medication_name_snomed_code,
        },
        ...existingPrescriptions.map((row: any) => ({
          name: row.medication_name,
          conceptId: row.medication_name_snomed_code,
        })),
      ].filter((entry) => entry.name);

      const medNamesForInteractions = medicationEntries.map(
        (entry, index) => entry.conceptId || `${entry.name || 'MED'}-${index}`,
      );

      const [interactions, highRisk, duplicates] = await Promise.all([
        this.cdssService.checkDrugInteractions(medNamesForInteractions, patientId).catch((error) => {
          this.logger.warn(`CDSS interaction hook failed: ${error?.message || error}`);
          return null;
        }),
        this.cdssService
          .checkHighRiskMedications(
            medicationEntries.map((entry) => ({
              name: entry.name,
              conceptId: entry.conceptId,
            })),
            age,
            gender,
          )
          .catch((error) => {
            this.logger.warn(`CDSS high-risk hook failed: ${error?.message || error}`);
            return null;
          }),
        this.cdssService
          .detectDuplicateTherapy(
            medicationEntries.map((entry) => ({
              name: entry.name,
              conceptId: entry.conceptId,
            })),
          )
          .catch((error) => {
            this.logger.warn(`CDSS duplicate therapy hook failed: ${error?.message || error}`);
            return null;
          }),
      ]);

      if (!interactions && !highRisk && !duplicates) {
        return null;
      }

      return {
        interactions,
        highRisk,
        duplicates,
      };
    } catch (error) {
      this.logger.warn(`Failed to handle prescription CDSS hook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  async handleVitalsRecorded(payload: VitalsHookPayload) {
    try {
      const { tenantDb, vitals } = payload;
      const patientId = vitals.patientId ?? vitals.patient_id;
      const { age, gender } = await this.getPatientContext(tenantDb, patientId);

      const formattedVitals = {
        bloodPressure: vitals.bloodPressure ?? vitals.blood_pressure,
        systolic: vitals.bloodPressureSystolic ?? vitals.systolic,
        diastolic: vitals.bloodPressureDiastolic ?? vitals.diastolic,
        heartRate: vitals.heartRate ?? vitals.heart_rate,
        respiratoryRate: vitals.respiratoryRate ?? vitals.respiratory_rate,
        temperature: vitals.temperature,
        oxygenSaturation: vitals.oxygenSaturation ?? vitals.oxygen_saturation,
        weight: vitals.weight,
        height: vitals.height,
        bmi: vitals.bmi,
        painLevel: vitals.painLevel ?? vitals.pain_level,
        recordedAt: vitals.recordedAt ?? vitals.recorded_at ?? new Date().toISOString(),
      };

      const risk = await this.cdssService
        .riskAssessment(
          {
            patientId,
            age,
            gender,
            vitals: formattedVitals,
          },
          tenantDb,
        )
        .catch((error) => {
          this.logger.warn(`CDSS vitals risk hook failed: ${error?.message || error}`);
          return null;
        });

      return risk ? { risk } : null;
    } catch (error) {
      this.logger.warn(`Failed to handle vitals CDSS hook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  async handleLabOrderCreated(payload: LabOrderHookPayload) {
    try {
      const { tenantDb, labOrder } = payload;
      const patientId = labOrder.patient_id ?? labOrder.patientId;
      const { age, gender } = await this.getPatientContext(tenantDb, patientId);

      const diagnosisTerms = this.buildDiagnosisTerms(
        labOrder.snomed_term,
        labOrder.snomedTerm,
        labOrder.clinical_indication,
        labOrder.clinicalInfo,
        labOrder.suspected_diagnosis,
      );

      const primaryCondition = diagnosisTerms[0];

      const guidelines = primaryCondition
        ? await this.cdssService
            .getGuidelines(primaryCondition, {
              age,
              gender,
              comorbidities: [],
            })
            .catch((error) => {
              this.logger.warn(`CDSS lab guideline hook failed: ${error?.message || error}`);
              return null;
            })
        : null;

      const careGaps = diagnosisTerms.length
        ? await this.cdssService
            .detectCareGaps(age, gender, undefined, diagnosisTerms)
            .catch((error) => {
              this.logger.warn(`CDSS lab care-gap hook failed: ${error?.message || error}`);
              return null;
            })
        : null;

      if (
        !guidelines &&
        (!careGaps || (!careGaps.has_gaps && !(careGaps.gaps && careGaps.gaps.length > 0)))
      ) {
        return null;
      }

      return { guidelines, careGaps };
    } catch (error) {
      this.logger.warn(`Failed to handle lab-order CDSS hook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  async handleImagingOrderCreated(payload: ImagingOrderHookPayload) {
    try {
      const { tenantDb, imagingOrder } = payload;
      const patientId = imagingOrder.patient_id ?? imagingOrder.patientId;
      const { age, gender } = await this.getPatientContext(tenantDb, patientId);

      const diagnosisTerms = this.buildDiagnosisTerms(
        imagingOrder.snomed_term,
        imagingOrder.snomedTerm,
        imagingOrder.clinical_indication,
        imagingOrder.clinical_history,
        imagingOrder.suspected_diagnosis,
      );

      const guidelines = diagnosisTerms.length
        ? await this.cdssService
            .getGuidelines(diagnosisTerms[0], {
              age,
              gender,
              comorbidities: [],
            })
            .catch((error) => {
              this.logger.warn(`CDSS imaging guideline hook failed: ${error?.message || error}`);
              return null;
            })
        : null;

      const careGaps = diagnosisTerms.length
        ? await this.cdssService
            .detectCareGaps(age, gender, undefined, diagnosisTerms)
            .catch((error) => {
              this.logger.warn(`CDSS imaging care-gap hook failed: ${error?.message || error}`);
              return null;
            })
        : null;

      if (
        !guidelines &&
        (!careGaps || (!careGaps.has_gaps && !(careGaps.gaps && careGaps.gaps.length > 0)))
      ) {
        return null;
      }

      return { guidelines, careGaps };
    } catch (error) {
      this.logger.warn(`Failed to handle imaging-order CDSS hook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  async handleNursingNoteRecorded(payload: NursingNoteHookPayload) {
    try {
      const { tenantDb, note, observations, interventions, outcomes } = payload;
      const patientId = note.patient_id ?? note.patientId;
      const { age, gender } = await this.getPatientContext(tenantDb, patientId);

      const symptomTerms = [
        ...this.sanitizeConceptTerms(observations),
        ...this.sanitizeConceptTerms(outcomes),
        ...this.parseTextList(note.observations),
        ...this.parseTextList(note.outcomes),
      ].filter(Boolean);

      const interventionTerms = [
        ...this.sanitizeConceptTerms(interventions),
        ...this.parseTextList(note.interventions),
      ].filter(Boolean);

      const diagnosis = symptomTerms.length
        ? await this.cdssService
            .diagnosisAssist({
              symptoms: symptomTerms,
              vitals: note.vital_signs ?? note.vitals,
              age,
              gender,
            })
            .catch((error) => {
              this.logger.warn(`CDSS nursing-note diagnosis hook failed: ${error?.message || error}`);
              return null;
            })
        : null;

      const careGaps = symptomTerms.length || interventionTerms.length
        ? await this.cdssService
            .detectCareGaps(age, gender, undefined, symptomTerms)
            .catch((error) => {
              this.logger.warn(`CDSS nursing-note care-gap hook failed: ${error?.message || error}`);
              return null;
            })
        : null;

      if (
        !diagnosis &&
        (!careGaps || (!careGaps.has_gaps && !(careGaps.gaps && careGaps.gaps.length > 0)))
      ) {
        return null;
      }

      return {
        diagnosis,
        careGaps,
        recommendedInterventions: interventionTerms.slice(0, 5),
      };
    } catch (error) {
      this.logger.warn(`Failed to handle nursing-note CDSS hook: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private async getPatientContext(tenantDb: DataSource, patientId?: string | null) {
    if (!patientId) {
      return { patient: null, age: undefined, gender: undefined };
    }
    try {
      const patientRepo = tenantDb.getRepository(Patient);
      const patient = await patientRepo.findOne({ where: { id: patientId } });
      return {
        patient,
        age: this.calculateAge(patient?.dateOfBirth),
        gender: patient?.gender ?? undefined,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch patient context for ${patientId}: ${error instanceof Error ? error.message : error}`);
      return { patient: null, age: undefined, gender: undefined };
    }
  }

  private sanitizeConceptTerms(concepts?: ConceptSummary[]): string[] {
    if (!concepts || concepts.length === 0) {
      return [];
    }
    return concepts.map((concept) => concept.term).filter((term): term is string => !!term && term.length > 0);
  }

  private buildDiagnosisTerms(...terms: Array<string | null | undefined>): string[] {
    return terms
      .flatMap((term) => this.parseTextList(term))
      .map((term) => term.trim())
      .filter((term) => term.length > 0);
  }

  private parseTextList(value?: string | null): string[] {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private calculateAge(date?: string | Date | null): number | undefined {
    if (!date) return undefined;
    const birth = new Date(date);
    if (Number.isNaN(birth.getTime())) return undefined;
    const diffMs = Date.now() - birth.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  }
}
