import { PatientAiService } from './patient-ai.service';

describe('PatientAiService adherence chat governance', () => {
  it('routes adherence chat through governed CDSS service instead of direct vendor calls', async () => {
    const savedRows: any[] = [];
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        savedRows.push(value);
        return value;
      }),
      find: jest.fn(async () => [
        {
          patientId: 'patient-1',
          sessionId: 'session-1',
          messageRole: 'user',
          message: 'I forgot two doses',
          createdAt: new Date('2026-03-24T10:00:00Z'),
        },
      ]),
    };
    const tenantService = {
      getTenantDatabase: jest.fn(async () => ({
        getRepository: jest.fn(() => repo),
      })),
    };
    const cdssService = {
      patientAdherenceAssist: jest.fn(async () => ({
        reply: 'Please resume your medication as prescribed and contact your clinic if you continue missing doses.',
        intent: 'adherence_check',
        adherenceConcern: true,
        requiresClinicianFollowUp: false,
        urgency: 'routine',
        confidence: 0.9,
        model: 'patient_adherence_rules_v1',
        abstained: false,
        abstainReason: null,
        governance: { governed_path: true },
      })),
    };
    const hipaaAuditService = {
      registerModelEntry: jest.fn(async () => undefined),
      logPromptAudit: jest.fn(async () => undefined),
    };

    const service = new PatientAiService(tenantService as any, cdssService as any, hipaaAuditService as any);

    const result = await service.adherenceChat('kids-clinic', {
      patientId: 'patient-1',
      sessionId: 'session-1',
      message: 'I forgot two doses',
      medications: ['Metformin'],
    });

    expect(cdssService.patientAdherenceAssist).toHaveBeenCalledWith(
      {
        patientId: 'patient-1',
        sessionId: 'session-1',
        message: 'I forgot two doses',
        medications: ['Metformin'],
        history: [{ role: 'user', content: 'I forgot two doses' }],
      },
      'kids-clinic',
    );
    expect(result.model).toBe('patient_adherence_rules_v1');
    expect(result.adherenceConcern).toBe(true);
    expect(result.governance).toEqual({ governed_path: true });
    expect(savedRows).toHaveLength(2);
    expect(savedRows[0].messageRole).toBe('user');
    expect(savedRows[1].messageRole).toBe('assistant');
    expect(hipaaAuditService.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(hipaaAuditService.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('records tenant-side prompt audit for symptom checker responses', async () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const tenantDb = {
      getRepository: jest.fn(() => repo),
    };
    const tenantService = {
      getTenantDatabase: jest.fn(async () => tenantDb),
    };
    const cdssService = {
      patientSymptomCheck: jest.fn(async () => ({
        differential: [{ condition: 'Malaria', probability: 0.82, urgency: 'urgent', nextStep: 'Seek same-day care' }],
        triageLevel: 'urgent',
        recommendedAction: 'Seek same-day care',
        confidence: 0.82,
        model: 'symptom_check_rules_v1',
        abstained: false,
        abstainReason: null,
        governance: { governed_path: true },
      })),
    };
    const hipaaAuditService = {
      registerModelEntry: jest.fn(async () => undefined),
      logPromptAudit: jest.fn(async () => undefined),
    };

    const service = new PatientAiService(tenantService as any, cdssService as any, hipaaAuditService as any);

    const result = await service.checkSymptoms('kids-clinic', {
      patientId: 'patient-1',
      symptoms: ['fever', 'headache'],
      durationDays: 3,
      severity: 'moderate',
      context: { age: 12, gender: 'female' },
    });

    expect(cdssService.patientSymptomCheck).toHaveBeenCalledWith(
      {
        symptoms: ['fever', 'headache'],
        durationDays: 3,
        severity: 'moderate',
        patientContext: { age: 12, gender: 'female' },
      },
      'kids-clinic',
    );
    expect(result.triageLevel).toBe('urgent');
    expect(hipaaAuditService.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(hipaaAuditService.logPromptAudit).toHaveBeenCalledTimes(1);
  });
});
