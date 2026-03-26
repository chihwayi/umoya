import { NotFoundException } from '@nestjs/common';
import { PatientPortalService } from './patient-portal.service';

describe('PatientPortalService patient AI follow-ups', () => {
  const buildService = (queryImpl: jest.Mock) => {
    const tenantService = {
      getTenantDatabase: jest.fn(async () => ({
        query: queryImpl,
      })),
    };

    return new PatientPortalService(tenantService as any, {} as any, {} as any);
  };

  it('lists patient AI follow-ups with session context', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM patient_followup_orchestrations f')) {
        return [
          {
            id: 'followup-1',
            patientAiSessionId: 'session-1',
            triggerType: 'post_visit_companion_message',
            riskLevel: 'urgent',
            status: 'open',
            reminderState: 'sent',
            nextAction: 'Call the clinic within 24 hours',
            unresolvedQuestion: 'Did your dizziness improve after discharge?',
            nonadherenceFlag: false,
            missedFollowupFlag: true,
            routeBackTarget: 'nurse',
            dueAt: '2026-03-27T09:00:00.000Z',
            lastTouchedAt: '2026-03-26T09:00:00.000Z',
            completedAt: null,
            payload: { source: 'post_visit' },
            createdAt: '2026-03-26T08:00:00.000Z',
            sessionType: 'post_visit_companion',
            guidanceSummary: 'Monitor dizziness and contact the clinic if symptoms persist.',
            urgency: 'urgent',
            latestMessage: 'Please check in tomorrow morning.',
            latestReply: 'I still feel dizzy today.',
            requiresClinicianFollowUp: true,
          },
        ];
      }
      return [];
    });

    const service = buildService(query);
    const result = await service.getPatientAiFollowups('patient-1', 'kids-clinic');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'followup-1',
        nextAction: 'Call the clinic within 24 hours',
        session: expect.objectContaining({
          type: 'post_visit_companion',
          requiresClinicianFollowUp: true,
        }),
      }),
    ]);
  });

  it('updates a patient AI follow-up only when it belongs to the authenticated patient', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM patient_followup_orchestrations')) {
        return [
          {
            id: 'followup-1',
            patient_id: 'patient-1',
            status: 'open',
            reminder_state: 'sent',
          },
        ];
      }

      if (sql.includes('UPDATE patient_followup_orchestrations')) {
        return [
          {
            id: 'followup-1',
            patientAiSessionId: 'session-1',
            triggerType: 'symptom_checker',
            riskLevel: 'urgent',
            status: 'completed',
            reminderState: 'acknowledged',
            nextAction: 'Seek same-day care',
            unresolvedQuestion: null,
            nonadherenceFlag: false,
            missedFollowupFlag: false,
            routeBackTarget: 'care_manager',
            dueAt: '2026-03-27T09:00:00.000Z',
            lastTouchedAt: '2026-03-26T10:00:00.000Z',
            completedAt: '2026-03-26T10:00:00.000Z',
            payload: { patientPortalLastActionStatus: 'completed' },
            createdAt: '2026-03-26T08:00:00.000Z',
          },
        ];
      }

      return [];
    });

    const service = buildService(query);
    const result = await service.updatePatientAiFollowup('patient-1', 'kids-clinic', 'followup-1', {
      status: 'completed',
      reminderState: 'acknowledged',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'followup-1',
        status: 'completed',
        reminderState: 'acknowledged',
      }),
    );
  });

  it('rejects updates for non-owned AI follow-ups', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM patient_followup_orchestrations')) {
        return [];
      }
      return [];
    });

    const service = buildService(query);

    await expect(
      service.updatePatientAiFollowup('patient-1', 'kids-clinic', 'followup-missing', {
        status: 'completed',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
