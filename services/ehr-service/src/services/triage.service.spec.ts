import { TriageService } from './triage.service';

describe('TriageService', () => {
  it('creates a clinical escalation task for urgent triage assessments', async () => {
    const savedEscalations: any[] = [];
    const savedTasks: any[] = [];
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'triage-1',
          patient_id: 'patient-1',
          chief_complaint: 'Chest pain',
          chief_complaint_snomed_code: null,
          chief_complaint_snomed_term: null,
          priority: 'urgent',
          severity_score: 9,
          pain_score: 8,
        },
      ]),
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity.name === 'ClinicalEscalationTask') {
          return {
            create: jest.fn().mockImplementation((payload) => payload),
            save: jest.fn().mockImplementation(async (payload) => {
              const row = payload.id
                ? payload
                : { id: `esc-${savedEscalations.length + 1}`, ...payload };
              savedEscalations.push(row);
              return row;
            }),
          };
        }
        return null;
      }),
    };

    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const allergyService = {
      replaceForPatient: jest.fn(),
    };
    const terminologyService = {
      validateConcept: jest.fn(),
    };
    const cdssHookService = {
      handleTriageAssessment: jest.fn().mockResolvedValue({}),
    };
    const nurseTaskService = {
      createTask: jest.fn().mockImplementation(async (payload) => {
        const row = { id: `nurse-task-${savedTasks.length + 1}`, ...payload };
        savedTasks.push(row);
        return row;
      }),
    };

    const service = new TriageService(
      tenantService as any,
      allergyService as any,
      terminologyService as any,
      cdssHookService as any,
      nurseTaskService as any,
      undefined,
    );

    const result: any = await service.recordAssessment(
      {
        patientId: 'patient-1',
        chiefComplaint: 'Chest pain',
        priority: 'urgent',
        severityScore: 9,
        painScore: 8,
        recordedBy: 'user-1',
      } as any,
      'kids-clinic',
    );

    expect(result.escalationTaskId).toBe('esc-1');
    expect(savedEscalations[0]).toEqual(
      expect.objectContaining({
        patientId: 'patient-1',
        sourceModule: 'triage',
        escalationType: 'triage_priority_review',
        severity: 'critical',
      }),
    );
    expect(nurseTaskService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        taskType: 'triage_priority_review',
        sourceType: 'clinical_escalation',
        sourceId: 'esc-1',
      }),
      tenantDb,
      'kids-clinic',
    );
  });
});
