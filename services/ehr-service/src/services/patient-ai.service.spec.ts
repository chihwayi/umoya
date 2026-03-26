import { PatientAiService } from './patient-ai.service';

describe('PatientAiService adherence chat governance', () => {
  it('routes adherence chat through governed CDSS service instead of direct vendor calls', async () => {
    const chatRows: any[] = [];
    const aiSessionRows: any[] = [];
    const escalationRows: any[] = [];
    const followupRows: any[] = [];
    const chatRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `chat-${chatRows.length + 1}`, ...value };
        chatRows.push(row);
        return row;
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
    const aiSessionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `ai-session-${aiSessionRows.length + 1}`, ...value };
        aiSessionRows.push(row);
        return row;
      }),
      find: jest.fn(async () => aiSessionRows),
    };
    const escalationRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `escalation-${escalationRows.length + 1}`, ...value };
        escalationRows.push(row);
        return row;
      }),
      find: jest.fn(async () => escalationRows),
    };
    const followupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `followup-${followupRows.length + 1}`, ...value };
        followupRows.push(row);
        return row;
      }),
      find: jest.fn(async () => followupRows),
      findOneBy: jest.fn(async ({ id }) => followupRows.find((row) => row.id === id) ?? null),
    };
    const tenantService = {
      getTenantDatabase: jest.fn(async () => ({
        getRepository: jest.fn((entity: any) => {
          switch (entity?.name) {
            case 'AdherenceChatLog':
              return chatRepo;
            case 'PatientAiSession':
              return aiSessionRepo;
            case 'PatientAiEscalation':
              return escalationRepo;
            case 'PatientFollowupOrchestration':
              return followupRepo;
            default:
              return chatRepo;
          }
        }),
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
    expect(chatRows).toHaveLength(2);
    expect(chatRows[0].messageRole).toBe('user');
    expect(chatRows[1].messageRole).toBe('assistant');
    expect(result.aiSessionId).toBe('ai-session-1');
    expect(result.followupOrchestration).toEqual(
      expect.objectContaining({
        id: 'followup-1',
        nonadherenceFlag: true,
        routeBackTarget: 'care_manager',
      }),
    );
    expect(escalationRows).toHaveLength(1);
    expect(hipaaAuditService.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(hipaaAuditService.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('records tenant-side prompt audit for symptom checker responses', async () => {
    const symptomRows: any[] = [];
    const aiSessionRows: any[] = [];
    const escalationRows: any[] = [];
    const followupRows: any[] = [];
    const symptomRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `symptom-${symptomRows.length + 1}`, ...value };
        symptomRows.push(row);
        return row;
      }),
    };
    const aiSessionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `ai-session-${aiSessionRows.length + 1}`, ...value };
        aiSessionRows.push(row);
        return row;
      }),
    };
    const escalationRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `escalation-${escalationRows.length + 1}`, ...value };
        escalationRows.push(row);
        return row;
      }),
    };
    const followupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `followup-${followupRows.length + 1}`, ...value };
        followupRows.push(row);
        return row;
      }),
    };
    const tenantDb = {
      getRepository: jest.fn((entity: any) => {
        switch (entity?.name) {
          case 'SymptomCheckerSession':
            return symptomRepo;
          case 'PatientAiSession':
            return aiSessionRepo;
          case 'PatientAiEscalation':
            return escalationRepo;
          case 'PatientFollowupOrchestration':
            return followupRepo;
          default:
            return symptomRepo;
        }
      }),
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
    expect(result.aiSessionId).toBe('ai-session-1');
    expect(result.escalation).toEqual(
      expect.objectContaining({
        id: 'escalation-1',
        routeTarget: 'doctor',
      }),
    );
    expect(result.followupOrchestration).toEqual(
      expect.objectContaining({
        id: 'followup-1',
        riskLevel: 'urgent',
      }),
    );
    expect(hipaaAuditService.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(hipaaAuditService.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('lists and updates persisted patient follow-up orchestration state', async () => {
    const followupRows: any[] = [
      {
        id: 'followup-1',
        patientId: 'patient-1',
        status: 'open',
        reminderState: 'pending',
        completedAt: null,
      },
    ];
    const followupRepo = {
      find: jest.fn(async () => followupRows),
      findOneBy: jest.fn(async ({ id }) => followupRows.find((row) => row.id === id) ?? null),
      save: jest.fn(async (value) => {
        const index = followupRows.findIndex((row) => row.id === value.id);
        if (index >= 0) {
          followupRows[index] = { ...followupRows[index], ...value };
          return followupRows[index];
        }
        followupRows.push(value);
        return value;
      }),
    };
    const tenantService = {
      getTenantDatabase: jest.fn(async () => ({
        getRepository: jest.fn((entity: any) => {
          if (entity?.name === 'PatientFollowupOrchestration') return followupRepo;
          return followupRepo;
        }),
      })),
    };
    const service = new PatientAiService(tenantService as any, {} as any, {} as any);

    const listed = await service.getPatientFollowupOrchestrations('kids-clinic', 'patient-1');
    const updated = await service.updateFollowupOrchestration('kids-clinic', 'followup-1', {
      status: 'completed',
      reminderState: 'sent',
    });

    expect(listed).toHaveLength(1);
    expect(updated).toEqual(
      expect.objectContaining({
        id: 'followup-1',
        status: 'completed',
        reminderState: 'sent',
      }),
    );
  });
});
