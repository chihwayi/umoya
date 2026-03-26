import { ClinicalPathway } from '../entities/clinical-pathway.entity';
import { EncounterCopilotSession } from '../entities/encounter-copilot-session.entity';
import { OrderAppropriatenessReview } from '../entities/order-appropriateness-review.entity';
import { ResultFollowupTask } from '../entities/result-followup-task.entity';
import { TreatmentPathwayInstance } from '../entities/treatment-pathway-instance.entity';
import { EncounterCopilotService } from './encounter-copilot.service';

describe('MOAS-06 encounter orchestration lifecycle', () => {
  const smartDefaultsService = {
    getDefaults: jest.fn().mockResolvedValue({
      show_pregnancy_status: { value: false, confidence: 0.98, source: 'builtin' },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('proves encounter generation, order review, result follow-up generation, and session readback in one flow', async () => {
    let sessionCounter = 0;
    let pathwayCounter = 0;
    let reviewCounter = 0;
    let followupCounter = 0;

    const sessions: any[] = [];
    const pathwayInstances: any[] = [];
    const reviews: any[] = [];
    const followups: any[] = [];

    const sessionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `session-${++sessionCounter}`, ...value };
        sessions.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ id }) => sessions.find((row) => row.id === id) ?? null),
      find: jest.fn(async ({ where }: any) =>
        sessions.filter((row) => row.patientId === where.patientId).sort((a, b) => 0),
      ),
    };

    const pathwayRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const rows = value.map((item: any) => ({ id: `path-${++pathwayCounter}`, ...item }));
        pathwayInstances.push(...rows);
        return rows;
      }),
      find: jest.fn(async ({ where }: any) =>
        pathwayInstances.filter((row) => row.encounterCopilotSessionId === where.encounterCopilotSessionId),
      ),
    };

    const reviewRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const rows = value.map((item: any) => ({ id: `review-${++reviewCounter}`, ...item }));
        reviews.push(...rows);
        return rows;
      }),
      find: jest.fn(async ({ where }: any) =>
        reviews.filter((row) => row.encounterCopilotSessionId === where.encounterCopilotSessionId),
      ),
    };

    const followupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const rows = value.map((item: any) => ({
          id: `followup-${++followupCounter}`,
          createdAt: new Date('2026-03-26T10:00:00.000Z'),
          updatedAt: new Date('2026-03-26T10:00:00.000Z'),
          ...item,
        }));
        followups.push(...rows);
        return rows;
      }),
      find: jest.fn(async ({ where }: any) =>
        followups.filter((row) => row.encounterCopilotSessionId === where.encounterCopilotSessionId),
      ),
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
              patient_number: 'P-600',
              first_name: 'Morgan',
              last_name: 'Acute',
              date_of_birth: '1982-06-12',
              gender: 'male',
              pregnancy_status: null,
              emergency_contact_name: 'Taylor Acute',
              emergency_contact_phone: '0772000111',
            },
          ];
        }
        if (sql.includes('FROM medical_records')) {
          return [
            {
              id: 'mr-600',
              appointment_id: 'appt-600',
              record_type: 'consultation',
              visit_date: '2026-03-26T09:00:00.000Z',
              chief_complaint: 'Chest pain with fever',
              assessment: 'Acute chest pain, possible sepsis',
              plan: 'Urgent cardiac and sepsis workup',
              diagnoses: [{ description: 'Chest pain', code: 'R07.9' }],
            },
          ];
        }
        if (sql.includes('FROM ambient_sessions')) {
          return [
            {
              id: 'ambient-600',
              draft_note: { subjective: 'Patient reports chest pain and rigors' },
              ai_suggested_orders: [],
              ai_suggested_diagnoses: [],
              alerts_raised: [],
            },
          ];
        }
        if (sql.includes('FROM problems')) {
          return [];
        }
        if (sql.includes('FROM allergies')) {
          return [{ allergen: 'Aspirin', reaction: 'Angioedema', severity: 'severe' }];
        }
        if (sql.includes('FROM prescriptions')) {
          return [{ medication_name: 'Clopidogrel', dosage: '75mg', frequency: 'od', status: 'active' }];
        }
        if (sql.includes('FROM care_gap_detections')) {
          return [];
        }
        if (sql.includes('FROM medication_alerts')) {
          return [{ alert_type: 'interaction', severity: 'high', alert_message: 'Review bleeding risk', alert_details: {}, acknowledged: false }];
        }
        if (sql.includes('FROM vitals')) {
          return [
            {
              recorded_at: '2026-03-26T08:40:00.000Z',
              temperature: 38.9,
              blood_pressure: '92/58',
              heart_rate: 122,
              respiratory_rate: 24,
              oxygen_saturation: 93,
              weight: 80,
              height: 178,
              bmi: 25.2,
              blood_glucose: 7.8,
            },
          ];
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
              id: 'card-600',
              encounter_date: '2026-03-25T14:00:00.000Z',
              encounter_type: 'clinic_visit',
              visit_reason: 'Chest pain',
              hemodynamics: { bloodPressure: '92/58', heartRate: 122 },
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
              id: 'ed-600',
              arrival_date: '2026-03-26T07:15:00.000Z',
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
              id: 'screen-600',
              screening_datetime: '2026-03-26T07:20:00.000Z',
              qsofa_score: 2,
              sirs_score: 3,
              lactate: 4.6,
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
              id: 'bundle-600',
              bundle_start_time: '2026-03-26T07:25:00.000Z',
              lactate_value: 4.6,
              repeat_lactate_measured: false,
              repeat_lactate_value: null,
              three_hour_bundle_complete: false,
              six_hour_bundle_complete: false,
              overall_compliance: false,
              patient_outcome: null,
            },
          ];
        }
        if (sql.includes('FROM critical_result_alerts')) {
          return [
            {
              id: 'alert-600',
              lab_order_id: 'lab-600',
              ordering_provider_id: 'doctor-600',
              test_code: 'LAC',
              test_name: 'Lactate',
              result_value: '4.6',
              critical_value_type: 'critical',
              alert_message: 'Critical lactate requires immediate follow-up.',
              status: 'pending',
              created_at: '2026-03-26T08:00:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM radiology_ai_findings')) {
          return [
            {
              id: 'finding-600',
              study_id: 'study-600',
              modality: 'CXR',
              findings: [{ label: 'Pleural effusion', confidence: 0.94, severity: 'high' }],
              top_finding: 'Pleural effusion',
              overall_confidence: 0.94,
              radiologist_reviewed: false,
              radiologist_notes: null,
              alerted: true,
              analyzed_at: '2026-03-26T08:05:00.000Z',
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
          return pathwayRepo;
        }
        if (entity === OrderAppropriatenessReview) {
          return reviewRepo;
        }
        if (entity === ResultFollowupTask) {
          return followupRepo;
        }
        if (entity === ClinicalPathway) {
          return clinicalPathwayRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new EncounterCopilotService(smartDefaultsService as any);

    const session = await service.generateSession(
      'kids-clinic',
      tenantDb,
      { patientId: 'patient-1', appointmentId: 'appt-600', specialty: 'emergency_medicine' },
      'user-600',
    );

    const orderReview = await service.reviewProposedOrders(
      tenantDb,
      session.id,
      [
        { name: 'Clopidogrel', type: 'medication' },
        { name: 'Urgent ECG and troponin review', type: 'diagnostic_review' },
      ],
      'user-600',
    );

    const followup = await service.generateResultFollowupTasks(tenantDb, session.id, 'user-600');
    const hydrated = await service.getSessionById(tenantDb, session.id);

    expect(session.specialtyContributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: 'cardiology' }),
        expect.objectContaining({ module: 'emergency_sepsis' }),
      ]),
    );
    expect(session.pathwayRecommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathwayName: 'Acute Coronary Syndrome Pathway' }),
        expect.objectContaining({ pathwayName: 'Sepsis Response Pathway' }),
      ]),
    );
    expect(orderReview.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          proposedOrderName: 'Clopidogrel',
          appropriatenessStatus: 'needs_context',
        }),
        expect.objectContaining({
          proposedOrderName: 'Urgent ECG and troponin review',
        }),
      ]),
    );
    expect(followup.createdCount).toBe(2);
    expect(followup.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'critical_result_alert' }),
        expect.objectContaining({ sourceType: 'radiology_ai_finding' }),
      ]),
    );
    expect(hydrated.treatmentPathways).toHaveLength(2);
    expect(hydrated.resultFollowupTasks).toHaveLength(2);
    expect(hydrated.resultFollowupTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskType: 'lab_result_followup' }),
        expect.objectContaining({ taskType: 'imaging_result_followup' }),
      ]),
    );
  });
});
