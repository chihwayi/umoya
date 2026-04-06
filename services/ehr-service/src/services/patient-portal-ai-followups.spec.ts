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

  it('builds a continuous patient AI companion timeline with next actions', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM patient_followup_orchestrations f')) {
        return [
          {
            id: 'followup-1',
            patientAiSessionId: 'session-1',
            triggerType: 'symptom_checker',
            riskLevel: 'urgent',
            status: 'open',
            reminderState: 'sent',
            nextAction: 'Book a clinician review',
            unresolvedQuestion: 'Has the chest discomfort improved?',
            routeBackTarget: 'doctor',
            dueAt: '2026-04-06T09:00:00.000Z',
            completedAt: null,
            createdAt: '2026-04-05T07:30:00.000Z',
            sessionType: 'symptom_check',
            guidanceSummary: 'Persistent chest discomfort should be reviewed.',
            latestReply: 'The discomfort is still present.',
            requiresClinicianFollowUp: true,
          },
        ];
      }

      if (sql.includes('FROM patient_ai_sessions')) {
        return [
          {
            id: 'session-1',
            sessionType: 'symptom_check',
            status: 'completed',
            urgency: 'urgent',
            guidanceSummary: 'Please arrange follow-up care within 24 hours.',
            latestMessage: 'I have chest discomfort.',
            latestReply: 'The discomfort is still present.',
            requiresClinicianFollowUp: true,
            createdAt: '2026-04-05T07:00:00.000Z',
          },
        ];
      }

      if (sql.includes('FROM patient_ai_escalations')) {
        return [
          {
            id: 'esc-1',
            sourceType: 'symptom_check',
            severity: 'urgent',
            status: 'open',
            routeTarget: 'doctor',
            triggerSummary: 'Chest discomfort persisted after self-care guidance.',
            recommendedAction: 'A nurse or doctor should review you today.',
            createdAt: '2026-04-05T08:00:00.000Z',
            resolvedAt: null,
          },
        ];
      }

      if (sql.includes('FROM telemedicine_consultations tc')) {
        return [
          {
            id: 'consult-1',
            status: 'scheduled',
            scheduledAt: '2026-04-06T10:00:00.000Z',
            scheduledEndAt: '2026-04-06T10:20:00.000Z',
            doctorId: 'doc-1',
            roomStatus: 'ready',
            patientJoinedAt: null,
            meetingUrl: 'https://telemed.example/room',
            reminderSentAt: '2026-04-05T09:00:00.000Z',
            doctorName: 'Dr Moyo',
          },
        ];
      }

      if (sql.includes('FROM post_visit_sessions s')) {
        return [
          {
            id: 'pv-1',
            status: 'published',
            sourceType: 'telemedicine',
            publishedAt: '2026-04-04T12:00:00.000Z',
            updatedAt: '2026-04-04T12:00:00.000Z',
            doctorName: 'Dr Moyo',
          },
        ];
      }

      if (sql.includes('FROM patient_notifications')) {
        return [
          {
            id: 'note-1',
            notificationType: 'appointment',
            title: 'Telemedicine reminder',
            message: 'Your telemedicine review is tomorrow at 10:00.',
            read: false,
            sentAt: '2026-04-05T09:30:00.000Z',
            expiresAt: null,
          },
        ];
      }

      return [];
    });

    const service = buildService(query);
    const result = await service.getPatientAiCompanion('patient-1', 'kids-clinic');

    expect(result.summary).toEqual(
      expect.objectContaining({
        activeFollowups: 1,
        unreadNotifications: 1,
        activeEscalations: 1,
        upcomingTelemedicine: 1,
      }),
    );

    expect(result.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'followup',
          title: 'Book a clinician review',
        }),
        expect.objectContaining({
          kind: 'telemedicine',
          actionTarget: 'PHTelemedicine',
        }),
      ]),
    );

    expect(result.timeline.map((item: any) => item.kind)).toEqual(
      expect.arrayContaining(['followup', 'symptom_check', 'escalation', 'telemedicine', 'post_visit', 'reminder']),
    );
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
