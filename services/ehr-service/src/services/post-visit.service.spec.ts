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

  it('lists post-visit sessions for clinician workspace with paging', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM post_visit_sessions s') && sql.includes('COUNT(*)::int AS total')) {
          return [{ total: 1 }];
        }
        if (sql.includes('FROM post_visit_sessions s') && sql.includes('LIMIT')) {
          return [
            {
              id: 'session-1',
              tenant_id: 'tenant-a',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              appointment_id: null,
              consultation_id: null,
              status: 'doctor_reviewed',
              source_type: 'telemedicine',
              language: 'en',
              started_at: '2026-03-06T08:00:00.000Z',
              completed_at: '2026-03-06T08:20:00.000Z',
              reviewed_at: '2026-03-06T08:25:00.000Z',
              reviewed_by: 'doctor-1',
              published_at: null,
              safety_level: null,
              risk_flags: {},
              meta: {},
              created_at: '2026-03-06T08:00:00.000Z',
              updated_at: '2026-03-06T08:25:00.000Z',
              patient_first_name: 'Jane',
              patient_last_name: 'Doe',
              patient_number: 'P-001',
              doctor_first_name: 'Ava',
              doctor_last_name: 'Nyathi',
              visit_summary_status: 'reviewed',
              recommendation_bundle_status: 'reviewed',
              transcript_segment_count: 12,
              companion_message_count: 2,
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.listSessions(tenantDb, {
      status: 'doctor_reviewed',
      limit: 10,
      offset: 0,
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toEqual(
      expect.objectContaining({
        id: 'session-1',
        status: 'doctor_reviewed',
        patient: expect.objectContaining({
          firstName: 'Jane',
          patientNumber: 'P-001',
        }),
        telemetry: expect.objectContaining({
          transcriptSegmentCount: 12,
        }),
      }),
    );
    expect(result.paging.total).toBe(1);
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

  it('flags low-confidence/unknown diarization segments for review during ingestion', async () => {
    process.env.FEATURE_POSTVISIT_DIARIZATION_REVIEW = 'true';
    process.env.POSTVISIT_DIARIZATION_MIN_CONFIDENCE = '0.7';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const generateDraftSpy = jest
        .spyOn(service, 'generateDraftArtifacts')
        .mockResolvedValue({ sessionId: 'session-1', artifacts: [] } as any);

      const insertCalls: any[] = [];
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [{ id: 'session-1', patient_id: 'patient-1', source_type: 'in_person', status: 'captured' }];
          }
          if (sql.includes('INSERT INTO post_visit_transcript_segments')) {
            insertCalls.push(params);
            return [];
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
                appointment_id: null,
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

      await service.ingestTranscriptionResult(
        tenantDb,
        'session-1',
        {
          text: 'Doctor: continue medication. Patient: not feeling better.',
          language: 'en',
          confidence: 0.9,
          segments: [
            { start: 0, end: 2, text: 'Doctor: continue medication.', speakerRole: 'doctor', confidence: 0.95 },
            { start: 2, end: 5, text: 'Patient: not feeling better.', speakerRole: 'unknown', confidence: 0.41 },
          ],
        },
        {
          tenantId: 'tenant-a',
          actorUserId: 'doctor-1',
        },
      );

      expect(insertCalls).toHaveLength(2);
      expect(insertCalls[0][8]).toBe('doctor');
      expect(insertCalls[0][10]).toBe('auto');
      expect(insertCalls[0][11]).toBe(false);
      expect(insertCalls[1][8]).toBe('unknown');
      expect(insertCalls[1][10]).toBe('unresolved');
      expect(insertCalls[1][11]).toBe(true);
      expect(generateDraftSpy).toHaveBeenCalled();
    } finally {
      delete process.env.FEATURE_POSTVISIT_DIARIZATION_REVIEW;
      delete process.env.POSTVISIT_DIARIZATION_MIN_CONFIDENCE;
    }
  });

  it('reassigns diarization segment and clears review requirement when speaker becomes known', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', source_type: 'in_person', status: 'draft_ready' }];
        }
        if (sql.includes('UPDATE post_visit_transcript_segments')) {
          return [
            {
              id: 'seg-1',
              session_id: 'session-1',
              speaker_role: params[2],
              speaker_label: 'Speaker A',
              speaker_assignment_status: 'reassigned',
              needs_review: false,
              reviewed_by: params[4],
              reviewed_at: '2026-03-06T12:00:00.000Z',
              diarization_confidence: 0.44,
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.reassignDiarizationSegment(
      tenantDb,
      'session-1',
      'seg-1',
      { speakerRole: 'doctor', speakerLabel: 'Speaker A', note: 'confirmed by doctor' },
      { actorUserId: 'doctor-1' },
    );

    expect(result.speakerRole).toBe('doctor');
    expect(result.speakerAssignmentStatus).toBe('reassigned');
    expect(result.needsReview).toBe(false);
    expect(result.reviewedBy).toBe('doctor-1');
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

  it('blocks publish when diarization review is enabled and unresolved segments remain', async () => {
    process.env.FEATURE_POSTVISIT_DIARIZATION_REVIEW = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);

      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                tenant_id: 'tenant-a',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                status: 'doctor_reviewed',
                source_type: 'in_person',
                language: 'en',
              },
            ];
          }
          if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type IN')) {
            return [
              { artifact_type: 'visit_summary', artifact_status: 'reviewed' },
              { artifact_type: 'recommendation_bundle', artifact_status: 'reviewed' },
            ];
          }
          if (sql.includes('COUNT(*)::int AS unresolved_count')) {
            return [{ unresolved_count: 3 }];
          }
          return [];
        }),
      } as any;

      await expect(
        service.publishSession(
          tenantDb,
          'session-1',
          { note: 'attempt publish' },
          { actorUserId: 'doctor-1', source: 'test' },
        ),
      ).rejects.toThrow('Publish blocked. 3 transcript segment(s) require diarization review before signoff.');
    } finally {
      delete process.env.FEATURE_POSTVISIT_DIARIZATION_REVIEW;
    }
  });

  it('blocks publish when citation-quality v2 is enabled and superseded citations are not acknowledged', async () => {
    process.env.FEATURE_POSTVISIT_CITATION_QUALITY_V2 = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                tenant_id: 'tenant-a',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                status: 'doctor_reviewed',
                source_type: 'in_person',
                language: 'en',
              },
            ];
          }
          if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type IN')) {
            return [
              { artifact_type: 'visit_summary', artifact_status: 'reviewed' },
              { artifact_type: 'recommendation_bundle', artifact_status: 'reviewed' },
            ];
          }
          if (sql.includes('FROM post_visit_rule_citations')) {
            return [
              {
                id: 'c6f2e0f5-5a0f-4117-b8cb-8e6c6c6e565f',
                rule_id: 'htn_followup_rule',
                guideline_id: 'who-htn-2019',
                citation_label: 'Old guidance',
                relevance_score: 0.8,
                is_superseded: true,
                doctor_acknowledged_superseded: false,
              },
            ];
          }
          return [];
        }),
      } as any;

      await expect(
        service.publishSession(
          tenantDb,
          'session-1',
          { note: 'attempt publish without superseded acknowledgement' },
          { actorUserId: 'doctor-1' },
        ),
      ).rejects.toThrow('Publish blocked. Superseded citation acknowledgement required for: c6f2e0f5-5a0f-4117-b8cb-8e6c6c6e565f');
    } finally {
      delete process.env.FEATURE_POSTVISIT_CITATION_QUALITY_V2;
    }
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

  it('builds FHIR projection bundle from doctor-reviewed post-visit artifacts', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              status: 'published',
              source_type: 'in_person',
              language: 'en',
              started_at: '2026-03-06T10:00:00.000Z',
              completed_at: '2026-03-06T10:20:00.000Z',
              reviewed_at: '2026-03-06T10:21:00.000Z',
              updated_at: '2026-03-06T10:25:00.000Z',
              created_at: '2026-03-06T10:00:00.000Z',
              published_at: '2026-03-06T10:30:00.000Z',
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
                  plain_language_summary: 'Blood pressure reviewed with follow-up plan.',
                  key_points: ['Continue medication', 'Follow-up in one week'],
                },
                created_at: '2026-03-06T10:22:00.000Z',
                updated_at: '2026-03-06T10:28:00.000Z',
              },
            ];
          }
          if (params[1] === 'recommendation_bundle') {
            return [
              {
                id: 'artifact-rec-1',
                artifact_status: 'published',
                content: {
                  items: [
                    {
                      id: 'repeat_bp_followup',
                      title: 'Repeat blood pressure review',
                      description: 'Schedule a one-week follow-up blood pressure review.',
                      action_type: 'follow_up',
                      urgency: 'urgent',
                    },
                  ],
                },
              },
            ];
          }
        }
        if (sql.includes('FROM post_visit_action_executions')) {
          return [
            {
              recommendation_id: 'repeat_bp_followup',
              action_type: 'follow_up',
              status: 'executed',
              result_resource_type: 'order',
              result_resource_id: 'order-1',
              result_payload: { id: 'order-1' },
              executed_by: 'doctor-1',
              executed_at: '2026-03-06T10:35:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM post_visit_rule_citations')) {
          return [
            {
              recommendation_id: 'repeat_bp_followup',
              rule_id: 'hypertension.followup_interval',
              guideline_id: 'who-htn-2025',
              citation_label: 'WHO hypertension follow-up window',
              citation_source: 'WHO',
              citation_url: 'https://example.org/who-htn',
              confidence: 0.93,
            },
          ];
        }
        if (sql.includes('FROM patients') && sql.includes('WHERE id = $1')) {
          return [{ id: 'patient-1', first_name: 'Jane', last_name: 'Doe', patient_number: 'P-123' }];
        }
        if (sql.includes('FROM users') && sql.includes('WHERE id = $1')) {
          return [{ id: 'doctor-1', first_name: 'Sam', last_name: 'Doctor' }];
        }
        if (sql.includes('FROM post_visit_companion_acknowledgements')) {
          return [
            {
              acknowledgement_type: 'teach_back',
              acknowledged: true,
              details: { understood: true },
              created_at: '2026-03-06T10:40:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.getSessionFhirProjection(tenantDb, 'session-1');
    expect(result.exportVersion).toBe('post-visit-fhir-r4.v1');
    expect(result.bundle.resourceType).toBe('Bundle');
    expect(result.stats.recommendationTaskCount).toBe(1);
    expect(result.stats.executedServiceRequestCount).toBe(1);
  });

  it('builds versioned post-visit mobile contract payload', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              status: 'doctor_reviewed',
              source_type: 'in_person',
              language: 'en',
              reviewed_at: '2026-03-06T11:00:00.000Z',
              published_at: null,
              updated_at: '2026-03-06T11:05:00.000Z',
              created_at: '2026-03-06T10:00:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
          if (params[1] === 'visit_summary') {
            return [
              {
                id: 'artifact-summary-1',
                artifact_status: 'reviewed',
                content: {
                  plain_language_summary: 'Summary reviewed and ready.',
                  key_points: ['Key point 1'],
                },
              },
            ];
          }
          if (params[1] === 'recommendation_bundle') {
            return [
              {
                id: 'artifact-rec-1',
                content: {
                  items: [
                    {
                      id: 'confirm_medication_plan',
                      title: 'Confirm medication plan',
                      description: 'Reinforce daily adherence.',
                      action_type: 'medication',
                      urgency: 'routine',
                    },
                  ],
                },
              },
            ];
          }
        }
        if (sql.includes('FROM post_visit_action_executions')) {
          return [
            {
              recommendation_id: 'confirm_medication_plan',
              status: 'executed',
              action_type: 'medication',
              executed_at: '2026-03-06T11:10:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM post_visit_escalation_events')) {
          return [{ total: 2, active_count: 1, high_priority_active_count: 1 }];
        }
        return [];
      }),
    } as any;

    const result = await service.getSessionMobileContract(tenantDb, 'session-1', { version: 'v1' });
    expect(result.contractVersion).toBe('post-visit-mobile.v1');
    expect(result.checklist).toHaveLength(1);
    expect(result.cards.find((card: any) => card.id === 'post_visit_escalations')?.metadata?.active).toBe(1);
  });

  it('builds versioned mobile events feed with publish/execution/escalation events', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              reviewed_by: 'doctor-1',
              status: 'published',
              source_type: 'in_person',
              language: 'en',
              published_at: '2026-03-06T12:00:00.000Z',
              updated_at: '2026-03-06T12:05:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM post_visit_review_actions')) {
          return [
            {
              id: 'review-1',
              action: 'accept',
              artifact_type: 'visit_summary',
              review_reason: 'Approved',
              reviewed_by: 'doctor-1',
              created_at: '2026-03-06T11:45:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM post_visit_action_executions')) {
          return [
            {
              id: 'exec-1',
              recommendation_id: 'repeat_bp_followup',
              action_type: 'follow_up',
              status: 'executed',
              error_message: null,
              executed_by: 'doctor-1',
              executed_at: '2026-03-06T12:10:00.000Z',
            },
          ];
        }
        if (sql.includes('FROM post_visit_escalation_events')) {
          return [
            {
              id: 'esc-1',
              status: 'resolved',
              severity: 'high',
              route_target: 'doctor',
              trigger_type: 'symptom_keyword',
              trigger_terms: ['chest pain'],
              detected_at: '2026-03-06T12:20:00.000Z',
              resolved_at: '2026-03-06T12:35:00.000Z',
              resolved_by: 'doctor-1',
            },
          ];
        }
        if (sql.includes('FROM post_visit_companion_acknowledgements')) {
          return [
            {
              id: 'ack-1',
              acknowledgement_type: 'teach_back',
              acknowledged: true,
              details: { understood: true },
              created_by: 'patient-1',
              created_at: '2026-03-06T12:40:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.listSessionMobileEvents(tenantDb, 'session-1', {
      version: 'v1',
      limit: 20,
      offset: 0,
    });

    expect(result.contractVersion).toBe('post-visit-mobile-events.v1');
    expect(result.events.some((event: any) => event.eventType === 'post_visit.session.published')).toBe(true);
    expect(result.events.some((event: any) => event.eventType === 'post_visit.recommendation.executed')).toBe(true);
    expect(result.events.some((event: any) => event.eventType === 'post_visit.escalation.resolved')).toBe(true);
    expect(result.events.some((event: any) => event.eventType === 'post_visit.patient.acknowledged')).toBe(true);
  });

  it('classifies historical high-risk message as suppressed when escalation confidence v2 is enabled', async () => {
    const originalFlag = process.env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE;
    process.env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE = 'true';
    const groundedLlmServiceMock = {
      polishDoctorContent: jest.fn(),
      answerPatientQuestion: jest.fn(),
      classifyEscalationSignal: jest.fn(async () => ({
        severity: 'critical',
        routeTarget: 'emergency',
        temporality: 'historical',
        confidence: 0.96,
        rationale: 'Symptoms described as last week, not current.',
        model: 'gpt-4o-mini',
      })),
    };

    try {
      const service = new PostVisitService(
        transcriptionServiceMock as any,
        patientServiceMock as any,
        undefined,
        undefined,
        undefined,
        groundedLlmServiceMock as any,
      );
      const tenantDb = {
        query: jest.fn(async () => []),
      } as any;

      const result = await service.classifyEscalation(tenantDb, {
        message: 'I had chest pain last week but feel better now',
        sessionId: '0f089143-703e-4cf4-89dc-36fef2f5f1ff',
      });

      expect(result.classification.detected).toBe(false);
      expect(result.classification.temporality).toBe('historical');
      expect(result.classification.suppressedReason).toBe('historical_signal');
      expect(result.classification.routeTarget).toBe('doctor');
    } finally {
      if (typeof originalFlag === 'string') {
        process.env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE = originalFlag;
      } else {
        delete process.env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE;
      }
    }
  });

  it('applies grounded LLM polish to doctor summary/recommendation bundle when available', async () => {
    const hipaaAuditServiceMock = {
      registerModelEntry: jest.fn(async () => undefined),
      logPromptAudit: jest.fn(async () => undefined),
    };
    const groundedLlmServiceMock = {
      polishDoctorContent: jest.fn(async () => ({
        plainLanguageSummary: 'Polished grounded summary.',
        keyPoints: ['Polished point 1', 'Polished point 2'],
        summaryText: 'Polished summary text.',
        recommendationRewrites: [
          {
            recommendationId: 'htn_followup',
            title: 'Polished HTN follow-up',
            description: 'Polished recommendation description.',
          },
        ],
        citationsUsed: ['htn_followup_rule-1'],
        model: 'gpt-4o-mini',
        audit: {
          promptHash: 'prompt-hash-polish',
          templateVersion: 'postvisit-grounded-v1',
          inputTokenCount: 120,
          outputTokenCount: 45,
          latencyMs: 220,
          safetyGateTriggered: false,
        },
      })),
      answerPatientQuestion: jest.fn(),
    };
    const service = new PostVisitService(
      transcriptionServiceMock as any,
      patientServiceMock as any,
      undefined,
      undefined,
      undefined,
      groundedLlmServiceMock as any,
      hipaaAuditServiceMock as any,
    );
    patientServiceMock.getPatientContext.mockResolvedValue({
      patient: { id: 'patient-1', fullName: 'Jane Doe' },
      latestVitals: { blood_pressure: '150/95' },
      modules: {},
    });

    const artifactWrites: any[] = [];
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', source_type: 'in_person', status: 'draft_ready' }];
        }
        if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
          if (params[1] === 'soap_note') {
            return [
              {
                id: 'soap-1',
                content: {
                  soap_note: {
                    subjective: 'headache',
                    objective: 'BP 150/95',
                    assessment: 'possible hypertension',
                    plan: 'follow-up in 7 days',
                  },
                },
              },
            ];
          }
          return [];
        }
        if (sql.includes('FROM post_visit_extracted_entities')) {
          return [{ entity_type: 'vital_blood_pressure', entity_value: '150/95' }];
        }
        if (sql.includes('FROM post_visit_action_executions')) {
          return [];
        }
        if (sql.includes('INSERT INTO post_visit_draft_artifacts')) {
          artifactWrites.push({
            artifactType: params[1],
            content: JSON.parse(String(params[3] || '{}')),
          });
          return [{ id: `artifact-${params[1]}` }];
        }
        return [];
      }),
    } as any;

    await service.generateDraftArtifacts(tenantDb, 'session-1', { actorUserId: 'doctor-1' });

    const summaryWrite = artifactWrites.find((entry) => entry.artifactType === 'visit_summary');
    const recommendationWrite = artifactWrites.find((entry) => entry.artifactType === 'recommendation_bundle');
    expect(summaryWrite.content.plain_language_summary).toBe('Polished grounded summary.');
    expect(recommendationWrite.content.items[0].title).toBe('Polished HTN follow-up');
    expect(recommendationWrite.content.grounded_llm).toEqual(
      expect.objectContaining({
        enabled: true,
        model: 'gpt-4o-mini',
      }),
    );
    expect(groundedLlmServiceMock.polishDoctorContent).toHaveBeenCalled();
    expect(hipaaAuditServiceMock.registerModelEntry).toHaveBeenCalled();
    expect(hipaaAuditServiceMock.logPromptAudit).toHaveBeenCalled();
  });

  it('uses grounded LLM answer for patient companion when citation-safe output is returned', async () => {
    const hipaaAuditServiceMock = {
      registerModelEntry: jest.fn(async () => undefined),
      logPromptAudit: jest.fn(async () => undefined),
    };
    const groundedLlmServiceMock = {
      polishDoctorContent: jest.fn(),
      answerPatientQuestion: jest.fn(async () => ({
        answer: 'Grounded LLM answer for the patient.',
        citationsUsed: ['hiv_followup_continuity_rule-1'],
        model: 'gpt-4o-mini',
        abstained: false,
        urgentSignal: false,
        audit: {
          promptHash: 'prompt-hash-answer',
          templateVersion: 'postvisit-grounded-v1',
          inputTokenCount: 80,
          outputTokenCount: 32,
          latencyMs: 145,
          safetyGateTriggered: false,
        },
      })),
    };
    const service = new PostVisitService(
      transcriptionServiceMock as any,
      patientServiceMock as any,
      undefined,
      undefined,
      undefined,
      groundedLlmServiceMock as any,
      hipaaAuditServiceMock as any,
    );

    let messageInsertCount = 0;
    let assistantMetadata: any = null;
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
                content: { plain_language_summary: 'Doctor-approved summary.' },
                session_id: 'session-1',
              },
            ];
          }
          if (params[1] === 'recommendation_bundle') {
            return [
              {
                id: 'artifact-rec-1',
                artifact_status: 'published',
                content: {
                  items: [
                    {
                      id: 'hiv_followup_continuity',
                      title: 'HIV continuity follow-up scheduling',
                      citations: [
                        {
                          citation_id: 'hiv_followup_continuity_rule-1',
                          guideline_id: 'who-hiv-care-followup-2024',
                          label: 'WHO HIV care and treatment clinical follow-up guidance',
                          source: 'WHO HIV Guidelines',
                        },
                      ],
                    },
                  ],
                },
                session_id: 'session-1',
              },
            ];
          }
        }
        if (sql.includes('INSERT INTO post_visit_companion_threads')) {
          return [{ id: 'thread-1', status: 'active', message_count: 0 }];
        }
        if (sql.includes('INSERT INTO post_visit_companion_messages')) {
          messageInsertCount += 1;
          if (messageInsertCount === 1) {
            return [
              {
                id: 'msg-patient-1',
                message_text: 'Can you explain my follow-up?',
                message_type: 'question',
                escalation_detected: false,
                escalation_event_id: null,
                created_at: '2026-03-06T12:00:00.000Z',
              },
            ];
          }
          assistantMetadata = JSON.parse(String(params[8] || '{}'));
          return [
            {
              id: 'msg-assistant-1',
              message_text: 'Grounded LLM answer for the patient.',
              message_type: 'answer',
              created_at: '2026-03-06T12:00:05.000Z',
            },
          ];
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
      { message: 'Can you explain my follow-up?' },
    );

    expect(result.assistantMessage.message).toBe('Grounded LLM answer for the patient.');
    expect(assistantMetadata).toEqual(
      expect.objectContaining({
        answer_engine: 'llm',
        llm_model: 'gpt-4o-mini',
        grounded_citation_ids: ['hiv_followup_continuity_rule-1'],
      }),
    );
    expect(groundedLlmServiceMock.answerPatientQuestion).toHaveBeenCalled();
    expect(hipaaAuditServiceMock.registerModelEntry).toHaveBeenCalled();
    expect(hipaaAuditServiceMock.logPromptAudit).toHaveBeenCalled();
  });
});
