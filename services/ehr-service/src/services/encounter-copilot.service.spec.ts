import { ClinicalPathway } from '../entities/clinical-pathway.entity';
import { EncounterCopilotSession } from '../entities/encounter-copilot-session.entity';
import { OrderAppropriatenessReview } from '../entities/order-appropriateness-review.entity';
import { ResultFollowupTask } from '../entities/result-followup-task.entity';
import { TreatmentPathwayInstance } from '../entities/treatment-pathway-instance.entity';
import { EncounterCopilotService } from './encounter-copilot.service';

describe('EncounterCopilotService', () => {
  const buildSmartDefaultsService = () => ({
    getDefaults: jest.fn().mockResolvedValue({
      show_pregnancy_status: { value: true, confidence: 0.95, source: 'builtin' },
    }),
  });
  const aiSurfaceContractService = {
    buildSurfaceMetadata: jest.fn((payload) => ({
      aiSurface: 'encounter_copilot',
      useCase: payload.useCase,
      provenance: { modelId: payload.modelId, modelVersion: payload.modelVersion, provider: payload.provider, source: payload.source },
    })),
  };

  const buildRepo = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      if (Array.isArray(value)) {
        return value.map((item, index) => ({ id: item.id ?? `saved-${index + 1}`, ...item }));
      }
      return { id: 'session-1', ...value };
    }),
    findOneBy: jest.fn(async ({ id }) => ({
      id,
      patientId: 'patient-1',
      status: 'generated',
      summary: 'summary',
    })),
    find: jest.fn().mockResolvedValue([
      {
        id: 'path-inst-1',
        encounterCopilotSessionId: 'session-1',
        pathwayName: 'Diabetes Pathway',
        recommendationRank: 1,
      },
    ]),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a persisted session with specialty contributors and pathway instances', async () => {
    const smartDefaultsService = buildSmartDefaultsService();
    const sessionRepo = buildRepo();
    const pathwayInstanceRepo = buildRepo();
    const resultFollowupRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const clinicalPathwayRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'pathway-1',
          pathwayCode: 'DM-001',
          pathwayName: 'Diabetes Pathway',
          specialty: 'endocrinology',
          condition: 'diabetes',
          evidenceLevel: 'A',
          guidelineSource: 'WHO',
          targetPopulation: 'Adults',
          isDefault: false,
        } as ClinicalPathway,
      ]),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM patients')) {
          return [
            {
              id: 'patient-1',
              patient_number: 'P001',
              first_name: 'Jane',
              last_name: 'Doe',
              date_of_birth: '1990-01-10',
              gender: 'female',
              pregnancy_status: null,
              emergency_contact_name: 'John Doe',
              emergency_contact_phone: '0772000000',
            },
          ];
        }
        if (sql.includes('FROM medical_records')) {
          return [
            {
              id: 'mr-1',
              appointment_id: 'appt-1',
              record_type: 'consultation',
              visit_date: '2026-03-26T09:00:00.000Z',
              chief_complaint: 'Poor glucose control',
              assessment: 'T2DM uncontrolled',
              plan: 'Review HbA1c',
              diagnoses: [{ description: 'Type 2 diabetes mellitus', code: 'E11' }],
            },
          ];
        }
        if (sql.includes('FROM ambient_sessions')) {
          return [
            {
              id: 'ambient-1',
              draft_note: { subjective: 'Patient reports hyperglycemia' },
              ai_suggested_orders: [{ name: 'Basic metabolic panel', type: 'lab_test', priority: 'normal' }],
              ai_suggested_diagnoses: [],
              alerts_raised: [],
            },
          ];
        }
        if (sql.includes('FROM problems')) {
          return [
            {
              id: 'problem-1',
              description: 'Type 2 diabetes mellitus',
              status: 'active',
              onset_date: '2022-01-10',
              code: 'E11',
              snomed_concept_id: null,
              snomed_term: null,
            },
          ];
        }
        if (sql.includes('FROM allergies')) {
          return [{ allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate' }];
        }
        if (sql.includes('FROM prescriptions')) {
          return [{ medication_name: 'Metformin', dosage: '500mg', frequency: 'bd', status: 'active' }];
        }
        if (sql.includes('FROM care_gap_detections')) {
          return [];
        }
        if (sql.includes('FROM medication_alerts')) {
          return [];
        }
        if (sql.includes('FROM vitals')) {
          return [{ heart_rate: 88, blood_pressure: '140/90', recorded_at: '2026-03-25T09:00:00.000Z' }];
        }
        if (sql.includes('FROM diabetes_registry')) {
          return [
            {
              id: 'dm-1',
              diabetes_type: 'type2',
              status: 'active',
              care_plan: 'Diabetes plan',
              hba1c_value: 10.1,
              hba1c_date: '2025-08-01',
              eye_exam_checked: false,
              eye_exam_date: null,
              bundle_completion_percentage: 40,
            },
          ];
        }
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [];
        }
        if (sql.includes('FROM maternity_enrollments')) {
          return [];
        }
        if (sql.includes('FROM oncology_cases')) {
          return [];
        }
        return [];
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === EncounterCopilotSession) {
          return sessionRepo;
        }
        if (entity === TreatmentPathwayInstance) {
          return pathwayInstanceRepo;
        }
        if (entity === ResultFollowupTask) {
          return resultFollowupRepo;
        }
        if (entity === ClinicalPathway) {
          return clinicalPathwayRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new EncounterCopilotService(smartDefaultsService as any, aiSurfaceContractService as any);
    const result = await service.generateSession(
      'kids-clinic',
      tenantDb,
      {
        patientId: 'patient-1',
        appointmentId: 'appt-1',
        specialty: 'endocrinology',
      },
      'user-1',
    );

    expect(result.id).toBe('session-1');
    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        specialty: 'endocrinology',
        activeProblems: expect.arrayContaining([
          expect.objectContaining({ description: 'Type 2 diabetes mellitus' }),
        ]),
        suggestedOrders: expect.arrayContaining([
          expect.objectContaining({ name: 'HbA1c' }),
          expect.objectContaining({ name: 'Basic metabolic panel' }),
        ]),
        pathwayRecommendations: expect.arrayContaining([
          expect.objectContaining({ pathwayName: 'Diabetes Pathway' }),
        ]),
      }),
    );
    expect(pathwayInstanceRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          encounterCopilotSessionId: 'session-1',
          pathwayName: 'Diabetes Pathway',
        }),
      ]),
    );
    expect(result.treatmentPathways).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathwayName: 'Diabetes Pathway' }),
      ]),
    );
    expect(result.resultFollowupTasks).toEqual([]);
    expect(result.aiMetadata).toEqual(expect.objectContaining({
      aiSurface: 'encounter_copilot',
      useCase: 'encounter_copilot',
    }));
  });

  it('persists order appropriateness reviews with duplicate-medication caution and copilot alignment', async () => {
    const smartDefaultsService = buildSmartDefaultsService();
    const reviewRepo = buildRepo();
    const resultFollowupRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const sessionRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'session-1',
        patientId: 'patient-1',
        appointmentId: 'appt-1',
        suggestedOrders: [{ name: 'Metformin', type: 'medication' }],
        likelyCareGaps: [],
        pathwayRecommendations: [{ pathwayName: 'Diabetes Pathway', condition: 'diabetes' }],
        missingContext: [],
      }),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM allergies')) {
          return [];
        }
        if (sql.includes('FROM prescriptions')) {
          return [{ medication_name: 'Metformin', dosage: '500mg', frequency: 'bd', status: 'active' }];
        }
        if (sql.includes('FROM medication_alerts')) {
          return [];
        }
        return [];
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === EncounterCopilotSession) {
          return sessionRepo;
        }
        if (entity === OrderAppropriatenessReview) {
          return reviewRepo;
        }
        if (entity === ResultFollowupTask) {
          return resultFollowupRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new EncounterCopilotService(smartDefaultsService as any, aiSurfaceContractService as any);
    const result = await service.reviewProposedOrders(
      tenantDb,
      'session-1',
      [{ name: 'Metformin', type: 'medication' }],
      'user-1',
    );

    expect(reviewRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          encounterCopilotSessionId: 'session-1',
          proposedOrderName: 'Metformin',
          appropriatenessStatus: 'acceptable_with_caution',
          blockingIssues: expect.arrayContaining([
            expect.objectContaining({ code: 'duplicate_active_medication' }),
          ]),
          supportingSignals: expect.arrayContaining([
            expect.objectContaining({ code: 'aligned_with_copilot_suggestion' }),
          ]),
        }),
      ]),
    );
    expect(result.reviews).toHaveLength(1);
  });

  it('persists result follow-up tasks from pending critical lab alerts and radiology findings', async () => {
    const smartDefaultsService = buildSmartDefaultsService();
    const resultFollowupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) =>
        value.map((item: any, index: number) => ({ id: `followup-${index + 1}`, ...item })),
      ),
      find: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'followup-1',
            encounterCopilotSessionId: 'session-1',
            patientId: 'patient-1',
            sourceType: 'critical_result_alert',
            sourceReferenceId: 'alert-1',
            priority: 'urgent',
            status: 'open',
            dueAt: new Date('2026-03-26T10:00:00.000Z'),
            createdAt: new Date('2026-03-26T08:00:00.000Z'),
          },
          {
            id: 'followup-2',
            encounterCopilotSessionId: 'session-1',
            patientId: 'patient-1',
            sourceType: 'radiology_ai_finding',
            sourceReferenceId: 'finding-1',
            priority: 'high',
            status: 'open',
            dueAt: new Date('2026-03-27T08:00:00.000Z'),
            createdAt: new Date('2026-03-26T08:30:00.000Z'),
          },
        ]),
    };
    const sessionRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'session-1',
        patientId: 'patient-1',
        appointmentId: 'appt-1',
      }),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM critical_result_alerts')) {
          return [
            {
              id: 'alert-1',
              lab_order_id: 'lab-1',
              ordering_provider_id: 'doctor-1',
              test_code: 'K',
              test_name: 'Potassium',
              result_value: '2.8',
              critical_value_type: 'critical',
              alert_message: 'Severe hypokalemia requires immediate review.',
              status: 'pending',
              created_at: '2026-03-26T07:45:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM radiology_ai_findings')) {
          return [
            {
              id: 'finding-1',
              study_id: 'study-1',
              modality: 'CXR',
              findings: [{ label: 'Pleural effusion', confidence: 0.92, severity: 'high' }],
              top_finding: 'Pleural effusion',
              overall_confidence: 0.92,
              radiologist_reviewed: false,
              radiologist_notes: null,
              alerted: true,
              analyzed_at: '2026-03-26T06:00:00.000Z',
            },
          ];
        }
        return [];
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === EncounterCopilotSession) {
          return sessionRepo;
        }
        if (entity === ResultFollowupTask) {
          return resultFollowupRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new EncounterCopilotService(smartDefaultsService as any, aiSurfaceContractService as any);
    const result = await service.generateResultFollowupTasks(tenantDb, 'session-1', 'user-1');

    expect(resultFollowupRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          encounterCopilotSessionId: 'session-1',
          sourceType: 'critical_result_alert',
          taskType: 'lab_result_followup',
          priority: 'urgent',
        }),
        expect.objectContaining({
          encounterCopilotSessionId: 'session-1',
          sourceType: 'radiology_ai_finding',
          taskType: 'imaging_result_followup',
          priority: 'urgent',
        }),
      ]),
    );
    expect(result.createdCount).toBe(2);
    expect(result.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'critical_result_alert' }),
        expect.objectContaining({ sourceType: 'radiology_ai_finding' }),
      ]),
    );
  });

  it('adds cardiology and emergency-sepsis contributors with acute follow-through recommendations', async () => {
    const smartDefaultsService = buildSmartDefaultsService();
    const sessionRepo = buildRepo();
    const pathwayInstanceRepo = buildRepo();
    const resultFollowupRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const clinicalPathwayRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'pathway-card-1',
          pathwayCode: 'CARD-001',
          pathwayName: 'Acute Coronary Syndrome Pathway',
          specialty: 'cardiology',
          condition: 'acute coronary syndrome',
          evidenceLevel: 'A',
          guidelineSource: 'WHO',
          targetPopulation: 'Adults',
          isDefault: false,
        } as ClinicalPathway,
        {
          id: 'pathway-sepsis-1',
          pathwayCode: 'SEP-001',
          pathwayName: 'Sepsis Response Pathway',
          specialty: 'emergency_medicine',
          condition: 'sepsis',
          evidenceLevel: 'A',
          guidelineSource: 'WHO',
          targetPopulation: 'Adults',
          isDefault: false,
        } as ClinicalPathway,
      ]),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM patients')) {
          return [
            {
              id: 'patient-1',
              patient_number: 'P100',
              first_name: 'James',
              last_name: 'Pulse',
              date_of_birth: '1975-04-10',
              gender: 'male',
              pregnancy_status: null,
              emergency_contact_name: 'Jane Pulse',
              emergency_contact_phone: '0772555000',
            },
          ];
        }
        if (sql.includes('FROM medical_records')) {
          return [
            {
              id: 'mr-2',
              appointment_id: 'appt-2',
              record_type: 'consultation',
              visit_date: '2026-03-26T09:00:00.000Z',
              chief_complaint: 'Chest pain and fever',
              assessment: 'Acute chest pain with possible infection',
              plan: 'Cardiac and sepsis workup',
              diagnoses: [{ description: 'Chest pain', code: 'R07.9' }],
            },
          ];
        }
        if (sql.includes('FROM ambient_sessions')) {
          return [];
        }
        if (sql.includes('FROM problems')) {
          return [];
        }
        if (sql.includes('FROM allergies')) {
          return [];
        }
        if (sql.includes('FROM prescriptions')) {
          return [];
        }
        if (sql.includes('FROM care_gap_detections')) {
          return [];
        }
        if (sql.includes('FROM medication_alerts')) {
          return [];
        }
        if (sql.includes('FROM vitals')) {
          return [{ heart_rate: 118, blood_pressure: '92/58', respiratory_rate: 24, recorded_at: '2026-03-26T08:45:00.000Z' }];
        }
        if (sql.includes('FROM diabetes_registry')) {
          return [];
        }
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [];
        }
        if (sql.includes('FROM maternity_enrollments')) {
          return [];
        }
        if (sql.includes('FROM oncology_cases')) {
          return [];
        }
        if (sql.includes('FROM cardiology_encounters')) {
          return [
            {
              id: 'card-enc-1',
              encounter_date: '2026-03-25T08:00:00.000Z',
              encounter_type: 'clinic_visit',
              visit_reason: 'Chest pain',
              hemodynamics: { bloodPressure: '92/58', heartRate: 118 },
              diagnostic_tests: [],
              care_plan: null,
              follow_up_plan: null,
              risk_score: 'critical',
              care_status: 'in_progress',
            },
          ];
        }
        if (sql.includes('FROM ed_visits')) {
          return [
            {
              id: 'ed-visit-1',
              arrival_date: '2026-03-26T07:00:00.000Z',
              chief_complaint: 'Chest pain',
              triage_level: 2,
              triage_acuity: 'emergent',
              ed_status: 'in_treatment',
              disposition: null,
              code_stroke: false,
              code_stemi: true,
              code_sepsis: true,
              follow_up_instructions: null,
              quality_flags: [],
            },
          ];
        }
        if (sql.includes('FROM sepsis_screenings')) {
          return [
            {
              id: 'screen-1',
              screening_datetime: '2026-03-26T07:10:00.000Z',
              qsofa_score: 2,
              sirs_score: 3,
              lactate: 4.4,
              sepsis_suspected: true,
              severe_sepsis: true,
              septic_shock: false,
              sepsis_bundle_initiated: true,
            },
          ];
        }
        if (sql.includes('FROM sepsis_bundles')) {
          return [
            {
              id: 'bundle-1',
              bundle_start_time: '2026-03-26T07:20:00.000Z',
              lactate_value: 4.4,
              repeat_lactate_measured: false,
              repeat_lactate_value: null,
              three_hour_bundle_complete: false,
              six_hour_bundle_complete: false,
              overall_compliance: false,
              patient_outcome: null,
            },
          ];
        }
        return [];
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === EncounterCopilotSession) {
          return sessionRepo;
        }
        if (entity === TreatmentPathwayInstance) {
          return pathwayInstanceRepo;
        }
        if (entity === ResultFollowupTask) {
          return resultFollowupRepo;
        }
        if (entity === ClinicalPathway) {
          return clinicalPathwayRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new EncounterCopilotService(smartDefaultsService as any, aiSurfaceContractService as any);
    const result = await service.generateSession(
      'kids-clinic',
      tenantDb,
      {
        patientId: 'patient-1',
        appointmentId: 'appt-2',
        specialty: 'emergency_medicine',
      },
      'user-1',
    );

    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        specialtyContributors: expect.arrayContaining([
          expect.objectContaining({ module: 'cardiology', specialty: 'cardiology' }),
          expect.objectContaining({ module: 'emergency_sepsis', specialty: 'emergency_medicine' }),
        ]),
        suggestedOrders: expect.arrayContaining([
          expect.objectContaining({ name: 'Cardiology diagnostic order set' }),
          expect.objectContaining({ name: 'Urgent ECG and troponin review' }),
          expect.objectContaining({ name: 'Emergency cardiac protocol review' }),
          expect.objectContaining({ name: 'Queue sepsis three-hour bundle follow-through' }),
          expect.objectContaining({ name: 'Repeat lactate monitoring plan' }),
        ]),
        likelyCareGaps: expect.arrayContaining([
          expect.objectContaining({ gapType: 'cardiology_followup_plan_missing' }),
          expect.objectContaining({ gapType: 'ed_disposition_pending' }),
          expect.objectContaining({ gapType: 'sepsis_repeat_lactate_pending' }),
        ]),
        pathwayRecommendations: expect.arrayContaining([
          expect.objectContaining({ pathwayName: 'Acute Coronary Syndrome Pathway' }),
          expect.objectContaining({ pathwayName: 'Sepsis Response Pathway' }),
        ]),
      }),
    );
    expect(pathwayInstanceRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ pathwayName: 'Acute Coronary Syndrome Pathway' }),
        expect.objectContaining({ pathwayName: 'Sepsis Response Pathway' }),
      ]),
    );
  });
});
