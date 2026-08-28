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

  it('ingests post-visit document intelligence and emits structured extraction + FHIR payload', async () => {
    process.env.FEATURE_POSTVISIT_OCR_INTELLIGENCE = 'false';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                source_type: 'in_person',
                status: 'draft_ready',
                language: 'en',
                created_at: '2026-03-06T08:00:00.000Z',
                updated_at: '2026-03-06T08:00:00.000Z',
              },
            ];
          }
          if (sql.includes('FROM post_visit_document_intelligence') && sql.includes('ORDER BY created_at DESC')) {
            return [];
          }
          if (sql.includes('INSERT INTO post_visit_document_intelligence')) {
            return [
              {
                id: 'doc-intel-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                document_type: params[2],
                document_name: params[3],
                extraction_status: params[9],
                ocr_engine: params[10],
                ocr_confidence: params[11],
                created_at: '2026-03-06T08:01:00.000Z',
              },
            ];
          }
          if (sql.includes('UPDATE post_visit_sessions') && sql.includes('document_intelligence_last_ingested_at')) {
            return [];
          }
          return [];
        }),
      } as any;

      const file = {
        buffer: Buffer.from('Potassium: 4.8 mmol/L\nAmoxicillin 500 mg twice daily'),
        originalname: 'lab-report.txt',
        mimetype: 'text/plain',
        size: 64,
      } as Express.Multer.File;

      const result = await service.ingestDocumentIntelligence(
        tenantDb,
        'session-1',
        file,
        { documentType: 'lab_report', language: 'en' },
        { actorUserId: 'doctor-1', tenantId: 'tenant-a' },
      );

      expect(result.id).toBe('doc-intel-1');
      expect(result.duplicate).toBe(false);
      expect(result.structured.observations.length).toBeGreaterThan(0);
      expect(result.fhirResources.some((resource: any) => resource.resourceType === 'Observation')).toBe(true);
      expect(result.fhirResources.some((resource: any) => resource.resourceType === 'DiagnosticReport')).toBe(true);
      expect(result.criticalDetected).toBe(false);
    } finally {
      delete process.env.FEATURE_POSTVISIT_OCR_INTELLIGENCE;
    }
  });

  it('creates document-based escalation for critical extracted lab values', async () => {
    process.env.FEATURE_POSTVISIT_OCR_INTELLIGENCE = 'false';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                source_type: 'in_person',
                status: 'draft_ready',
                language: 'en',
                created_at: '2026-03-06T08:00:00.000Z',
                updated_at: '2026-03-06T08:00:00.000Z',
              },
            ];
          }
          if (sql.includes('FROM post_visit_document_intelligence') && sql.includes('ORDER BY created_at DESC')) {
            return [];
          }
          if (sql.includes('INSERT INTO post_visit_document_intelligence')) {
            return [
              {
                id: 'doc-intel-critical-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                document_type: params[2],
                document_name: params[3],
                extraction_status: params[9],
                ocr_engine: params[10],
                ocr_confidence: params[11],
                created_at: '2026-03-06T08:01:00.000Z',
              },
            ];
          }
          if (sql.includes('INSERT INTO post_visit_escalation_events')) {
            return [
              {
                id: 'esc-doc-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                status: 'open',
                severity: 'critical',
                route_target: 'doctor',
                trigger_type: 'document_critical_value',
                trigger_terms: ['Potassium critical'],
                detected_at: '2026-03-06T08:01:20.000Z',
                metadata: {},
                created_at: '2026-03-06T08:01:20.000Z',
                updated_at: '2026-03-06T08:01:20.000Z',
              },
            ];
          }
          if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
            return [];
          }
          if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes('SET workflow_key')) {
            return [];
          }
          if (sql.includes('UPDATE post_visit_document_intelligence') && sql.includes('critical_routed = TRUE')) {
            return [];
          }
          if (sql.includes('UPDATE post_visit_sessions') && sql.includes('document_intelligence_last_ingested_at')) {
            return [];
          }
          return [];
        }),
      } as any;

      const file = {
        buffer: Buffer.from('Potassium: 6.4 mmol/L'),
        originalname: 'critical-lab.txt',
        mimetype: 'text/plain',
        size: 20,
      } as Express.Multer.File;

      const result = await service.ingestDocumentIntelligence(
        tenantDb,
        'session-1',
        file,
        { documentType: 'lab_report', language: 'en' },
        { actorUserId: 'doctor-1', tenantId: 'tenant-a' },
      );

      expect(result.criticalDetected).toBe(true);
      expect(result.criticalFlags.length).toBeGreaterThan(0);
      expect(result.escalationEvent).toEqual(expect.objectContaining({ id: 'esc-doc-1', routeTarget: 'doctor' }));
    } finally {
      delete process.env.FEATURE_POSTVISIT_OCR_INTELLIGENCE;
    }
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

  it('adds medication intelligence v2 recommendation with high-risk signals when enabled', async () => {
    process.env.FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2 = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      patientServiceMock.getPatientContext.mockResolvedValue({
        patient: { id: 'patient-1', fullName: 'Jane Doe', age: 72 },
        latestVitals: {},
        modules: {
          pharmacy: {
            latestPrescription: { medication_name: 'Simvastatin', generic_name: 'simvastatin' },
            activePrescriptionCount: 1,
          },
          lab: {
            latestCriticalAlert: {
              id: 'lab-egfr-1',
              component_name: 'eGFR',
              result_value: '38',
              alert_status: 'pending',
              severity: 'high',
            },
          },
        },
      });

      const artifactWrites: any[] = [];
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
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
          if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
            if (params[1] === 'soap_note') {
              return [
                {
                  id: 'soap-1',
                  content: {
                    soap_note: {
                      subjective: 'myalgia',
                      objective: 'review meds',
                      assessment: 'possible drug interaction',
                      plan: 'medication reconciliation',
                    },
                  },
                },
              ];
            }
            return [];
          }
          if (sql.includes('FROM post_visit_extracted_entities')) {
            return [
              { entity_type: 'medication_mentioned', entity_value: 'Clarithromycin 500 mg twice daily' },
              { entity_type: 'lab_egfr', entity_value: 'eGFR 38' },
            ];
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

      await service.generateDraftArtifacts(tenantDb, 'session-1', {
        actorUserId: 'doctor-1',
      });

      const recommendationWrite = artifactWrites.find((entry) => entry.artifactType === 'recommendation_bundle');
      expect(recommendationWrite).toBeTruthy();
      const medicationSafetyItem = (recommendationWrite?.content?.items || []).find(
        (item: any) => String(item?.id) === 'medication_safety_intelligence_v2',
      );
      expect(medicationSafetyItem).toBeTruthy();
      expect(medicationSafetyItem.context.medicationIntelligence.highRiskCount).toBeGreaterThan(0);
      expect(medicationSafetyItem.context.medicationIntelligence.highestSeverity).toBe('major');
    } finally {
      delete process.env.FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2;
    }
  });

  it('generates multilingual teach-back summary fields when feature flag is enabled', async () => {
    process.env.FEATURE_POSTVISIT_MULTILINGUAL_TEACHBACK = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      patientServiceMock.getPatientContext.mockResolvedValue({
        patient: { id: 'patient-1', fullName: 'Jane Doe', age: 40 },
        latestVitals: {},
        modules: {},
      });

      const artifactWrites: any[] = [];
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                source_type: 'in_person',
                status: 'draft_ready',
                language: 'sn',
              },
            ];
          }
          if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
            if (params[1] === 'soap_note') {
              return [
                {
                  id: 'soap-1',
                  content: {
                    soap_note: {
                      subjective: 'headache and dizziness',
                      objective: 'blood pressure elevated',
                      assessment: 'hypertension follow-up',
                      plan: 'medication adherence and clinic review in 7 days',
                    },
                  },
                },
              ];
            }
            return [];
          }
          if (sql.includes('FROM post_visit_extracted_entities')) {
            return [];
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
      expect(summaryWrite).toBeTruthy();
      expect(summaryWrite.content.language).toBe('sn');
      expect(Array.isArray(summaryWrite.content.teach_back_questions)).toBe(true);
      expect(summaryWrite.content.teach_back_questions.length).toBeGreaterThan(0);
      expect(Array.isArray(summaryWrite.content.companion_topic_checklist)).toBe(true);
      expect(summaryWrite.content.companion_topic_checklist.length).toBeGreaterThan(0);
      expect(typeof summaryWrite.content.literacy_score).toBe('number');
    } finally {
      delete process.env.FEATURE_POSTVISIT_MULTILINGUAL_TEACHBACK;
    }
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

  it('returns post-visit billing intelligence suggestions with documentation summary', async () => {
    process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
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
          if (sql.includes('FROM post_visit_billing_suggestions')) {
            return [
              {
                id: 'bill-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                suggestion_key: 'cpt:99214',
                code_type: 'cpt',
                code: '99214',
                description: 'Established patient office/outpatient visit, moderate complexity',
                confidence: 0.89,
                justification: 'Draft supports moderate complexity.',
                documentation_checks: [
                  { id: 'subjective_documented', label: 'Subjective documented', passed: true, guidance: 'ok' },
                  { id: 'objective_documented', label: 'Objective documented', passed: false, guidance: 'Add objective findings.' },
                ],
                documentation_score: 72,
                documentation_status: 'partial',
                status: 'proposed',
                approved_by: null,
                approved_at: null,
                approval_note: null,
                source: 'post_visit_billing_intelligence_v1',
                metadata: { documentation: { gaps: ['Add objective findings.'] } },
                created_at: '2026-03-06T10:00:00.000Z',
                updated_at: '2026-03-06T10:00:00.000Z',
              },
              {
                id: 'bill-2',
                session_id: 'session-1',
                patient_id: 'patient-1',
                suggestion_key: 'icd10:I10',
                code_type: 'icd10',
                code: 'I10',
                description: 'Essential hypertension',
                confidence: 0.81,
                justification: 'Assessment indicates hypertension.',
                documentation_checks: [],
                documentation_score: 72,
                documentation_status: 'partial',
                status: 'approved',
                approved_by: 'doctor-1',
                approved_at: '2026-03-06T10:05:00.000Z',
                approval_note: 'Looks good',
                source: 'post_visit_billing_intelligence_v1',
                metadata: {},
                created_at: '2026-03-06T10:01:00.000Z',
                updated_at: '2026-03-06T10:05:00.000Z',
              },
            ];
          }
          return [];
        }),
      } as any;

      const result = await service.getSessionBillingIntelligence(tenantDb, 'session-1');
      expect(result.featureEnabled).toBe(true);
      expect(result.suggestions).toHaveLength(2);
      expect(result.documentation).toEqual(
        expect.objectContaining({
          score: 72,
          status: 'partial',
        }),
      );
      expect(result.summary).toEqual(
        expect.objectContaining({
          total: 2,
          proposedCount: 1,
          approvedCount: 1,
        }),
      );
    } finally {
      delete process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE;
    }
  });

  it('approves billing suggestion and routes to accounts workflow with audit trail', async () => {
    process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                source_type: 'in_person',
                status: 'doctor_reviewed',
              },
            ];
          }
          if (sql.includes('FROM post_visit_billing_suggestions') && sql.includes('LIMIT 1')) {
            return [
              {
                id: 'bill-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                suggestion_key: 'icd10:I10',
                code_type: 'icd10',
                code: 'I10',
                description: 'Essential hypertension',
                confidence: 0.84,
                justification: 'Hypertension present.',
                documentation_checks: [],
                documentation_score: 88,
                documentation_status: 'sufficient',
                status: 'proposed',
                metadata: {},
                created_at: '2026-03-06T10:00:00.000Z',
                updated_at: '2026-03-06T10:00:00.000Z',
              },
            ];
          }
          if (sql.includes('UPDATE post_visit_billing_suggestions') && sql.includes('SET status = $3')) {
            return [
              {
                id: 'bill-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                suggestion_key: 'icd10:I10',
                code_type: 'icd10',
                code: 'I10',
                description: 'Essential hypertension',
                confidence: 0.84,
                justification: 'Hypertension present.',
                documentation_checks: [],
                documentation_score: 88,
                documentation_status: 'sufficient',
                status: 'approved',
                approved_by: 'doctor-1',
                approved_at: '2026-03-06T10:02:00.000Z',
                approval_note: params[4],
                source: 'post_visit_billing_intelligence_v1',
                metadata: {},
                created_at: '2026-03-06T10:00:00.000Z',
                updated_at: '2026-03-06T10:02:00.000Z',
              },
            ];
          }
          if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
            return [];
          }
          if (sql.includes('UPDATE post_visit_billing_suggestions') && sql.includes('workflow_key')) {
            return [
              {
                id: 'bill-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                suggestion_key: 'icd10:I10',
                code_type: 'icd10',
                code: 'I10',
                description: 'Essential hypertension',
                confidence: 0.84,
                justification: 'Hypertension present.',
                documentation_checks: [],
                documentation_score: 88,
                documentation_status: 'sufficient',
                status: 'approved',
                approved_by: 'doctor-1',
                approved_at: '2026-03-06T10:02:00.000Z',
                approval_note: 'Approve to accounts',
                source: 'post_visit_billing_intelligence_v1',
                metadata: { workflow_key: 'post_visit_billing:bill-1' },
                created_at: '2026-03-06T10:00:00.000Z',
                updated_at: '2026-03-06T10:02:10.000Z',
              },
            ];
          }
          if (sql.includes('INSERT INTO post_visit_billing_audit_log')) {
            return [];
          }
          return [];
        }),
      } as any;

      const result = await service.reviewBillingSuggestion(
        tenantDb,
        'session-1',
        'bill-1',
        {
          action: 'approve',
          note: 'Approve to accounts',
        },
        {
          actorUserId: 'doctor-1',
        },
      );

      expect(result.action).toBe('approve');
      expect(result.workflowKey).toBe('post_visit_billing:bill-1');
      expect(result.suggestion.status).toBe('approved');
      expect(tenantDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
        expect.any(Array),
      );
    } finally {
      delete process.env.FEATURE_POSTVISIT_BILLING_INTELLIGENCE;
    }
  });

  it('generates appointment pre-visit brief with follow-up risk scoring and persists snapshot', async () => {
    process.env.FEATURE_POSTVISIT_PREVISIT_BRIEF = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('FROM appointments a')) {
            return [
              {
                id: 'appt-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                appointment_date: '2026-03-10T09:00:00.000Z',
                appointment_type: 'follow_up',
                reason: 'Blood pressure review',
                notes: null,
                patient_first_name: 'Jane',
                patient_last_name: 'Doe',
                patient_number: 'P-001',
                doctor_first_name: 'Ava',
                doctor_last_name: 'Nyathi',
              },
            ];
          }
          if (sql.includes('FROM post_visit_previsit_briefs') && sql.includes('appointment_id = $1')) {
            return [];
          }
          if (sql.includes('FROM post_visit_sessions') && sql.includes("status IN ('published','closed')")) {
            return [{ id: 'session-1', published_at: '2026-03-06T08:00:00.000Z', updated_at: '2026-03-06T08:10:00.000Z' }];
          }
          if (sql.includes('FROM post_visit_escalation_events')) {
            return [{ critical_count: 0, high_count: 1 }];
          }
          if (sql.includes('FROM post_visit_intravisit_alert_events')) {
            return [{ unresolved_critical_count: 0 }];
          }
          if (sql.includes('FROM post_visit_action_executions pvae')) {
            return [{ pending_count: 3, failed_count: 1 }];
          }
          if (sql.includes('FROM post_visit_companion_acknowledgements')) {
            return [{ acknowledged_count: 0 }];
          }
          if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
            if (params[1] === 'visit_summary') {
              return [
                {
                  id: 'summary-1',
                  artifact_status: 'published',
                  content: { plain_language_summary: 'Patient requires close blood-pressure follow-up.' },
                },
              ];
            }
            if (params[1] === 'recommendation_bundle') {
              return [
                {
                  id: 'bundle-1',
                  artifact_status: 'published',
                  content: {
                    items: [
                      { id: 'bp_review', title: 'Repeat BP check in 3 days', urgency: 'urgent' },
                      { id: 'med_review', title: 'Medication adherence call', urgency: 'routine' },
                    ],
                  },
                },
              ];
            }
            return [];
          }
          if (sql.includes('INSERT INTO post_visit_previsit_briefs')) {
            return [
              {
                id: 'brief-1',
                appointment_id: 'appt-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                scheduled_at: '2026-03-10T09:00:00.000Z',
                status: 'active',
                brief_content: JSON.parse(params[4] || '{}'),
                follow_up_risk_score: params[5],
                follow_up_risk_tier: params[6],
                follow_up_risk_reasons: JSON.parse(params[7] || '[]'),
                nudge_policy: params[8],
                source: 'post_visit_previsit_brief_v1',
                generated_by: params[10],
                generated_at: '2026-03-06T12:00:00.000Z',
                metadata: JSON.parse(params[11] || '{}'),
                delivered_at: params[12] || null,
                created_at: '2026-03-06T12:00:00.000Z',
                updated_at: '2026-03-06T12:00:00.000Z',
              },
            ];
          }
          if (sql.includes('INSERT INTO post_visit_coordinator_tasks')) {
            return [];
          }
          return [];
        }),
      } as any;

      const result = await service.generateAppointmentPreVisitBrief(
        tenantDb,
        'appt-1',
        {
          actorUserId: 'doctor-1',
          forceRefresh: true,
        },
      );

      expect(result.featureEnabled).toBe(true);
      expect(result.appointmentId).toBe('appt-1');
      if (!('followUpRisk' in result)) {
        throw new Error('Expected follow-up risk payload when pre-visit brief is generated.');
      }
      expect(result.followUpRisk.score).toBeGreaterThanOrEqual(30);
      expect(['moderate', 'high', 'critical']).toContain(result.followUpRisk.tier);
      expect(result.followUpRisk.nudgePolicy).toBeTruthy();
      expect(result.reused).toBe(false);
    } finally {
      delete process.env.FEATURE_POSTVISIT_PREVISIT_BRIEF;
    }
  });

  it('generatePreVisitBriefsForUpcomingAppointments returns skipped count when feature disabled', async () => {
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('FROM appointments') && sql.includes('appointment_date >= NOW()')) {
          return [{ id: 'apt-1' }, { id: 'apt-2' }];
        }
        return [];
      }),
    } as any;
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const prev = process.env.FEATURE_POSTVISIT_PREVISIT_BRIEF;
    delete process.env.FEATURE_POSTVISIT_PREVISIT_BRIEF;
    try {
      const result = await service.generatePreVisitBriefsForUpcomingAppointments(tenantDb, {
        withinMinutes: 60,
      });
      expect(result.generated).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.errors).toEqual([]);
    } finally {
      if (prev !== undefined) process.env.FEATURE_POSTVISIT_PREVISIT_BRIEF = prev;
    }
  });

  it('generates signed post-visit admin documents with immutable hashes', async () => {
    process.env.FEATURE_POSTVISIT_ADMIN_DOCS = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      let insertedCount = 0;
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                appointment_id: null,
                status: 'doctor_reviewed',
              },
            ];
          }
          if (sql.includes('FROM patients') && sql.includes('WHERE id = $1')) {
            return [{ id: 'patient-1', first_name: 'Jane', last_name: 'Doe', patient_number: 'P-001' }];
          }
          if (sql.includes('FROM users') && sql.includes('WHERE id = $1')) {
            return [{ id: 'doctor-1', first_name: 'Ava', last_name: 'Nyathi' }];
          }
          if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
            if (params[1] === 'visit_summary') {
              return [
                {
                  id: 'summary-1',
                  content: { plain_language_summary: 'Patient requires close follow-up.' },
                },
              ];
            }
            if (params[1] === 'recommendation_bundle') {
              return [
                {
                  id: 'bundle-1',
                  content: { items: [{ title: 'Repeat BP review in 3 days' }] },
                },
              ];
            }
            return [];
          }
          if (sql.includes('FROM post_visit_admin_documents') && sql.includes('MAX(version_no)')) {
            return [{ current_version: 0 }];
          }
          if (sql.includes('INSERT INTO post_visit_admin_documents')) {
            insertedCount += 1;
            return [
              {
                id: `doc-${insertedCount}`,
                session_id: params[0],
                patient_id: params[1],
                doctor_id: params[2],
                document_type: params[3],
                version_no: params[4],
                status: params[5],
                title: params[6],
                body_json: JSON.parse(params[7] || '{}'),
                immutable_hash: params[8],
                signed_by: params[9],
                signed_at: params[10],
                metadata: JSON.parse(params[11] || '{}'),
                created_at: '2026-03-06T12:00:00.000Z',
                updated_at: '2026-03-06T12:00:00.000Z',
              },
            ];
          }
          return [];
        }),
      } as any;

      const result = await service.generateSessionAdminDocuments(
        tenantDb,
        'session-1',
        {
          documentTypes: ['referral_letter', 'sick_note'],
          note: 'Generate templates',
          signImmediately: true,
        },
        {
          actorUserId: 'doctor-1',
        },
      );

      expect(result.featureEnabled).toBe(true);
      expect(result.generatedCount).toBe(2);
      expect(result.documents[0].status).toBe('signed');
      expect(String(result.documents[0].immutableHash || '').length).toBeGreaterThan(20);
    } finally {
      delete process.env.FEATURE_POSTVISIT_ADMIN_DOCS;
    }
  });

  it('markAdminDocumentDispatched updates status to dispatched and only allows signed docs', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const signedRow = {
      id: 'doc-1',
      session_id: 'session-1',
      patient_id: 'patient-1',
      status: 'signed',
      document_type: 'referral_letter',
      title: 'Referral',
      body_json: {},
      immutable_hash: 'abc',
      signed_by: 'doctor-1',
      signed_at: new Date(),
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    };
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT *') && sql.includes('post_visit_admin_documents')) {
          return [{ ...signedRow, status: 'dispatched' }];
        }
        if (sql.includes('SELECT') && sql.includes('post_visit_admin_documents') && sql.includes('id = $1')) {
          return [signedRow];
        }
        if (sql.includes('UPDATE') && sql.includes("status = 'dispatched'")) return [];
        return [];
      }),
    } as any;

    const result = await service.markAdminDocumentDispatched(tenantDb, 'doc-1', { actorUserId: 'doctor-1' });
    expect(result.status).toBe('dispatched');
    expect(result.documentId).toBe('doc-1');
    expect(result.document?.status).toBe('dispatched');

    tenantDb.query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('post_visit_admin_documents')) {
        return [{ ...signedRow, status: 'draft' }];
      }
      return [];
    });
    await expect(
      service.markAdminDocumentDispatched(tenantDb, 'doc-1', { actorUserId: 'doctor-1' }),
    ).rejects.toThrow('Only signed');
  });

  it('requires explicit confirmation for voice SIGN_AND_PUBLISH command', async () => {
    process.env.FEATURE_POSTVISIT_VOICE_REVIEW = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('post_visit_sessions') && sql.includes('id = $1')) return [{ id: 'session-1', patient_id: 'patient-1' }];
          return [];
        }),
      } as any;

      await expect(
        service.executeVoiceReviewCommand(
          tenantDb,
          'session-1',
          {
            command: 'SIGN_AND_PUBLISH',
            note: 'voice publish',
          },
          {
            actorUserId: 'doctor-1',
          },
        ),
      ).rejects.toThrow('confirmSignAndPublish=true');
    } finally {
      delete process.env.FEATURE_POSTVISIT_VOICE_REVIEW;
    }
  });

  it('executes voice APPROVE_SUMMARY command through review pipeline', async () => {
    process.env.FEATURE_POSTVISIT_VOICE_REVIEW = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('post_visit_sessions') && sql.includes('id = $1')) return [{ id: 'session-1', patient_id: 'patient-1' }];
          return [];
        }),
      } as any;
      const reviewSpy = jest.spyOn(service, 'reviewDraftArtifact').mockResolvedValue({
        session: { id: 'session-1', status: 'doctor_reviewed' },
      } as any);

      const result = await service.executeVoiceReviewCommand(
        tenantDb,
        'session-1',
        {
          command: 'APPROVE_SUMMARY',
          note: 'voice approve summary',
        },
        {
          actorUserId: 'doctor-1',
          tenantId: 'tenant-a',
        },
      );

      expect(reviewSpy).toHaveBeenCalledWith(
        tenantDb,
        'session-1',
        expect.objectContaining({
          artifactType: 'visit_summary',
          action: 'accept',
        }),
        expect.objectContaining({
          actorUserId: 'doctor-1',
          source: 'post_visit_voice_command',
        }),
      );
      expect(result.status).toBe('executed');
      expect(result.command).toBe('APPROVE_SUMMARY');
    } finally {
      delete process.env.FEATURE_POSTVISIT_VOICE_REVIEW;
    }
  });

  it('returns feature-disabled response for trial matcher when flag is off', async () => {
    process.env.FEATURE_POSTVISIT_TRIAL_MATCHER = 'false';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                status: 'doctor_reviewed',
              },
            ];
          }
          return [];
        }),
      } as any;

      const result = await service.listSessionTrialMatches(tenantDb, 'session-1', { refresh: true, actorUserId: 'doctor-1' });
      expect(result.featureEnabled).toBe(false);
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.matches).toHaveLength(0);
    } finally {
      delete process.env.FEATURE_POSTVISIT_TRIAL_MATCHER;
    }
  });

  it('records trial match review decision state change', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              status: 'doctor_reviewed',
            },
          ];
        }
        if (sql.includes('FROM post_visit_trial_matches') && sql.includes('WHERE id = $1')) {
          return [
            {
              id: params[0],
              session_id: params[1],
              patient_id: 'patient-1',
              match_status: 'proposed',
              trial_id: 'NCT00000001',
              trial_title: 'Hypertension Trial',
              eligibility_score: 84,
            },
          ];
        }
        if (sql.includes('UPDATE post_visit_trial_matches')) {
          return [
            {
              id: params[0],
              session_id: params[1],
              patient_id: 'patient-1',
              trial_source: 'clinicaltrials_gov_v2',
              trial_id: 'NCT00000001',
              trial_title: 'Hypertension Trial',
              trial_phase: 'Phase 3',
              trial_status: 'RECRUITING',
              condition_tags: ['hypertension'],
              source_url: 'https://clinicaltrials.gov/study/NCT00000001',
              eligibility_score: 84,
              eligibility_rationale: ['Matched condition terms'],
              match_status: params[2],
              reviewed_by: params[3],
              reviewed_at: '2026-03-06T13:00:00.000Z',
              review_note: params[4],
              metadata: JSON.parse(params[5] || '{}'),
              created_at: '2026-03-06T12:00:00.000Z',
              updated_at: '2026-03-06T13:00:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.reviewTrialMatch(
      tenantDb,
      'session-1',
      'trial-1',
      {
        action: 'consider',
        note: 'candidate for discussion',
      },
      {
        actorUserId: 'doctor-1',
      },
    );

    expect(result.action).toBe('consider');
    expect(result.match.matchStatus).toBe('considered');
  });

  it('creates SLA escalation for stale trial decisions during trial match listing', async () => {
    process.env.FEATURE_POSTVISIT_TRIAL_MATCHER = 'true';
    process.env.POSTVISIT_TRIAL_DECISION_SLA_HOURS = '48';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      let insertedSlaEscalation = false;
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                status: 'doctor_reviewed',
              },
            ];
          }
          if (sql.includes('FROM post_visit_trial_matches') && sql.includes('WHERE session_id = $1') && sql.includes('eligibility_score')) {
            return [
              {
                id: 'trial-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                trial_source: 'clinicaltrials_gov_v2',
                trial_id: 'NCT00000001',
                trial_title: 'Hypertension Trial',
                trial_phase: 'Phase 3',
                trial_status: 'RECRUITING',
                condition_tags: ['hypertension'],
                source_url: 'https://clinicaltrials.gov/study/NCT00000001',
                eligibility_score: 84,
                eligibility_rationale: ['Matched condition terms'],
                match_status: 'proposed',
                created_at: '2026-01-01T00:00:00.000Z',
                reviewed_at: null,
                metadata: {},
              },
            ];
          }
          if (sql.includes('FROM post_visit_trial_matches tm')) {
            return [
              {
                id: 'trial-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                trial_id: 'NCT00000001',
                trial_title: 'Hypertension Trial',
                match_status: 'proposed',
                eligibility_score: 84,
                created_at: '2026-01-01T00:00:00.000Z',
                reviewed_at: null,
              },
            ];
          }
          if (sql.includes('FROM post_visit_escalation_events') && sql.includes("trigger_type = 'trial_decision_sla_breach'")) {
            return [];
          }
          if (sql.includes('INSERT INTO post_visit_escalation_events')) {
            insertedSlaEscalation = true;
            return [];
          }
          return [];
        }),
      } as any;

      const result = await service.listSessionTrialMatches(tenantDb, 'session-1', { refresh: false, actorUserId: 'doctor-1' });
      expect(result.matches).toHaveLength(1);
      expect(insertedSlaEscalation).toBe(true);
    } finally {
      delete process.env.FEATURE_POSTVISIT_TRIAL_MATCHER;
      delete process.env.POSTVISIT_TRIAL_DECISION_SLA_HOURS;
    }
  });

  it('returns trial-memory analytics snapshot with funnel and SLA counts', async () => {
    process.env.FEATURE_POSTVISIT_TRIAL_MATCHER = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('FROM post_visit_trial_matches tm')) {
            return [];
          }
          if (sql.includes('SELECT id') && sql.includes('post_visit_escalation_events') && sql.includes('trial_decision_sla_breach')) {
            return [];
          }
          if (sql.includes('COUNT(*)::int AS total') && sql.includes('FROM post_visit_trial_matches')) {
            return [
              {
                total: 12,
                proposed: 5,
                considered: 3,
                deferred: 2,
                excluded: 1,
                enrolled: 1,
                stale_proposed: 2,
                stale_deferred: 1,
              },
            ];
          }
          if (sql.includes('FROM post_visit_trial_match_audit_log')) {
            return [
              { action: 'consider', count: 3 },
              { action: 'enroll', count: 1 },
            ];
          }
          if (sql.includes('FROM post_visit_companion_memory')) {
            return [
              {
                total: 8,
                active: 6,
                retired: 2,
                promoted_recent: 3,
                retired_recent: 1,
              },
            ];
          }
          if (sql.includes('FROM post_visit_escalation_events') && sql.includes("trigger_type = 'trial_decision_sla_breach'")) {
            return [
              {
                total: 4,
                open_count: 2,
                acknowledged_count: 1,
                breached_count: 1,
              },
            ];
          }
          return [];
        }),
      } as any;

      const result = await service.getTrialMemoryAnalytics(tenantDb, { days: 30, routeTarget: 'doctor' });
      expect(result.trialFunnel.total).toBe(12);
      expect(result.trialFunnel.enrollmentRatePercent).toBeGreaterThanOrEqual(0);
      expect(result.trialDecisionSla.openEscalations).toBe(2);
      expect(result.companionMemory.total).toBe(8);
    } finally {
      delete process.env.FEATURE_POSTVISIT_TRIAL_MATCHER;
    }
  });

  it('applies trial SLA notification fanout policy by severity', async () => {
    process.env.FEATURE_POSTVISIT_TRIAL_MATCHER = 'true';
    process.env.POSTVISIT_TRIAL_DECISION_SLA_HOURS = '24';
    process.env.POSTVISIT_TRIAL_SLA_EMAIL_MIN_SEVERITY = 'high';
    process.env.POSTVISIT_TRIAL_SLA_SMS_MIN_SEVERITY = 'critical';
    try {
      const notificationsServiceMock = {
        sendSms: jest.fn(async () => undefined),
      };
      const emailServiceMock = {
        sendEmail: jest.fn(async () => ({ success: true })),
      };
      const service = new PostVisitService(
        transcriptionServiceMock as any,
        patientServiceMock as any,
        notificationsServiceMock as any,
        emailServiceMock as any,
      );
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                status: 'doctor_reviewed',
              },
            ];
          }
          if (sql.includes('FROM post_visit_trial_matches') && sql.includes('WHERE session_id = $1') && sql.includes('eligibility_score')) {
            return [
              {
                id: 'trial-match-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                trial_source: 'clinicaltrials_gov_v2',
                trial_id: 'NCT90000001',
                trial_title: 'Hypertension Outcomes Trial',
                trial_phase: 'Phase 3',
                trial_status: 'RECRUITING',
                condition_tags: ['hypertension'],
                source_url: 'https://clinicaltrials.gov/study/NCT90000001',
                eligibility_score: 88,
                eligibility_rationale: ['Matched condition'],
                match_status: 'proposed',
                created_at: '2026-01-01T00:00:00.000Z',
                reviewed_at: null,
                metadata: {},
              },
            ];
          }
          if (sql.includes('FROM post_visit_trial_matches tm')) {
            return [
              {
                id: 'trial-match-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                trial_id: 'NCT90000001',
                trial_title: 'Hypertension Outcomes Trial',
                match_status: 'proposed',
                eligibility_score: 88,
                created_at: '2026-01-01T00:00:00.000Z',
                reviewed_at: null,
              },
            ];
          }
          if (sql.includes('SELECT id') && sql.includes('post_visit_escalation_events') && sql.includes('trial_decision_sla_breach')) {
            return [];
          }
          if (sql.includes('INSERT INTO post_visit_escalation_events')) {
            return [
              {
                id: 'esc-sla-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                status: 'open',
                severity: 'high',
                route_target: 'doctor',
                trigger_type: 'trial_decision_sla_breach',
                metadata: {},
                created_at: '2026-03-06T10:00:00.000Z',
                updated_at: '2026-03-06T10:00:00.000Z',
              },
            ];
          }
          if (sql.includes('FROM patients') && sql.includes('WHERE id = $1')) {
            return [
              { id: 'patient-1', first_name: 'Jane', last_name: 'Doe', patient_number: 'P-100' },
            ];
          }
          if (sql.includes('FROM post_visit_sessions s') && sql.includes('LEFT JOIN users u ON u.id = s.doctor_id')) {
            return [
              {
                id: 'doctor-1',
                first_name: 'Ava',
                last_name: 'Nyathi',
                role: 'doctor',
                phone: '+263700000111',
                email: 'ava@example.com',
              },
            ];
          }
          if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes('notification_fanout')) {
            return [];
          }
          return [];
        }),
      } as any;

      const result = await service.listSessionTrialMatches(tenantDb, 'session-1', { refresh: false, actorUserId: 'doctor-1' });
      expect(result.matches).toHaveLength(1);
      expect(emailServiceMock.sendEmail).toHaveBeenCalledTimes(1);
      expect(notificationsServiceMock.sendSms).not.toHaveBeenCalled();
    } finally {
      delete process.env.FEATURE_POSTVISIT_TRIAL_MATCHER;
      delete process.env.POSTVISIT_TRIAL_DECISION_SLA_HOURS;
      delete process.env.POSTVISIT_TRIAL_SLA_EMAIL_MIN_SEVERITY;
      delete process.env.POSTVISIT_TRIAL_SLA_SMS_MIN_SEVERITY;
    }
  });

  it('returns per-clinician trial SLA accountability metrics', async () => {
    process.env.FEATURE_POSTVISIT_TRIAL_MATCHER = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('FROM post_visit_trial_matches tm')) {
            return [];
          }
          if (sql.includes('SELECT id') && sql.includes('post_visit_escalation_events') && sql.includes('trial_decision_sla_breach')) {
            return [];
          }
          if (sql.includes('GROUP BY s.doctor_id')) {
            return [
              {
                clinician_id: 'doctor-1',
                first_name: 'Ava',
                last_name: 'Nyathi',
                role: 'doctor',
                email: 'ava@example.com',
                total_assigned: 9,
                open_count: 3,
                breached_open_count: 1,
                acknowledged_count: 6,
                resolved_count: 6,
                resolved_within_sla_count: 5,
                avg_ack_minutes: 44.2,
                avg_resolve_minutes: 138.7,
                last_action_at: '2026-03-06T12:00:00.000Z',
              },
            ];
          }
          if (sql.includes('clinicians_with_assignments')) {
            return [
              {
                total_escalations: 9,
                open_escalations: 3,
                breached_open_escalations: 1,
                resolved_escalations: 6,
                resolved_within_sla: 5,
                clinicians_with_assignments: 1,
              },
            ];
          }
          return [];
        }),
      } as any;

      const result = await service.getTrialDecisionSlaAccountability(tenantDb, {
        days: 14,
        routeTarget: 'doctor',
        limit: 10,
      });
      expect(result.summary.totalEscalations).toBe(9);
      expect(result.summary.resolvedWithinSlaPercent).toBe(83);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].openCount).toBe(3);
      expect(result.items[0].averageAcknowledgeMinutes).toBe(44.2);
    } finally {
      delete process.env.FEATURE_POSTVISIT_TRIAL_MATCHER;
    }
  });

  it('exports trial-memory audit feed in CSV format', async () => {
    process.env.FEATURE_POSTVISIT_TRIAL_MATCHER = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('FROM post_visit_trial_matches tm')) {
            return [];
          }
          if (sql.includes('SELECT id') && sql.includes('post_visit_escalation_events') && sql.includes('trial_decision_sla_breach')) {
            return [];
          }
          if (sql.includes('FROM post_visit_escalation_events e') && sql.includes('trial_decision_sla_breach')) {
            return [
              {
                id: 'esc-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                status: 'open',
                severity: 'high',
                route_target: 'doctor',
                detected_at: '2026-03-06T09:00:00.000Z',
                acknowledged_at: null,
                resolved_at: null,
                classification_reason: 'SLA breach',
                metadata: {
                  trial_match_id: 'trial-match-1',
                  trial_id: 'NCT100',
                  trial_title: 'Cardio Trial',
                  stale_hours: 96,
                  sla_hours: 72,
                },
                session_doctor_id: 'doctor-1',
                doctor_first_name: 'Ava',
                doctor_last_name: 'Nyathi',
              },
            ];
          }
          if (sql.includes('FROM post_visit_trial_match_audit_log a')) {
            return [
              {
                id: 'audit-1',
                session_id: 'session-1',
                trial_match_id: 'trial-match-1',
                patient_id: 'patient-1',
                action: 'consider',
                previous_status: 'proposed',
                next_status: 'considered',
                note: 'Reviewed in clinic',
                acted_at: '2026-03-06T10:00:00.000Z',
                trial_id: 'NCT100',
                trial_title: 'Cardio Trial',
                match_status: 'considered',
                session_doctor_id: 'doctor-1',
                doctor_first_name: 'Ava',
                doctor_last_name: 'Nyathi',
                metadata: {},
              },
            ];
          }
          if (sql.includes('FROM post_visit_companion_memory m')) {
            return [
              {
                id: 'mem-1',
                session_id: 'session-1',
                patient_id: 'patient-1',
                memory_type: 'preference',
                memory_key: 'communication_preference',
                memory_value: 'SMS reminders',
                is_active: true,
                promoted_at: '2026-03-06T11:00:00.000Z',
                curation_note: 'Preferred by patient',
                created_by: 'doctor-1',
                promoted_by: 'doctor-1',
                retired_by: null,
                updated_at: '2026-03-06T11:05:00.000Z',
                created_at: '2026-03-06T11:00:00.000Z',
                metadata: {},
                session_doctor_id: 'doctor-1',
                doctor_first_name: 'Ava',
                doctor_last_name: 'Nyathi',
              },
            ];
          }
          return [];
        }),
      } as any;

      const result = await service.exportTrialMemoryAudit(tenantDb, {
        days: 30,
        format: 'csv',
        routeTarget: 'doctor',
        limit: 100,
      });
      expect(result.format).toBe('csv');
      expect(result.summary.totalRecords).toBe(3);
      const csv = (result as any).csv as string;
      expect(csv).toContain('eventType,eventTimestamp');
      expect(csv).toContain('trial_sla_escalation');
      expect(csv).toContain('trial_match_review_action');
      expect(csv).toContain('companion_memory_state');
    } finally {
      delete process.env.FEATURE_POSTVISIT_TRIAL_MATCHER;
    }
  });

  it('returns trial match audit drilldown rows', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [
            {
              id: 'session-1',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              status: 'doctor_reviewed',
            },
          ];
        }
        if (sql.includes('FROM post_visit_trial_match_audit_log')) {
          return [
            {
              id: 'audit-1',
              session_id: params[0],
              trial_match_id: params[1],
              patient_id: 'patient-1',
              action: 'consider',
              previous_status: 'proposed',
              next_status: 'considered',
              note: 'candidate for discussion',
              acted_by: 'doctor-1',
              acted_at: '2026-03-06T13:00:00.000Z',
              metadata: {},
              created_at: '2026-03-06T13:00:00.000Z',
              updated_at: '2026-03-06T13:00:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.listTrialMatchAuditLog(tenantDb, 'session-1', 'trial-1', { limit: 20 });
    expect(result.summary.total).toBe(1);
    expect(result.entries[0].action).toBe('consider');
  });

  it('curates companion memory entry via promote/retire controls', async () => {
    process.env.FEATURE_POSTVISIT_COMPANION_MEMORY = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('SELECT * FROM post_visit_sessions')) {
            return [
              {
                id: 'session-1',
                patient_id: 'patient-1',
                doctor_id: 'doctor-1',
                status: 'doctor_reviewed',
              },
            ];
          }
          if (sql.includes('FROM post_visit_companion_memory') && sql.includes('WHERE id = $1')) {
            return [
              {
                id: params[0],
                patient_id: params[1],
                memory_type: 'preference',
                memory_key: 'communication_preference',
                memory_value: 'phone call reminders',
                is_active: true,
                metadata: {},
                created_at: '2026-03-06T12:00:00.000Z',
                updated_at: '2026-03-06T12:00:00.000Z',
              },
            ];
          }
          if (sql.includes('UPDATE post_visit_companion_memory')) {
            return [
              {
                id: params[0],
                session_id: 'session-1',
                patient_id: params[1],
                memory_type: 'preference',
                memory_key: 'communication_preference',
                memory_value: 'phone call reminders',
                is_active: params[2],
                curation_note: params[6],
                metadata: JSON.parse(params[7] || '{}'),
                created_at: '2026-03-06T12:00:00.000Z',
                updated_at: '2026-03-06T13:00:00.000Z',
              },
            ];
          }
          return [];
        }),
      } as any;

      const retired = await service.curateCompanionMemory(
        tenantDb,
        'session-1',
        'mem-1',
        {
          action: 'retire',
          note: 'no longer clinically relevant',
        },
        {
          actorUserId: 'doctor-1',
        },
      );
      expect(retired.memory.isActive).toBe(false);
    } finally {
      delete process.env.FEATURE_POSTVISIT_COMPANION_MEMORY;
    }
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

  it('blocks publish when specialty SOAP template is enabled and required checks are missing', async () => {
    process.env.FEATURE_POSTVISIT_SPECIALTY_SOAP = 'true';
    try {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      patientServiceMock.getPatientContext.mockResolvedValue({
        patient: { id: 'patient-1', age: 63 },
        modules: {
          cardiology: { latestEncounter: { id: 'card-1' } },
        },
      });

      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
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
          if (sql.includes('FROM post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
            if (params[1] === 'soap_note') {
              return [
                {
                  id: 'soap-1',
                  artifact_status: 'reviewed',
                  content: {
                    soap_note: {
                      subjective: 'patient reports mild fatigue',
                      objective: '',
                      assessment: 'stable',
                      plan: 'review medications',
                    },
                  },
                },
              ];
            }
            return [];
          }
          return [];
        }),
      } as any;

      await expect(
        service.publishSession(
          tenantDb,
          'session-1',
          { note: 'attempt publish with incomplete specialty SOAP' },
          { actorUserId: 'doctor-1' },
        ),
      ).rejects.toThrow('Publish blocked. Specialty SOAP template (cardiology) incomplete');
    } finally {
      delete process.env.FEATURE_POSTVISIT_SPECIALTY_SOAP;
    }
  });

  it('creates escalation event when patient companion message contains urgent symptoms', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    let companionInsertCount = 0;
    const patientAiSessionRows: any[] = [];
    const patientAiEscalationRows: any[] = [];
    const followupRows: any[] = [];
    const patientAiSessionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `patient-ai-session-${patientAiSessionRows.length + 1}`, ...value };
        patientAiSessionRows.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ id }) => patientAiSessionRows.find((row) => row.id === id) ?? null),
    };
    const patientAiEscalationRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `patient-ai-escalation-${patientAiEscalationRows.length + 1}`, ...value };
        patientAiEscalationRows.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ id }) => patientAiEscalationRows.find((row) => row.id === id) ?? null),
    };
    const followupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `followup-${followupRows.length + 1}`, ...value };
        followupRows.push(row);
        return row;
      }),
      findOneBy: jest.fn(async ({ id }) => followupRows.find((row) => row.id === id) ?? null),
    };

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
        if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes("SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb")) {
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
      getRepository: jest.fn((entity: any) => {
        switch (entity?.name) {
          case 'PatientAiSession':
            return patientAiSessionRepo;
          case 'PatientAiEscalation':
            return patientAiEscalationRepo;
          case 'PatientFollowupOrchestration':
            return followupRepo;
          default:
            return null;
        }
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
    expect(result.patientAi).toEqual({
      sessionId: 'patient-ai-session-1',
      escalationId: 'patient-ai-escalation-1',
      followupOrchestrationId: 'followup-1',
    });
    expect(patientAiSessionRows).toHaveLength(1);
    expect(patientAiEscalationRows).toHaveLength(1);
    expect(followupRows).toHaveLength(1);
    expect(followupRows[0]).toEqual(expect.objectContaining({
      triggerType: 'post_visit_companion_message',
      routeBackTarget: 'emergency',
    }));
  });

  it('syncs post-visit escalation resolution into patient-ai escalation and follow-up state', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    const patientAiSessionRows: any[] = [
      {
        id: 'patient-ai-session-1',
        status: 'needs_follow_up',
        provenance: {},
      },
    ];
    const patientAiEscalationRows: any[] = [
      {
        id: 'patient-ai-escalation-1',
        status: 'open',
        provenance: {},
        resolutionNotes: null,
        resolvedAt: null,
        resolvedBy: null,
      },
    ];
    const followupRows: any[] = [
      {
        id: 'followup-1',
        status: 'open',
        reminderState: 'pending',
        payload: {},
        completedAt: null,
      },
    ];
    const patientAiSessionRepo = {
      findOneBy: jest.fn(async ({ id }) => patientAiSessionRows.find((row) => row.id === id) ?? null),
      save: jest.fn(async (value) => {
        const index = patientAiSessionRows.findIndex((row) => row.id === value.id);
        patientAiSessionRows[index] = { ...patientAiSessionRows[index], ...value };
        return patientAiSessionRows[index];
      }),
    };
    const patientAiEscalationRepo = {
      findOneBy: jest.fn(async ({ id }) => patientAiEscalationRows.find((row) => row.id === id) ?? null),
      save: jest.fn(async (value) => {
        const index = patientAiEscalationRows.findIndex((row) => row.id === value.id);
        patientAiEscalationRows[index] = { ...patientAiEscalationRows[index], ...value };
        return patientAiEscalationRows[index];
      }),
    };
    const followupRepo = {
      findOneBy: jest.fn(async ({ id }) => followupRows.find((row) => row.id === id) ?? null),
      save: jest.fn(async (value) => {
        const index = followupRows.findIndex((row) => row.id === value.id);
        followupRows[index] = { ...followupRows[index], ...value };
        return followupRows[index];
      }),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_escalation_events WHERE id = $1 LIMIT 1')) {
          return [
            {
              id: 'esc-1',
              status: 'open',
              workflow_key: null,
              metadata: {
                patient_ai_session_id: 'patient-ai-session-1',
                patient_ai_escalation_id: 'patient-ai-escalation-1',
                patient_followup_orchestration_id: 'followup-1',
              },
            },
          ];
        }
        if (sql.includes('UPDATE post_visit_escalation_events') && sql.includes('SET status = $2')) {
          return [
            {
              id: 'esc-1',
              status: 'resolved',
              metadata: {
                patient_ai_session_id: 'patient-ai-session-1',
                patient_ai_escalation_id: 'patient-ai-escalation-1',
                patient_followup_orchestration_id: 'followup-1',
              },
            },
          ];
        }
        return [];
      }),
      getRepository: jest.fn((entity: any) => {
        switch (entity?.name) {
          case 'PatientAiSession':
            return patientAiSessionRepo;
          case 'PatientAiEscalation':
            return patientAiEscalationRepo;
          case 'PatientFollowupOrchestration':
            return followupRepo;
          default:
            return null;
        }
      }),
    } as any;

    const result = await service.resolveEscalation(
      tenantDb,
      'esc-1',
      { status: 'resolved', resolutionNote: 'Patient contacted and stable.' },
      { actorUserId: 'doctor-1' },
    );

    expect(result.status).toBe('resolved');
    expect(patientAiEscalationRows[0]).toEqual(expect.objectContaining({
      status: 'resolved',
      resolutionNotes: 'Patient contacted and stable.',
      resolvedBy: 'doctor-1',
    }));
    expect(followupRows[0]).toEqual(expect.objectContaining({
      status: 'completed',
      reminderState: 'acknowledged',
    }));
    expect(patientAiSessionRows[0]).toEqual(expect.objectContaining({
      status: 'closed',
    }));
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
      logPhiAccess: jest.fn(async () => undefined),
      logPhiModification: jest.fn(async () => undefined),
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
      logPhiAccess: jest.fn(async () => undefined),
      logPhiModification: jest.fn(async () => undefined),
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

  it('detects and stores intra-visit safety alerts from streamed transcript chunk', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    jest.spyOn(service as any, 'isIntraVisitAlertsEnabled').mockReturnValue(true);

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', status: 'draft_ready', source_type: 'in_person' }];
        }
        if (sql.includes('FROM post_visit_intravisit_alert_events') && sql.includes('detected_at >= NOW() - INTERVAL')) {
          return [];
        }
        if (sql.includes('INSERT INTO post_visit_intravisit_alert_events')) {
          return [
            {
              id: 'intravisit-1',
              session_id: 'session-1',
              patient_id: 'patient-1',
              status: 'open',
              alert_type: params[2],
              severity: params[3],
              route_target: params[4],
              assigned_role: params[5],
              assigned_user_id: params[6],
              assigned_team: params[7],
              policy_version: params[8],
              routing_rationale: params[9],
              source: params[10],
              transcript_offset_seconds: params[11],
              signal_text: params[12],
              alert_message: params[13],
              suggested_action: params[14],
              confidence: params[15],
              trigger_terms: JSON.parse(String(params[16] || '[]')),
              sla_due_at: params[17],
              metadata: JSON.parse(String(params[18] || '{}')),
              detected_at: '2026-03-06T10:00:00.000Z',
              acknowledged_at: null,
              acknowledged_by: null,
              acknowledgment_note: null,
              resolved_at: null,
              resolved_by: null,
              resolution_note: null,
              created_at: '2026-03-06T10:00:00.000Z',
              updated_at: '2026-03-06T10:00:00.000Z',
            },
          ];
        }
        if (sql.includes('COUNT(*)::int AS total') && sql.includes('post_visit_intravisit_alert_events')) {
          return [
            {
              total: 1,
              open_count: 1,
              acknowledged_open_count: 0,
              overdue_unacknowledged_count: 0,
              critical_open_count: 1,
              high_open_count: 0,
              moderate_open_count: 0,
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.analyzeIntraVisitAlerts(
      tenantDb,
      'session-1',
      {
        text: 'Patient reports chest pain and cannot breathe right now.',
        source: 'streamed_transcript',
        transcriptOffsetSeconds: 22,
      },
      { actorUserId: 'doctor-1' },
    );

    expect(result.featureEnabled).toBe(true);
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.summary.openCount).toBe(1);
    expect(result.alerts[0].severity).toBe('critical');
    expect(result.alerts[0].routeTarget).toBe('emergency');
  });

  it('transcribes a live audio chunk and feeds intra-visit alert analysis', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
    jest.spyOn(service as any, 'isIntraVisitAlertsEnabled').mockReturnValue(true);
    const analyzeSpy = jest.spyOn(service, 'analyzeIntraVisitAlerts').mockResolvedValue({
      featureEnabled: true,
      sessionId: 'session-1',
      analyzedAt: '2026-03-06T10:01:00.000Z',
      alerts: [{ id: 'intravisit-2', severity: 'critical' } as any],
      summary: {
        total: 1,
        openCount: 1,
        criticalOpenCount: 1,
        highOpenCount: 0,
        moderateOpenCount: 0,
      },
    } as any);

    transcriptionServiceMock.transcribe.mockResolvedValue({
      text: 'Patient says chest pain and cannot breathe now.',
      language: 'en',
      confidence: 0.9,
      segments: [{ start: 0, end: 2, text: 'Patient says chest pain and cannot breathe now.' }],
    });

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', status: 'draft_ready', source_type: 'in_person' }];
        }
        return [];
      }),
    } as any;

    const result = await service.analyzeIntraVisitAudioChunk(
      tenantDb,
      'session-1',
      {
        buffer: Buffer.from('audio-chunk'),
        originalname: 'chunk.webm',
        mimetype: 'audio/webm',
      } as Express.Multer.File,
      {
        language: 'en',
        source: 'browser_live_stream',
        transcriptOffsetSeconds: 18,
      },
      {
        tenantId: 'tenant-a',
        authorization: 'Bearer token',
        actorUserId: 'doctor-1',
      },
    );

    expect(transcriptionServiceMock.transcribe).toHaveBeenCalled();
    expect(analyzeSpy).toHaveBeenCalledWith(
      tenantDb,
      'session-1',
      expect.objectContaining({
        text: 'Patient says chest pain and cannot breathe now.',
      }),
      expect.objectContaining({
        actorUserId: 'doctor-1',
      }),
    );
    expect(result.alerts).toHaveLength(1);
  });

  it('confirms an intra-visit alert with clinician resolution metadata', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', status: 'draft_ready', source_type: 'in_person' }];
        }
        if (sql.includes('FROM post_visit_intravisit_alert_events') && sql.includes('LIMIT 1')) {
          return [
            {
              id: 'intravisit-1',
              session_id: 'session-1',
              status: 'open',
            },
          ];
        }
        if (sql.includes('UPDATE post_visit_intravisit_alert_events')) {
          return [
            {
              id: 'intravisit-1',
              session_id: 'session-1',
              patient_id: 'patient-1',
              status: 'confirmed',
              alert_type: 'cardiorespiratory_emergency_signal',
              severity: 'critical',
              source: 'streamed_transcript',
              transcript_offset_seconds: 22,
              signal_text: 'Patient reports chest pain and cannot breathe right now.',
              alert_message: 'Potential cardiorespiratory emergency signal detected in live transcript.',
              suggested_action: 'Pause routine flow and activate emergency response pathway with immediate vital reassessment.',
              confidence: 0.94,
              trigger_terms: ['chest pain'],
              metadata: {},
              detected_at: '2026-03-06T10:00:00.000Z',
              resolved_at: '2026-03-06T10:02:00.000Z',
              resolved_by: 'doctor-1',
              resolution_note: 'Confirmed bedside risk.',
              created_at: '2026-03-06T10:00:00.000Z',
              updated_at: '2026-03-06T10:02:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.resolveIntraVisitAlert(
      tenantDb,
      'session-1',
      'intravisit-1',
      { status: 'confirmed', note: 'Confirmed bedside risk.' },
      { actorUserId: 'doctor-1' },
    );

    expect(result.status).toBe('confirmed');
    expect(result.resolvedBy).toBe('doctor-1');
    expect(result.resolutionNote).toBe('Confirmed bedside risk.');
  });

  it('acknowledges an open intra-visit alert and persists SLA acknowledgement metadata', async () => {
    const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions')) {
          return [{ id: 'session-1', patient_id: 'patient-1', status: 'draft_ready', source_type: 'in_person' }];
        }
        if (sql.includes('FROM post_visit_intravisit_alert_events') && sql.includes('LIMIT 1')) {
          return [
            {
              id: 'intravisit-2',
              session_id: 'session-1',
              status: 'open',
              acknowledged_at: null,
            },
          ];
        }
        if (sql.includes('UPDATE post_visit_intravisit_alert_events') && sql.includes('acknowledged_at = COALESCE')) {
          return [
            {
              id: 'intravisit-2',
              session_id: 'session-1',
              patient_id: 'patient-1',
              status: 'open',
              alert_type: 'severe_pain_signal',
              severity: 'high',
              route_target: 'doctor',
              assigned_role: 'doctor',
              assigned_user_id: 'doctor-1',
              assigned_team: 'Doctor Primary',
              policy_version: 'c3.v1',
              routing_rationale: 'High-severity signal routed to responsible doctor for expedited review.',
              source: 'streamed_transcript',
              transcript_offset_seconds: 12,
              signal_text: 'Pain score 9/10',
              alert_message: 'Severe pain score captured during encounter.',
              suggested_action: 'Run severe pain protocol with urgent reassessment and doctor intervention.',
              confidence: 0.79,
              trigger_terms: ['pain_score_9'],
              metadata: {},
              detected_at: '2026-03-06T10:00:00.000Z',
              sla_due_at: '2026-03-06T10:20:00.000Z',
              acknowledged_at: '2026-03-06T10:05:00.000Z',
              acknowledged_by: 'doctor-1',
              acknowledgment_note: 'Acknowledged from doctor intra-visit alert bar.',
              resolved_at: null,
              resolved_by: null,
              resolution_note: null,
              created_at: '2026-03-06T10:00:00.000Z',
              updated_at: '2026-03-06T10:05:00.000Z',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.acknowledgeIntraVisitAlert(
      tenantDb,
      'session-1',
      'intravisit-2',
      { note: 'Acknowledged from doctor intra-visit alert bar.' },
      { actorUserId: 'doctor-1' },
    );

    expect(result.status).toBe('open');
    expect(result.isAcknowledged).toBe(true);
    expect(result.acknowledgedBy).toBe('doctor-1');
  });

  it('askAboutSection extracts section content and calls grounded LLM with section scope', async () => {
    const groundedLlmServiceMock = {
      answerPatientQuestion: jest.fn(async () => ({
        answer: 'The assessment indicates stable angina.',
        citationsUsed: [],
        model: 'gpt-4o-mini',
        abstained: false,
        urgentSignal: false,
      })),
    };
    const service = new PostVisitService(
      transcriptionServiceMock as any,
      patientServiceMock as any,
      undefined,
      undefined,
      undefined,
      groundedLlmServiceMock as any,
    );

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT * FROM post_visit_sessions') && sql.includes('id = $1')) {
          return [{ id: 'session-1', patient_id: 'patient-1', status: 'draft_ready' }];
        }
        if (sql.includes('post_visit_draft_artifacts') && sql.includes('artifact_type = $2')) {
          if (params[1] === 'visit_summary') {
            return [
              {
                id: 'art-1',
                artifact_type: 'visit_summary',
                content: {
                  plain_language_summary: 'Patient seen for chest pain.',
                  assessment: 'Stable angina. Continue current medications.',
                  plan: 'Follow up in 2 weeks.',
                },
                citations: [],
              },
            ];
          }
          if (params[1] === 'recommendation_bundle') {
            return [{ id: 'rec-1', content: { items: [] }, citations: [] }];
          }
        }
        return [];
      }),
    } as any;

    const result = await service.askAboutSection(
      'session-1',
      { question: 'What does the assessment say?', sectionType: 'assessment' },
      tenantDb,
    );

    expect(result.answer).toBe('The assessment indicates stable angina.');
    expect(result.abstained).toBe(false);
    expect(groundedLlmServiceMock.answerPatientQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        question: 'What does the assessment say?',
        sectionType: 'assessment',
        sectionContent: 'Stable angina. Continue current medications.',
      }),
    );
  });

  it('askAboutSection returns abstained when no artifact found', async () => {
    const service = new PostVisitService(
      transcriptionServiceMock as any,
      patientServiceMock as any,
    );

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM post_visit_sessions') && sql.includes('id = $1')) {
          return [{ id: 'session-1' }];
        }
        if (sql.includes('post_visit_draft_artifacts')) {
          return [];
        }
        return [];
      }),
    } as any;

    const result = await service.askAboutSection(
      'session-1',
      { question: 'What is the plan?', sectionType: 'plan' },
      tenantDb,
    );

    expect(result.answer).toContain('No summary artifact found');
    expect(result.abstained).toBe(true);
  });

  // F11 (S269) — routeEscalationToWorkflow previously returned a workflowKey
  // unconditionally even when the INSERT failed, creating a "ghost workflow"
  // reference. Must now return null and log the failure instead.
  describe('routeEscalationToWorkflow', () => {
    it('returns null and logs an error when the workflow-state insert fails', async () => {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const errorSpy = jest.spyOn((service as any).logger, 'error');
      const tenantDb = {
        query: jest.fn().mockRejectedValue(new Error('constraint violation')),
      } as any;

      const result = await (service as any).routeEscalationToWorkflow(tenantDb, {
        escalationId: 'esc-1',
        sessionId: 'session-1',
        patientId: 'patient-1',
        routeTarget: 'doctor',
        severity: 'high',
      });

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('esc-1'));
    });

    it('returns the workflowKey when the insert succeeds', async () => {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const tenantDb = {
        query: jest.fn().mockResolvedValue(undefined),
      } as any;

      const result = await (service as any).routeEscalationToWorkflow(tenantDb, {
        escalationId: 'esc-1',
        sessionId: 'session-1',
        patientId: 'patient-1',
        routeTarget: 'doctor',
        severity: 'high',
      });

      expect(result).toEqual(expect.stringContaining('post_visit_escalation:esc-1:'));
    });
  });
});
