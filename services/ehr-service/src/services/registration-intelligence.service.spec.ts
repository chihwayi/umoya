import { RegistrationIntelligenceService } from './registration-intelligence.service';

describe('RegistrationIntelligenceService', () => {
  const buildMedicalAidApiService = (result: any) => ({
    verifyMember: jest.fn().mockResolvedValue(result),
  });
  const buildCdssService = (result: any) => ({
    analyzeRegistrationDocument: jest.fn().mockResolvedValue(result),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects high-confidence duplicate patient candidates from demographics and identifiers', async () => {
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'patient-1',
          patient_number: 'P001',
          first_name: 'Jane',
          last_name: 'Doe',
          date_of_birth: '1990-01-10',
          gender: 'female',
          phone: '+263771111111',
          email: 'jane@example.com',
          id_number: '63-123456-A-63',
          medical_aid_number: 'CIM123456',
        },
      ]),
    } as any;

    const service = new RegistrationIntelligenceService();
    const result = await service.findDuplicateCandidates(tenantDb, {
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-10',
      gender: 'female',
      phone: '0771111111',
      nationalId: '63-123456-A-63',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        patientId: 'patient-1',
        patientNumber: 'P001',
      }),
    );
    expect(result[0].matchScore).toBeGreaterThanOrEqual(0.8);
    expect(result[0].reasons).toContain('exact_national_id_match');
    expect(result[0].reasons).toContain('exact_dob_match');
  });

  it('extracts structured insurance-card fields from text documents without external OCR', async () => {
    const service = new RegistrationIntelligenceService();
    const tenantDb = { query: jest.fn() } as any;

    const result = await service.extractRegistrationDocument(
      tenantDb,
      {
        originalname: 'cimas-card.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('Medical Aid: CIMAS\nMember Number: ABC123456\nPlan: Executive'),
        size: 64,
      } as any,
      { documentType: 'insurance_card' },
      { persist: false },
    );

    expect(result.extractionStatus).toBe('processed');
    expect(result.ocr).toEqual(
      expect.objectContaining({
        engine: 'native_text_decode',
        confidence: 1,
      }),
    );
    expect(result.structuredPayload).toEqual(
      expect.objectContaining({
        providerName: 'CIMAS',
        memberNumber: 'ABC123456',
        planName: 'Executive',
      }),
    );
  });

  it('extracts richer referral-letter fields including urgency, specialty, investigations, and follow-up window', async () => {
    const service = new RegistrationIntelligenceService();
    const tenantDb = { query: jest.fn() } as any;

    const result = await service.extractRegistrationDocument(
      tenantDb,
      {
        originalname: 'referral.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from(
          [
            'Referred by: Dr Nyathi',
            'Facility: Mpilo Central Hospital',
            'Diagnosis: Breast lump',
            'Reason for referral: Evaluate suspicious breast mass',
            'Requested specialty: Oncology',
            'Urgency: Urgent',
            'Please arrange ultrasound and biopsy within 2 weeks.',
          ].join('\n'),
        ),
        size: 240,
      } as any,
      { documentType: 'referral_letter' },
      { persist: false },
    );

    expect(result.structuredPayload).toEqual(
      expect.objectContaining({
        referredBy: 'Dr Nyathi',
        referringFacility: 'Mpilo Central Hospital',
        diagnosis: 'Breast lump',
        requestedSpecialty: 'Oncology',
        urgency: 'Urgent',
        requestedInvestigations: expect.arrayContaining(['ultrasound', 'biopsy']),
        requestedFollowUpWindow: 'within 2 weeks',
      }),
    );
  });

  it('merges governed registration-document intelligence into local referral extraction results', async () => {
    const cdssService = buildCdssService({
      documentType: 'referral_letter',
      structuredPayload: {
        requestedSpecialty: 'Oncology',
        referringClinician: 'Dr Nyathi',
        medicationCandidates: ['Tamoxifen'],
      },
      summary: 'Urgent oncology referral with medication context.',
      flags: ['document_type:referral_letter', 'llm_enhanced'],
      confidence: 0.88,
      governance: { governed_path: true, use_case: 'registration_document_intelligence' },
    });
    const service = new RegistrationIntelligenceService(undefined, undefined, cdssService as any);
    const tenantDb = { query: jest.fn() } as any;

    const result = await service.extractRegistrationDocument(
      tenantDb,
      {
        originalname: 'referral.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from(
          [
            'Referred by: Dr Nyathi',
            'Diagnosis: Breast lump',
            'Please arrange biopsy within 2 weeks.',
          ].join('\n'),
        ),
        size: 120,
      } as any,
      { documentType: 'referral_letter', tenantId: 'tenant-a' },
      { persist: false },
    );

    expect(cdssService.analyzeRegistrationDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'referral_letter',
        fileName: 'referral.txt',
      }),
      'tenant-a',
      tenantDb,
    );
    expect(result.structuredPayload).toEqual(
      expect.objectContaining({
        requestedSpecialty: 'Oncology',
        referringClinician: 'Dr Nyathi',
        medicationCandidates: expect.arrayContaining(['Tamoxifen']),
        requestedInvestigations: expect.arrayContaining(['biopsy']),
      }),
    );
    expect(result.extractionSummary).toBe('Urgent oncology referral with medication context.');
    expect(result.governance).toEqual(
      expect.objectContaining({
        governed_path: true,
      }),
    );
  });

  it('scores intake completeness and coverage risk, and summarizes missing consent items', async () => {
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'patient-2',
          patient_number: 'P002',
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: '1990-01-10',
          gender: 'male',
          phone: '0772000000',
          email: 'jon@example.com',
          id_number: null,
          medical_aid_number: null,
        },
      ]),
    } as any;

    const service = new RegistrationIntelligenceService();
    const result = await service.assessRegistrationIntake(
      tenantDb,
      {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-10',
        gender: 'male',
        phone: '',
        email: '',
        address: '',
        insuranceProvider: 'Cimas',
        insuranceNumber: '123',
      },
      { persist: false },
    );

    expect(result.completenessScore).toBeLessThan(80);
    expect(result.missingFields).toContain('contactMethod');
    expect(result.missingFields).toContain('address');
    expect(result.coverageRiskLevel).toBe('high');
    expect(result.coverageFlags).toContain('member_number_too_short');
    expect(result.consentReady).toBe(false);
    expect(result.consentMissingItems).toContain('emergency_contact_name');
    expect(result.suspectedDuplicateCount).toBe(1);
    expect(result.frontDeskSummary).toContain('possible duplicate');
  });

  it('lists duplicate-review queue items with subject and candidate patient metadata', async () => {
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'match-1',
          source_type: 'registration_intake',
          source_reference: 'assessment-1',
          subject_patient_id: 'subject-1',
          candidate_patient_id: 'candidate-1',
          match_score: '0.88',
          match_reasons: ['exact_phone_match'],
          match_signals: { phone: 'exact' },
          match_status: 'suggested',
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-03-24T18:00:00.000Z',
          candidate_patient_number: 'P004',
          candidate_first_name: 'Jane',
          candidate_last_name: 'Moyo',
          subject_patient_number: 'P001',
          subject_first_name: 'Tariro',
          subject_last_name: 'Moyo',
        },
      ]),
    } as any;

    const service = new RegistrationIntelligenceService();
    const result = await service.listDuplicateReviewQueue(tenantDb, { sourceReference: 'assessment-1' });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'match-1',
        sourceReference: 'assessment-1',
        matchStatus: 'suggested',
        subjectPatient: expect.objectContaining({ patientNumber: 'P001' }),
        candidatePatient: expect.objectContaining({ patientNumber: 'P004' }),
      }),
    ]);
  });

  it('reviews duplicate suggestions and persists reviewer metadata', async () => {
    const tenantDb = {
      query: jest.fn()
        .mockResolvedValueOnce([{ id: 'match-1' }])
        .mockResolvedValueOnce([
          {
            id: 'match-1',
            source_type: 'registration_intake',
            source_reference: 'assessment-1',
            subject_patient_id: 'subject-1',
            candidate_patient_id: 'candidate-1',
            match_score: '0.88',
            match_reasons: ['exact_phone_match'],
            match_signals: { phone: 'exact' },
            match_status: 'confirmed_duplicate',
            reviewed_by: 'user-1',
            reviewed_at: '2026-03-24T18:05:00.000Z',
            created_at: '2026-03-24T18:00:00.000Z',
            candidate_patient_number: 'P004',
            candidate_first_name: 'Jane',
            candidate_last_name: 'Moyo',
            subject_patient_number: 'P001',
            subject_first_name: 'Tariro',
            subject_last_name: 'Moyo',
          },
        ]),
    } as any;

    const service = new RegistrationIntelligenceService();
    const result = await service.reviewDuplicateCandidate(
      tenantDb,
      'match-1',
      { matchStatus: 'confirmed_duplicate' },
      'user-1',
    );

    expect(tenantDb.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE patient_identity_matches'),
      ['match-1', 'confirmed_duplicate', 'user-1'],
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'match-1',
        matchStatus: 'confirmed_duplicate',
        reviewedBy: 'user-1',
      }),
    );
  });

  it('persists live eligibility verification results into insurance_eligibility_checks', async () => {
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'eligibility-1',
          patient_id: 'patient-1',
          provider_name: 'cimas',
          member_number: 'med1001',
          plan_name: 'Executive',
          status: 'verified_active',
          confidence: '0.9800',
          coverage_flags: [],
          checked_at: '2026-03-24T19:00:00.000Z',
          request_payload: { source: 'registration_intelligence', verificationMode: 'live_api' },
          response_payload: { valid: true, memberDetails: { memberName: 'Jane Doe', plan: 'Executive' } },
        },
      ]),
    } as any;

    const medicalAidApiService = buildMedicalAidApiService({
      valid: true,
      memberDetails: {
        memberName: 'Jane Doe',
        plan: 'Executive',
        scheme: 'Cimas',
      },
    });

    const service = new RegistrationIntelligenceService(undefined, medicalAidApiService as any);
    const result = await service.verifyInsuranceEligibility(
      tenantDb,
      {
        patientId: 'patient-1',
        insuranceProvider: 'Cimas',
        insuranceNumber: 'MED-1001',
      },
      { persist: true, sourceAssessmentId: 'assessment-1', actorUserId: 'user-1' },
    );

    expect(medicalAidApiService.verifyMember).toHaveBeenCalledWith('Cimas', 'med1001', tenantDb);
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO insurance_eligibility_checks'),
      expect.arrayContaining([
        'patient-1',
        'Cimas',
        'med1001',
        'Executive',
        'verified_active',
      ]),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'eligibility-1',
        status: 'verified_active',
        planName: 'Executive',
        responsePayload: expect.objectContaining({
          valid: true,
        }),
      }),
    );
  });
});
