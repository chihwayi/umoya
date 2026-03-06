import { PostVisitService } from './post-visit.service';

describe('PostVisitService', () => {
  const transcriptionServiceMock = {
    transcribe: jest.fn(),
    formatTranscription: jest.fn(),
  };

  const patientServiceMock = {
    getPatientContext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a post-visit session linked to patient context', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT id FROM patients')) {
          return [{ id: 'patient-1' }];
        }
        if (sql.includes('INSERT INTO post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              tenant_id: 'tenant-a',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              appointment_id: 'appt-1',
              consultation_id: null,
              status: 'captured',
              source_type: 'in_person',
              language: 'en',
              started_at: null,
              completed_at: null,
              reviewed_at: null,
              reviewed_by: null,
              published_at: null,
              safety_level: null,
              risk_flags: {},
              meta: {},
              created_at: '2026-03-05T08:00:00.000Z',
              updated_at: '2026-03-05T08:00:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.createSession(
      tenantDb,
      {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        appointmentId: 'appt-1',
      },
      {
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'session-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        status: 'captured',
      }),
    );
  });

  it('persists transcript segments and triggers draft generation after ingestion', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const generateDraftSpy = jest
      .spyOn(service, 'generateDraftArtifacts')
      .mockResolvedValue({ sessionId: 'session-1', artifacts: [] } as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', source_type: 'in_person', status: 'captured' }];
        }
        if (sql.includes('INSERT INTO post_visit_draft_artifacts') && sql.includes("VALUES ($1,$2,$3")) {
          return [{ id: 'artifact-soap-1' }];
        }
        if (sql.includes('UPDATE post_visit_sessions') && sql.includes('RETURNING *')) {
          return [
            {
              id: 'session-1',
              tenant_id: 'tenant-a',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              appointment_id: 'appt-1',
              consultation_id: null,
              status: 'draft_ready',
              source_type: 'in_person',
              language: 'en',
              started_at: null,
              completed_at: '2026-03-05T08:02:00.000Z',
              reviewed_at: null,
              reviewed_by: null,
              published_at: null,
              safety_level: null,
              risk_flags: {},
              meta: {},
              created_at: '2026-03-05T08:00:00.000Z',
              updated_at: '2026-03-05T08:02:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.ingestTranscriptionResult(
      tenantDb,
      'session-1',
      {
        text: 'Patient reports chest pain. BP 150/95. Heart rate 110.',
        language: 'en',
        confidence: 0.9,
        segments: [
          { start: 0, end: 1.5, text: 'Patient reports chest pain.' },
          { start: 1.6, end: 3.2, text: 'BP 150/95. Heart rate 110.' },
        ],
        soap_note: {
          subjective: 'chest pain',
          objective: 'BP elevated',
          assessment: 'possible ACS',
          plan: 'ECG and troponin',
        },
      },
      {
        tenantId: 'tenant-a',
        actorUserId: 'doctor-1',
      },
    );

    expect(result.session.status).toBe('draft_ready');
    expect(result.transcript.segmentCount).toBe(2);
    expect(result.draft.artifactType).toBe('soap_note');
    expect(generateDraftSpy).toHaveBeenCalledWith(
      tenantDb,
      'session-1',
      expect.objectContaining({
        reason: 'auto_generate_after_transcription',
      }),
    );
  });

  it('generates recommendation bundle with per-rule citations from patient context', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    patientServiceMock.getPatientContext.mockResolvedValue({
      patient: { id: 'patient-1', fullName: 'Jane Doe' },
      latestVitals: { blood_pressure: '150/95' },
      modules: {
        hiv: {
          latestEnrollment: { id: 'hiv-enroll-1' },
          latestClinicalVisit: { next_review_date: '2026-04-01' },
        },
        lab: {
          latestCriticalAlert: {
            id: 'lab-alert-1',
            component_name: 'Potassium',
            severity: 'critical',
            alert_status: 'pending',
          },
        },
      },
    });

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              source_type: 'in_person',
              status: 'draft_ready',
            },
          ];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes("artifact_type = $2")) {
          return [
            {
              id: 'soap-1',
              content: {
                soap_note: {
                  subjective: 'chest pain',
                  objective: 'BP elevated',
                  assessment: 'possible ACS',
                  plan: 'ECG and troponin',
                },
              },
            },
          ];
        }
        if (sql.includes('FROM post_visit_extracted_entities')) {
          return [{ entity_type: 'vital_blood_pressure', entity_value: '150/95' }];
        }
        if (sql.includes('INSERT INTO post_visit_draft_artifacts')) {
          return [{ id: 'artifact-1' }];
        }
        return [];
      }),
    } as any;

    const result = await service.generateDraftArtifacts(tenantDb, 'session-1', {
      actorUserId: 'doctor-1',
    });

    expect(patientServiceMock.getPatientContext).toHaveBeenCalledWith('patient-1', tenantDb);
    expect(result).toEqual(expect.objectContaining({ sessionId: 'session-1' }));

    const citationInsertCalls = tenantDb.query.mock.calls.filter((call: any[]) =>
      String(call[0]).includes('INSERT INTO post_visit_rule_citations'),
    );
    expect(citationInsertCalls.length).toBeGreaterThan(0);
  });

  it('records review action and marks artifact reviewed', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', status: 'draft_ready', source_type: 'in_person' }];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes("artifact_type = $2")) {
          return [{ id: 'artifact-1', content: { text: 'draft' }, citations: [], artifact_type: 'visit_summary' }];
        }
        if (sql.includes('UPDATE post_visit_draft_artifacts')) {
          return [
            {
              id: 'artifact-1',
              artifact_type: 'visit_summary',
              artifact_status: 'reviewed',
              content: { text: 'final' },
              citations: [],
              updated_at: '2026-03-05T10:00:00.000Z',
            },
          ];
        }
        if (sql.includes('INSERT INTO post_visit_review_actions')) {
          return [
            {
              id: 'review-1',
              action: 'edit',
              review_reason: 'clarified summary',
              review_metadata: {},
              reviewed_by: 'doctor-1',
              created_at: '2026-03-05T10:00:00.000Z',
            },
          ];
        }
        if (sql.includes('UPDATE post_visit_sessions') && sql.includes('reviewed_at')) {
          return [
            {
              id: 'session-1',
              tenant_id: 'tenant-a',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              appointment_id: null,
              consultation_id: null,
              status: 'doctor_reviewed',
              source_type: 'in_person',
              language: 'en',
              started_at: null,
              completed_at: null,
              reviewed_at: '2026-03-05T10:00:00.000Z',
              reviewed_by: 'doctor-1',
              published_at: null,
              safety_level: null,
              risk_flags: {},
              meta: {},
              created_at: '2026-03-05T09:00:00.000Z',
              updated_at: '2026-03-05T10:00:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.reviewDraftArtifact(
      tenantDb,
      'session-1',
      {
        artifactType: 'visit_summary',
        action: 'edit',
        editedContent: { text: 'final' },
        reason: 'clarified summary',
      },
      {
        actorUserId: 'doctor-1',
      },
    );

    expect(result.session.status).toBe('doctor_reviewed');
    expect(result.artifact.status).toBe('reviewed');
    expect(result.reviewAction.action).toBe('edit');
  });

  it('executes recommendation action and persists execution result idempotency state', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', appointment_id: null, source_type: 'in_person' }];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes("artifact_type = $2")) {
          return [
            {
              id: 'artifact-rec-1',
              content: {
                items: [
                  {
                    id: 'medication_adherence_reinforcement',
                    action_type: 'medication',
                    title: 'Medication adherence reinforcement',
                    description: 'Issue reminders',
                    urgency: 'routine',
                  },
                ],
              },
              citations: [],
              confidence: 0.8,
              artifact_status: 'draft',
            },
          ];
        }
        if (sql.includes('FROM post_visit_action_executions') && sql.includes('LIMIT 1')) {
          return [];
        }
        if (sql.includes('INSERT INTO orders')) {
          return [
            {
              id: 'order-1',
              order_type: 'medication',
              order_name: 'Medication adherence reinforcement',
              status: 'authorized',
              priority: 'normal',
              created_at: '2026-03-05T10:00:00.000Z',
            },
          ];
        }
        if (sql.includes('INSERT INTO post_visit_action_executions')) {
          return [
            {
              id: 'exec-1',
              recommendation_id: 'medication_adherence_reinforcement',
              action_key: 'medication:medication_adherence_reinforcement',
              action_type: 'medication',
              status: 'executed',
              result_resource_type: 'order',
              result_resource_id: 'order-1',
              result_payload: { id: 'order-1' },
              error_message: null,
              executed_at: '2026-03-05T10:00:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.executeRecommendationAction(
      tenantDb,
      'session-1',
      'medication_adherence_reinforcement',
      { note: 'Execute now' },
      {
        actorUserId: 'doctor-1',
        tenantId: 'tenant-a',
      },
    );

    expect(result.reused).toBe(false);
    expect(result.execution.status).toBe('executed');
    expect(result.execution.resultResourceType).toBe('order');
  });

  it('reuses existing execution when recommendation action was already executed', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', source_type: 'in_person' }];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes("artifact_type = $2")) {
          return [
            {
              id: 'artifact-rec-1',
              content: {
                items: [
                  {
                    id: 'htn_followup',
                    action_type: 'follow_up',
                    title: 'Elevated blood pressure follow-up',
                    urgency: 'urgent',
                  },
                ],
              },
            },
          ];
        }
        if (sql.includes('FROM post_visit_action_executions') && sql.includes('LIMIT 1')) {
          return [
            {
              id: 'exec-1',
              recommendation_id: 'htn_followup',
              action_key: 'follow_up:htn_followup',
              action_type: 'follow_up',
              status: 'executed',
              result_resource_type: 'order',
              result_resource_id: 'order-11',
              result_payload: { id: 'order-11' },
              error_message: null,
              executed_at: '2026-03-05T10:00:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.executeRecommendationAction(
      tenantDb,
      'session-1',
      'htn_followup',
      {},
      { actorUserId: 'doctor-1' },
    );

    expect(result.reused).toBe(true);
    expect(result.execution.resultResourceId).toBe('order-11');
  });

  it('publishes reviewed artifacts and initializes patient companion thread', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              tenant_id: 'tenant-a',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              appointment_id: null,
              consultation_id: null,
              status: 'doctor_reviewed',
              source_type: 'in_person',
              language: 'en',
              started_at: null,
              completed_at: null,
              reviewed_at: '2026-03-05T10:00:00.000Z',
              reviewed_by: 'doctor-1',
              published_at: null,
              safety_level: null,
              risk_flags: {},
              meta: {},
              created_at: '2026-03-05T09:00:00.000Z',
              updated_at: '2026-03-05T10:00:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type IN')) {
          return [
            { artifact_type: 'visit_summary', artifact_status: 'reviewed' },
            { artifact_type: 'recommendation_bundle', artifact_status: 'reviewed' },
          ];
        }
        if (sql.includes('UPDATE post_visit_draft_artifacts') && sql.includes("artifact_status = 'published'")) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_sessions') && sql.includes('published_at = NOW()')) {
          return [
            {
              id: 'session-1',
              tenant_id: 'tenant-a',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              appointment_id: null,
              consultation_id: null,
              status: 'published',
              source_type: 'in_person',
              language: 'en',
              started_at: null,
              completed_at: null,
              reviewed_at: '2026-03-05T10:00:00.000Z',
              reviewed_by: 'doctor-1',
              published_at: '2026-03-05T10:05:00.000Z',
              safety_level: null,
              risk_flags: {},
              meta: {},
              created_at: '2026-03-05T09:00:00.000Z',
              updated_at: '2026-03-05T10:05:00.000Z',
            },
          ];
        }
        if (sql.includes('INSERT INTO post_visit_companion_threads')) {
          return [
            {
              id: 'thread-1',
              status: 'active',
              message_count: 0,
              last_message_at: null,
            },
          ];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
          if (params[1] === 'visit_summary') {
            return [
              {
                id: 'artifact-summary-1',
                artifact_status: 'published',
                content: {
                  plain_language_summary: 'Your blood pressure was reviewed and follow-up is planned.',
                },
              },
            ];
          }
          if (params[1] === 'recommendation_bundle') {
            return [
              {
                id: 'artifact-rec-1',
                artifact_status: 'published',
                content: {
                  items: [{ title: 'Repeat blood pressure check in 7 days' }],
                },
              },
            ];
          }
        }
        if (sql.includes('FROM post_visit_companion_messages') && sql.includes("message_type = 'summary'")) {
          return [];
        }
        if (sql.includes('INSERT INTO post_visit_companion_messages')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_companion_threads')) {
          return [];
        }
        return [];
      }),
    } as any;

    const result = await service.publishSession(
      tenantDb,
      'session-1',
      { note: 'release to patient companion' },
      {
        actorUserId: 'doctor-1',
        source: 'test',
      },
    );

    expect(result.session.status).toBe('published');
    expect(result.companionThread.id).toBe('thread-1');
  });

  it('creates escalation event when patient companion message contains urgent symptoms', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    let companionInsertCount = 0;

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              status: 'published',
              source_type: 'in_person',
              language: 'en',
            },
          ];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
          if (params[1] === 'visit_summary') {
            return [
              {
                id: 'artifact-summary-1',
                artifact_status: 'published',
                content: {
                  plain_language_summary: 'Follow your blood pressure plan.',
                },
              },
            ];
          }
          if (params[1] === 'recommendation_bundle') {
            return [
              {
                id: 'artifact-rec-1',
                artifact_status: 'published',
                content: {
                  items: [{ title: 'Take medications as prescribed' }],
                },
              },
            ];
          }
        }
        if (sql.includes('INSERT INTO post_visit_companion_threads')) {
          return [{ id: 'thread-1', status: 'active', message_count: 0 }];
        }
        if (sql.includes('INSERT INTO post_visit_companion_messages')) {
          companionInsertCount += 1;
          if (companionInsertCount === 1) {
            return [
              {
                id: 'msg-patient-1',
                message_text: 'I have chest pain and difficulty breathing.',
                message_type: 'question',
                escalation_detected: false,
                escalation_event_id: null,
                created_at: '2026-03-05T11:00:00.000Z',
              },
            ];
          }
          return [
            {
              id: 'msg-assistant-1',
              message_text: 'Please call emergency services now.',
              message_type: 'alert',
              created_at: '2026-03-05T11:00:05.000Z',
            },
          ];
        }
        if (sql.includes('INSERT INTO post_visit_escalation_events')) {
          return [
            {
              id: 'esc-1',
              session_id: 'session-1',
              patient_id: 'patient-1',
              thread_id: 'thread-1',
              message_id: 'msg-patient-1',
              status: 'open',
              severity: 'critical',
              route_target: 'emergency',
              trigger_type: 'symptom_keyword',
              trigger_terms: ['chest pain', 'difficulty breathing'],
              signal_text: 'I have chest pain and difficulty breathing.',
              detected_at: '2026-03-05T11:00:01.000Z',
              sla_due_at: '2026-03-05T11:15:01.000Z',
              acknowledged_at: null,
              acknowledged_by: null,
              resolved_at: null,
              resolved_by: null,
              resolution_note: null,
              workflow_key: null,
              metadata: {},
              created_at: '2026-03-05T11:00:01.000Z',
              updated_at: '2026-03-05T11:00:01.000Z',
            },
          ];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes('SET workflow_key')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_companion_messages') && sql.includes('escalation_detected = TRUE')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_companion_threads')) {
          return [];
        }
        return [];
      }),
    } as any;

    const result = await service.sendCompanionMessage(
      tenantDb,
      'session-1',
      'patient-1',
      { message: 'I have chest pain and difficulty breathing.' },
    );

    expect(result.escalation).toEqual(expect.objectContaining({ id: 'esc-1', routeTarget: 'emergency' }));
    expect(result.patientMessage.escalationDetected).toBe(true);
    expect(result.assistantMessage.messageType).toBe('alert');
  });

  it('delivers patient and clinician alert channels when escalation is detected', async () => {
    const notificationsServiceMock = {
      sendSms: jest.fn(async () => undefined),
    };
    const emailServiceMock = {
      sendEmail: jest.fn(async () => undefined),
    };
    const patientNotificationsServiceMock = {
      createNotification: jest.fn(async () => ({ id: 'patient-notif-1' })),
    };
    const service = new PostVisitService(
      transcriptionServiceMock as any,
      patientServiceMock as any,
      notificationsServiceMock as any,
      emailServiceMock as any,
      patientNotificationsServiceMock as any,
    );
    let companionInsertCount = 0;

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              doctor_id: 'doctor-9',
              status: 'published',
              source_type: 'in_person',
              language: 'en',
            },
          ];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
          if (params[1] === 'visit_summary') {
            return [
              {
                id: 'artifact-summary-1',
                artifact_status: 'published',
                content: {
                  plain_language_summary: 'Follow your blood pressure plan.',
                },
              },
            ];
          }
          if (params[1] === 'recommendation_bundle') {
            return [
              {
                id: 'artifact-rec-1',
                artifact_status: 'published',
                content: {
                  items: [{ title: 'Take medications as prescribed' }],
                },
              },
            ];
          }
        }
        if (sql.includes('INSERT INTO post_visit_companion_threads')) {
          return [{ id: 'thread-1', status: 'active', message_count: 0 }];
        }
        if (sql.includes('INSERT INTO post_visit_companion_messages')) {
          companionInsertCount += 1;
          if (companionInsertCount === 1) {
            return [
              {
                id: 'msg-patient-1',
                message_text: 'I have chest pain and difficulty breathing.',
                message_type: 'question',
                escalation_detected: false,
                escalation_event_id: null,
                created_at: '2026-03-05T11:00:00.000Z',
              },
            ];
          }
          return [
            {
              id: 'msg-assistant-1',
              message_text: 'Please call emergency services now.',
              message_type: 'alert',
              created_at: '2026-03-05T11:00:05.000Z',
            },
          ];
        }
        if (sql.includes('INSERT INTO post_visit_escalation_events')) {
          return [
            {
              id: 'esc-1',
              session_id: 'session-1',
              patient_id: 'patient-1',
              thread_id: 'thread-1',
              message_id: 'msg-patient-1',
              status: 'open',
              severity: 'critical',
              route_target: 'emergency',
              trigger_type: 'symptom_keyword',
              trigger_terms: ['chest pain', 'difficulty breathing'],
              signal_text: 'I have chest pain and difficulty breathing.',
              detected_at: '2026-03-05T11:00:01.000Z',
              sla_due_at: '2026-03-05T11:15:01.000Z',
              acknowledged_at: null,
              acknowledged_by: null,
              resolved_at: null,
              resolved_by: null,
              resolution_note: null,
              workflow_key: null,
              metadata: {},
              created_at: '2026-03-05T11:00:01.000Z',
              updated_at: '2026-03-05T11:00:01.000Z',
            },
          ];
        }
        if (sql.includes('FROM patients') && sql.includes('WHERE id = $1')) {
          return [{ id: 'patient-1', first_name: 'Jane', last_name: 'Doe', phone: '+263700000001', email: 'jane@example.com' }];
        }
        if (sql.includes('FROM users') && sql.includes("role IN ('doctor','nurse','nurse_accounts')")) {
          return [{ id: 'doctor-9', first_name: 'Sam', last_name: 'Doc', phone: '+263700000002', email: 'doctor@example.com' }];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes('SET workflow_key')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes('SET metadata')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_companion_messages') && sql.includes('escalation_detected = TRUE')) {
          return [];
        }
        if (sql.includes('UPDATE post_visit_companion_threads')) {
          return [];
        }
        return [];
      }),
    } as any;

    const result = await service.sendCompanionMessage(
      tenantDb,
      'session-1',
      'patient-1',
      { message: 'I have chest pain and difficulty breathing.' },
      { tenantId: 'tenant-a' },
    );

    expect(result.escalation).toEqual(expect.objectContaining({ id: 'esc-1', routeTarget: 'emergency' }));
    expect(result.escalation?.metadata?.channel_delivery).toEqual(
      expect.objectContaining({
        patientInApp: true,
        patientSms: true,
        patientEmail: true,
        clinicianSms: true,
        clinicianEmail: true,
      }),
    );
    expect(patientNotificationsServiceMock.createNotification).toHaveBeenCalledWith(
      'patient-1',
      'system_alert',
      'Post-Visit Safety Alert',
      expect.any(String),
      'tenant-a',
      expect.any(Object),
    );
    expect(notificationsServiceMock.sendSms).toHaveBeenCalledTimes(2);
    expect(emailServiceMock.sendEmail).toHaveBeenCalledTimes(2);
  });
});
