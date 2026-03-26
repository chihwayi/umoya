import { InboxTriageService } from './inbox-triage.service';

describe('InboxTriageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes inbox triage through governed CdssService', async () => {
    const repo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({ id: 'inbox-1', ...value })),
    };
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue(repo),
    } as any;
    const inboxGateway = { pushToUser: jest.fn() };
    const cdssService = {
      triageInboxItem: jest.fn().mockResolvedValue({
        priority: 'urgent',
        priority_reason: 'Possible emergency keywords.',
        triage_score: 70,
        triage_model: 'inbox_triage_v2',
        due_by_hours: 2,
        draft_reply: 'Please come in now.',
      }),
    };

    const service = new InboxTriageService(inboxGateway as any, cdssService as any);
    const result = await service.triage(
      {
        userId: 'user-1',
        patientId: 'patient-1',
        sourceType: 'patient_message',
        sourceId: 'msg-1',
        title: 'Urgent',
        content: 'I have chest pain',
      },
      tenantDb,
    );

    expect(cdssService.triageInboxItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'patient_message',
        patientId: 'patient-1',
      }),
      undefined,
      tenantDb,
    );
    expect(result.aiPriority).toBe('urgent');
    expect(inboxGateway.pushToUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 'inbox-1' }));
  });
});
