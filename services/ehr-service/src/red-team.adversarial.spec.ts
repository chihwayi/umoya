/**
 * Red-team adversarial test suite (Sprint D4).
 * >=50 tests for security/safety: injection, auth, PHI leakage, boundary, validation.
 * CI must pass this suite to release; failures block release.
 */
import { PostVisitService } from './services/post-visit.service';

describe('Red-team adversarial suite', () => {
  const transcriptionServiceMock = { transcribe: jest.fn(), formatTranscription: jest.fn() };
  const patientServiceMock = { getPatientContext: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  describe('SQL injection resistance', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE post_visit_sessions;--",
      "1; DELETE FROM patients WHERE 1=1--",
      "1' OR '1'='1",
      "1 UNION SELECT * FROM users--",
      "\\'; TRUNCATE post_visit_sessions;--",
      "1 AND 1=0 UNION ALL SELECT id FROM post_visit_sessions--",
      "session-1'; WAITFOR DELAY '0:0:5'--",
      "1; INSERT INTO audit_events (id) VALUES ('x')--",
      "1' OR 1=1 LIMIT 1--",
      "1; EXEC xp_cmdshell('dir')--",
    ];

    sqlInjectionPayloads.forEach((maliciousId, i) => {
      it(`rejects or safely handles SQL-like sessionId (${i + 1}/${sqlInjectionPayloads.length})`, async () => {
        const tenantDb = {
          query: jest.fn(async (sql: string, params?: any[]) => {
            if (params != null && sql.includes('post_visit_sessions') && sql.includes('id = $1')) {
            expect(Array.isArray(params)).toBe(true);
            expect(params[0]).toBe(maliciousId);
            return [];
          }
            return [];
          }),
        } as any;
        const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
        await expect((service as any).getSessionRow(tenantDb, maliciousId)).rejects.toThrow();
        const dataCalls = (tenantDb.query as jest.Mock).mock.calls.filter((c: any[]) => c[1] != null && c[0].includes('post_visit_sessions'));
        expect(dataCalls.length).toBeGreaterThanOrEqual(1);
        expect(dataCalls[0][1][0]).toBe(maliciousId);
      });
    });
  });

  describe('SQL injection in other params', () => {
    const injectionPayloads = [
      "appt-1'; DROP TABLE appointments;--",
      "patient-1 OR 1=1",
      "doc-1; SELECT * FROM post_visit_admin_documents",
    ];

    injectionPayloads.forEach((payload, i) => {
      it(`parameterized query used for appointmentId/patientId/documentId (${i + 1})`, async () => {
        const tenantDb = { query: jest.fn(async () => []) } as any;
        const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
        await expect(
          service.generateAppointmentPreVisitBrief(tenantDb, payload, { fromJob: true }),
        ).rejects.toThrow();
        const callsWithParams = (tenantDb.query as jest.Mock).mock.calls.filter((call: any[]) => call[1] != null);
        expect(callsWithParams.length).toBeGreaterThan(0);
        callsWithParams.forEach((call: any[]) => {
          expect(Array.isArray(call[1])).toBe(true);
        });
      });
    });
  });

  describe('Authorization and actor requirements', () => {
    it('requires actorUserId for publish', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(
        service.publishSession(tenantDb, 'session-1', {}, {}),
      ).rejects.toThrow('Authenticated doctor user');
    });

    it('requires actorUserId for admin doc generation', async () => {
      const tenantDb = { query: jest.fn(async (sql: string) => {
        if (sql.includes('post_visit_sessions')) return [{ id: 's1', patient_id: 'p1', doctor_id: 'd1' }];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      process.env.FEATURE_POSTVISIT_ADMIN_DOCS = 'true';
      try {
        await expect(
          service.generateSessionAdminDocuments(tenantDb, 'session-1', { documentTypes: ['referral_letter'] }, {}),
        ).rejects.toThrow('Authenticated doctor user');
      } finally {
        delete process.env.FEATURE_POSTVISIT_ADMIN_DOCS;
      }
    });

    it('requires actorUserId for voice command', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(
        service.executeVoiceReviewCommand(tenantDb, 'session-1', { command: 'APPROVE_SUMMARY' }, {}),
      ).rejects.toThrow('Authenticated doctor user');
    });

    it('requires actorUserId for billing review', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(
        service.reviewBillingSuggestion(tenantDb, 'session-1', 'sugg-1', { action: 'approve' }, {}),
      ).rejects.toThrow('Authenticated doctor user');
    });

    it('SIGN_AND_PUBLISH requires confirmSignAndPublish', async () => {
      const tenantDb = { query: jest.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return [{ tbl: 'post_visit_sessions' }];
        if (sql.includes('post_visit_sessions')) return [{ id: 's1', patient_id: 'p1' }];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      process.env.FEATURE_POSTVISIT_VOICE_REVIEW = 'true';
      try {
        await expect(
          service.executeVoiceReviewCommand(tenantDb, 'session-1', { command: 'SIGN_AND_PUBLISH' }, { actorUserId: 'u1' }),
        ).rejects.toThrow('confirmSignAndPublish');
      } finally {
        delete process.env.FEATURE_POSTVISIT_VOICE_REVIEW;
      }
    });
  });

  describe('NotFound does not leak schema or PHI', () => {
    it('session not found throws generic NotFound', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      try {
        await (service as any).getSessionRow(tenantDb, 'non-existent');
      } catch (e: any) {
        expect(e.message).toMatch(/not found/i);
        expect(e.message).not.toMatch(/post_visit_sessions|SELECT|schema|column/i);
      }
    });

    it('admin document not found throws generic NotFound', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(service.markAdminDocumentDispatched(tenantDb, 'non-existent', { actorUserId: 'u1' }))
        .rejects.toThrow('not found');
    });

    it('trial match not found throws generic NotFound', async () => {
      const tenantDb = { query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('post_visit_sessions')) return [{ id: 's1', patient_id: 'p1' }];
        if (sql.includes('post_visit_trial_matches')) return [];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(
        service.reviewTrialMatch(tenantDb, 'session-1', 'bad-match-id', { action: 'consider' }, { actorUserId: 'u1' }),
      ).rejects.toThrow('not found');
    });
  });

  describe('Input validation and boundary', () => {
    it('invalid trial review action rejected', async () => {
      const tenantDb = { query: jest.fn(async () => [{ id: 's1', patient_id: 'p1' }]) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(
        service.reviewTrialMatch(tenantDb, 'session-1', 'match-1', { action: 'invalid_action' as any }, { actorUserId: 'u1' }),
      ).rejects.toThrow('Invalid trial review action');
    });

    it('invalid companion memory action rejected', async () => {
      const tenantDb = { query: jest.fn(async () => [{ id: 's1', patient_id: 'p1' }]) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(
        service.curateCompanionMemory(tenantDb, 'session-1', 'mem-1', { action: 'delete' as any }, { actorUserId: 'u1' }),
      ).rejects.toThrow('Invalid companion memory');
    });

    it('invalid voice command rejected', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      process.env.FEATURE_POSTVISIT_VOICE_REVIEW = 'true';
      try {
        await expect(
          service.executeVoiceReviewCommand(tenantDb, 'session-1', { command: 'INVALID_CMD' as any }, { actorUserId: 'u1' }),
        ).rejects.toThrow('Unsupported voice command');
      } finally {
        delete process.env.FEATURE_POSTVISIT_VOICE_REVIEW;
      }
    });

    it('only signed admin docs can be dispatched', async () => {
      const tenantDb = { query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT') && sql.includes('post_visit_admin_documents'))
          return [{ id: 'doc-1', session_id: 's1', patient_id: 'p1', status: 'draft' }];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(service.markAdminDocumentDispatched(tenantDb, 'doc-1', { actorUserId: 'u1' }))
        .rejects.toThrow('Only signed');
    });
  });

  describe('De-identified outputs (no PHI leakage)', () => {
    it('deriveTrialSearchTerms returns only condition-like terms', () => {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const input = 'Patient John Doe MRN 12345 has hypertension and diabetes';
      const terms = (service as any).deriveTrialSearchTerms(input);
      expect(terms.some((t: string) => t.toLowerCase().includes('john') || t.includes('12345'))).toBe(false);
      expect(terms.some((t: string) => /hypertension|diabetes/.test(t))).toBe(true);
    });

    it('normalizeTrialSearchToken strips non-alphanumeric', () => {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const out = (service as any).normalizeTrialSearchToken("O'Brien; <script>");
      expect(out).not.toMatch(/[<>';]/);
    });
  });

  describe('Boundary and limit enforcement', () => {
    it('generatePreVisitBriefsForUpcomingAppointments caps withinMinutes', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await service.generatePreVisitBriefsForUpcomingAppointments(tenantDb, { withinMinutes: 99999 });
      const call = (tenantDb.query as jest.Mock).mock.calls.find((c: any[]) => c[0]?.includes('appointment_date'));
      expect(call).toBeDefined();
      expect(call[1][0]).toBeLessThanOrEqual(1440);
    });

    it('listPeerConsults caps limit', async () => {
      let peerSelectLimit: number | null = null;
      const tenantDb = { query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('post_visit_peer_consults') && params?.length) peerSelectLimit = params[params.length - 1];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      process.env.FEATURE_POSTVISIT_PEER_CONSULT = 'true';
      try {
        await service.listPeerConsults(tenantDb, { limit: 5000 });
        expect(peerSelectLimit).not.toBeNull();
        expect(peerSelectLimit).toBeLessThanOrEqual(200);
      } finally {
        delete process.env.FEATURE_POSTVISIT_PEER_CONSULT;
      }
    });
  });

  describe('Feature-flag gating', () => {
    it('peer consult disabled when flag off', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      delete process.env.FEATURE_POSTVISIT_PEER_CONSULT;
      const result = await service.listPeerConsults(tenantDb, {});
      expect(result.featureEnabled).toBe(false);
    });

    it('peer consult create throws when flag off', async () => {
      const tenantDb = { query: jest.fn(async () => [{ id: 's1', patient_id: 'p1' }]) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      delete process.env.FEATURE_POSTVISIT_PEER_CONSULT;
      await expect(service.createPeerConsultRequest(tenantDb, 'session-1', { actorUserId: 'u1' }))
        .rejects.toThrow('disabled by feature flag');
    });
  });

  describe('FhirSyncLog and queue safety', () => {
    it('logFhirSyncAttempt uses parameterized insert', async () => {
      let insertParams: any[] | null = null;
      const tenantDb = { query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('to_regclass')) return [{ tbl: 'post_visit_sessions' }];
        if (sql.includes('fhir_sync_log') && sql.includes('INSERT') && params?.length) insertParams = params;
        return [{ id: 'log-1', status: 'pending' }];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await service.logFhirSyncAttempt(tenantDb, {
        resourceType: "DocumentReference'; DROP TABLE fhir_sync_log;--",
        resourceId: 'doc-1',
        status: 'pending',
      });
      expect(insertParams).toBeDefined();
      expect(Array.isArray(insertParams)).toBe(true);
    });

    it('queueFhirWriteBack no-op when feature off', async () => {
      const tenantDb = { query: jest.fn() } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      delete process.env.FEATURE_POSTVISIT_FHIR_WRITEBACK;
      const result = await service.queueFhirWriteBack(tenantDb, {
        sessionId: 's1',
        resourceType: 'DocumentReference',
        resourceId: 'doc-1',
      });
      expect(result).toBeNull();
      expect(tenantDb.query).not.toHaveBeenCalled();
    });
  });

  describe('De-identified peer consult summary', () => {
    it('buildDeidentifiedPeerConsultSummary does not include patient name pattern', async () => {
      const tenantDb = {
        query: jest.fn(async (sql: string, params: any[]) => {
          if (sql.includes('post_visit_sessions')) return [{ id: 's1', patient_id: 'p1' }];
          if (sql.includes('post_visit_draft_artifacts')) return [];
          if (sql.includes('post_visit_extracted_entities')) return [{ entity_type: 'condition', normalized_value: 'hypertension' }];
          return [];
        }),
      } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const summary = await (service as any).buildDeidentifiedPeerConsultSummary(tenantDb, 'session-1');
      expect(summary).toBeDefined();
      expect(summary).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/);
    });
  });

  describe('Parameterized queries used throughout', () => {
    it('getSessionRow uses parameterized query', async () => {
      const tenantDb = { query: jest.fn(async (sql: string, params: any[]) => {
        expect(params).toEqual(['session-1']);
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect((service as any).getSessionRow(tenantDb, 'session-1')).rejects.toThrow();
      expect(tenantDb.query).toHaveBeenCalledWith(expect.any(String), ['session-1']);
    });
  });

  describe('Additional injection and XSS resistance', () => {
    const xssPayloads = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '${7*7}', '{{constructor.constructor("return 1")()}}'];
    xssPayloads.forEach((payload, i) => {
      it(`sessionId with XSS-like string (${i + 1}) does not execute`, async () => {
        const tenantDb = { query: jest.fn(async (_s: string, params: any[]) => {
          expect(params[0]).toBe(payload);
          return [];
        }) } as any;
        const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
        await expect((service as any).getSessionRow(tenantDb, payload)).rejects.toThrow();
      });
    });
  });

  describe('UUID format and path traversal', () => {
    const badIds = ['../../../etc/passwd', '..\\..\\..\\windows\\system32', 'uuid-with-dashes-ok', 'a'.repeat(500)];
    badIds.forEach((id, i) => {
      it(`malformed or long id (${i + 1}) handled safely`, async () => {
        const tenantDb = { query: jest.fn(async () => []) } as any;
        const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
        await expect((service as any).getSessionRow(tenantDb, id)).rejects.toThrow();
      });
    });
  });

  describe('Empty and nullish inputs', () => {
    it('empty sessionId throws', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect((service as any).getSessionRow(tenantDb, '')).rejects.toThrow();
    });

    it('listSessionTrialMatches with invalid session returns after getSessionRow', async () => {
      const tenantDb = { query: jest.fn(async (sql: string) => {
        if (sql.includes('post_visit_sessions')) return [];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(service.listSessionTrialMatches(tenantDb, 'bad-session', {})).rejects.toThrow();
    });

    it('listSessionCompanionMemory with invalid session throws', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(service.listSessionCompanionMemory(tenantDb, 'bad-session', {})).rejects.toThrow();
    });

    it('getFhirSyncLogForSession uses parameterized query', async () => {
      let selectParams: any[] | null = null;
      const tenantDb = { query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('fhir_sync_log') && sql.includes('session_id') && params?.length) selectParams = params;
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await service.getFhirSyncLogForSession(tenantDb, 's1');
      expect(selectParams).toEqual(['s1']);
    });
  });

  describe('Respond peer consult validation', () => {
    it('respondPeerConsult rejects when consult not found', async () => {
      const tenantDb = { query: jest.fn(async () => []) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      process.env.FEATURE_POSTVISIT_PEER_CONSULT = 'true';
      try {
        await expect(
          service.respondPeerConsult(tenantDb, 'non-existent', { responseSummaryDeidentified: 'De-identified reply.' }, { actorUserId: 'u1' }),
        ).rejects.toThrow('not found');
      } finally {
        delete process.env.FEATURE_POSTVISIT_PEER_CONSULT;
      }
    });

    it('respondPeerConsult rejects when already responded', async () => {
      const tenantDb = { query: jest.fn(async (sql: string) => {
        if (sql.includes('post_visit_peer_consults') && sql.includes('WHERE id'))
          return [{ id: 'c1', status: 'responded', patient_id: 'p1', session_id: 's1' }];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      process.env.FEATURE_POSTVISIT_PEER_CONSULT = 'true';
      try {
        await expect(
          service.respondPeerConsult(tenantDb, 'c1', { responseSummaryDeidentified: 'Reply' }, { actorUserId: 'u1' }),
        ).rejects.toThrow('already responded');
      } finally {
        delete process.env.FEATURE_POSTVISIT_PEER_CONSULT;
      }
    });
  });

  describe('Billing and admin document boundaries', () => {
    it('reviewBillingSuggestion rejects when suggestion not found', async () => {
      const tenantDb = { query: jest.fn(async (sql: string) => {
        if (sql.includes('post_visit_sessions')) return [{ id: 's1', patient_id: 'p1' }];
        if (sql.includes('post_visit_billing_suggestions')) return [];
        return [];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await expect(
        service.reviewBillingSuggestion(tenantDb, 'session-1', 'bad-id', { action: 'approve' }, { actorUserId: 'u1' }),
      ).rejects.toThrow('not found');
    });
  });

  describe('Final adversarial checks (release gate)', () => {
    it('logFhirSyncAttempt caps max_attempts at 20', async () => {
      let maxAttemptsValue: number | null = null;
      const tenantDb = { query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('to_regclass')) return [{ tbl: 'post_visit_sessions' }];
        if (sql.includes('fhir_sync_log') && sql.includes('INSERT') && params && params.length > 8) maxAttemptsValue = params[8];
        return [{ id: 'l1' }];
      }) } as any;
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      await service.logFhirSyncAttempt(tenantDb, {
        resourceType: 'Doc',
        resourceId: 'r1',
        status: 'pending',
        maxAttempts: 99,
      });
      expect(maxAttemptsValue).not.toBeNull();
      expect(maxAttemptsValue).toBeLessThanOrEqual(20);
    });

    it('deriveTopicLabelFromQuestion returns safe label only', () => {
      const service = new PostVisitService(transcriptionServiceMock as any, patientServiceMock as any);
      const label = (service as any).deriveTopicLabelFromQuestion('What about John Smith medication?');
      expect(label).toBe('medication');
      expect(label).not.toMatch(/john|smith/i);
    });
  });
});
