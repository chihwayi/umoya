import { CdssService } from './cdss.service';

describe('CdssService proxy routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('proxies getGuidelines to /guidelines/check with tenant context', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        guidelines: [{ title: 'Sepsis' }],
        recommendations: ['Start broad-spectrum antibiotics'],
        contraindications: [],
        medication_warnings: [],
        evidence_level: 'high',
        matched_condition: 'sepsis',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.getGuidelines(
      'sepsis',
      { age: 41, gender: 'female', comorbidities: ['hypertension'], specialty: 'acute_care', module: 'critical_care' },
      'tenant-a',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/guidelines/check',
      {
        condition: 'sepsis',
        patient_age: 41,
        patient_gender: 'female',
        comorbidities: ['hypertension'],
        medications: [],
        specialty: 'acute_care',
        module: 'critical_care',
      },
      {
        timeout: 10000,
        headers: { 'X-Tenant-ID': 'tenant-a' },
      },
    );
    expect(response.source).toBe('advanced_cdss');
  });

  it('proxies searchGuidelines to /guidelines/search with patient context and tenant', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        citations: [{ title: 'Sepsis Bundle', source: 'cdss_rag' }],
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.searchGuidelines(
      'sepsis first hour',
      3,
      { age: 60, pregnancy: false, specialty: 'acute_care', module: 'critical_care' },
      'tenant-b',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/guidelines/search',
      {
        query: 'sepsis first hour',
        limit: 3,
        patient_context: { age: 60, pregnancy: false, specialty: 'acute_care', module: 'critical_care' },
        specialty: 'acute_care',
        module: 'critical_care',
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-b' },
      },
    );
    expect(response.citations).toHaveLength(1);
  });

  it('proxies analyzeMedicalImage to /analyze-image with tenant header', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: { findings: ['No acute cardiopulmonary process'] },
    });
    (service as any).cdssClient = { post: postMock };

    const file = {
      buffer: Buffer.from('fake-image'),
      originalname: 'xray.png',
      mimetype: 'image/png',
    } as Express.Multer.File;

    const response = await service.analyzeMedicalImage(file, 'tenant-c');
    const callConfig = postMock.mock.calls[0]?.[2];

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0]?.[0]).toBe('/analyze-image');
    expect(callConfig?.timeout).toBe(45000);
    expect(callConfig?.headers?.['X-Tenant-ID']).toBe('tenant-c');
    expect(response.findings).toEqual(['No acute cardiopulmonary process']);
  });

  it('records abstention metric for abstained CDSS responses', async () => {
    const metricsMock = {
      recordCdssHook: jest.fn(),
      recordCdssHookError: jest.fn(),
      recordCdssRetry: jest.fn(),
      recordCdssTimeout: jest.fn(),
      recordCdssAbstention: jest.fn(),
    };
    const service = new CdssService(undefined, metricsMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        citations: [],
        abstained: true,
        abstain_reason: 'low_confidence',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    await service.searchGuidelines('ambiguous query', 3, { age: 50 }, 'tenant-z');
    expect(metricsMock.recordCdssAbstention).toHaveBeenCalledWith(
      'guidelines_search',
      'low_confidence',
      'tenant-z',
    );
  });

  it('classifies outbound allowlist blocks as egress_block errors', () => {
    const service = new CdssService(undefined, undefined);
    const errorType = (service as any).classifyCdssError({
      response: {
        data: {
          detail: 'Target host is not in CDSS allowlist',
        },
      },
    });
    expect(errorType).toBe('egress_block');
  });

  it('proxies patient adherence assistant calls to governed CDSS endpoint', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        reply: 'Please request a refill as soon as possible and contact your clinic if you may miss doses.',
        intent: 'refill_request',
        adherence_concern: true,
        requires_clinician_follow_up: false,
        urgency: 'routine',
        confidence: 0.9,
        model: 'patient_adherence_rules_v1',
        abstained: false,
        governance: { governed_path: true },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.patientAdherenceAssist(
      {
        patientId: 'patient-1',
        sessionId: 'session-1',
        message: 'I am running out of tablets',
        medications: ['Metformin'],
        history: [{ role: 'user', content: 'I forgot twice last week' }],
      },
      'tenant-c',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/patient/adherence-chat',
      {
        patient_id: 'patient-1',
        session_id: 'session-1',
        message: 'I am running out of tablets',
        medications: ['Metformin'],
        history: [{ role: 'user', content: 'I forgot twice last week' }],
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-c' },
      },
    );
    expect(response.intent).toBe('refill_request');
    expect(response.adherenceConcern).toBe(true);
    expect(response.governance).toEqual({ governed_path: true });
  });

  it('proxies patient symptom checks to dedicated governed symptom-check endpoint', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        differential: [{ condition: 'Malaria', probability: 0.4, urgency: 'urgent', nextStep: 'Rapid diagnostic test for malaria' }],
        triage_level: 'urgent',
        recommended_action: 'Rapid diagnostic test for malaria',
        confidence: 0.4,
        model: 'symptom_check_rules_v1',
        abstained: false,
        governance: { governed_path: true, phi_minimized: true },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.patientSymptomCheck(
      {
        symptoms: ['fever and chills'],
        durationDays: 2,
        severity: 'severe',
        patientContext: { age: 27 },
      },
      'tenant-s',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/symptom-check',
      {
        symptoms: ['fever and chills'],
        duration_days: 2,
        severity: 'severe',
        patient_context: { age: 27 },
      },
      {
        timeout: 12000,
        headers: { 'X-Tenant-ID': 'tenant-s' },
      },
    );
    expect(response.triageLevel).toBe('urgent');
    expect(response.model).toBe('symptom_check_rules_v1');
    expect(response.governance).toEqual({ governed_path: true, phi_minimized: true });
  });

  it('proxies governed JSON requests to the dedicated governed endpoint', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        json: { answer: 'Use the approved visit plan.' },
        model: 'governed-json-model',
        audit: { templateVersion: 'postvisit-answer-v1' },
        governance: { governed_path: true, use_case: 'post_visit_patient_answer' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.requestGovernedJson(
      {
        useCase: 'post_visit_patient_answer',
        schemaDescription: '{"answer":"string"}',
        templateVersion: 'postvisit-answer-v1',
        messages: [
          { role: 'system', content: 'Answer only from approved context.' },
          { role: 'user', content: 'What should I do next?' },
        ],
        sessionId: 'session-1',
        patientId: 'patient-1',
      },
      'tenant-postvisit',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/governed/json',
      {
        use_case: 'post_visit_patient_answer',
        schema_description: '{"answer":"string"}',
        messages: [
          { role: 'system', content: 'Answer only from approved context.' },
          { role: 'user', content: 'What should I do next?' },
        ],
        template_version: 'postvisit-answer-v1',
        temperature: 0.1,
        session_id: 'session-1',
        patient_id: 'patient-1',
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-postvisit' },
      },
    );
    expect(response.model).toBe('governed-json-model');
    expect(response.governance).toEqual({ governed_path: true, use_case: 'post_visit_patient_answer' });
  });

  it('forwards specialty and module into intelligent diagnosis patient_data', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        suggested_diagnoses: [{ diagnosis: 'Breast cancer', probability: 0.7, confidence: 'medium' }],
        recommended_tests: ['HER2 IHC'],
        red_flags: [],
        source: 'hybrid_cdss_ai',
        ai_enabled: true,
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    await service.diagnosisAssist(
      {
        symptoms: ['breast mass'],
        clinicalNotes: 'Patient with breast mass and HER2 amplification',
        age: 48,
        gender: 'female',
        conditions: ['breast cancer'],
        specialty: 'oncology',
        module: 'targeted_therapy',
      },
      true,
      'tenant-onc',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/diagnosis/suggest/intelligent',
      expect.objectContaining({
        patient_data: expect.objectContaining({
          specialty: 'oncology',
          module: 'targeted_therapy',
        }),
      }),
      expect.objectContaining({
        headers: { 'X-Tenant-ID': 'tenant-onc' },
      }),
    );
  });

  it('proxies patient education generation to governed education endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        content: 'Take this medicine with food and return urgently if you develop breathing difficulty.',
        topic: 'Asthma inhaler use',
        language: 'en',
        reading_level: 6,
        model: 'llama3.1:8b',
        governance: { governed_path: true, use_case: 'patient_education_generation' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.generatePatientEducation(
      {
        topic: 'Asthma inhaler use',
        language: 'en',
        reading_level: 6,
        patient_id: 'patient-edu-1',
        encounterId: 'enc-edu-1',
      },
      'tenant-edu',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/education/generate',
      {
        topic: 'Asthma inhaler use',
        language: 'en',
        reading_level: 6,
        patient_id: 'patient-edu-1',
        encounterId: 'enc-edu-1',
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-edu' },
      },
    );
    expect(response.content).toContain('Take this medicine');
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies SDOH screening through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        tool_used: 'prapare',
        positive_domains: [{ domain: 'food_insecurity', category: 'food_bank' }],
        z_codes: ['Z59.41'],
        overall_risk: 'moderate',
        referral_priority: 'routine',
        screening_complete: true,
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.screenSdohRisk(
      {
        patientId: 'patient-sdoh-1',
        tool: 'prapare',
        responses: {
          food: 'sometimes',
          housing: 'stable',
        },
      },
      'tenant-sdoh',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/sdoh/screen',
      {
        patientId: 'patient-sdoh-1',
        tool: 'prapare',
        responses: {
          food: 'sometimes',
          housing: 'stable',
        },
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-sdoh' },
      },
    );
    expect(response.overall_risk).toBe('moderate');
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies SDOH resource matching through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        recommended_categories: ['food_bank'],
        matches: [{ resource_id: 'res-1', name: 'Community Pantry', category: 'food_bank', score: 90 }],
        unmet_categories: [],
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.matchSdohResources(
      {
        patientId: 'patient-sdoh-1',
        positive_domains: [{ domain: 'food_insecurity', category: 'food_bank' }],
        requested_categories: ['food_bank'],
        available_resources: [{ id: 'res-1', name: 'Community Pantry', category: 'food_bank' }],
      },
      'tenant-sdoh',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/sdoh/resource/match',
      {
        patientId: 'patient-sdoh-1',
        positive_domains: [{ domain: 'food_insecurity', category: 'food_bank' }],
        requested_categories: ['food_bank'],
        available_resources: [{ id: 'res-1', name: 'Community Pantry', category: 'food_bank' }],
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-sdoh' },
      },
    );
    expect(response.matches).toHaveLength(1);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies clinical code extraction through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        suggestedIcd10Codes: [{ code: 'J18.9', description: 'Pneumonia', confidence: 0.81 }],
        suggestedCptCodes: [{ code: '71046', description: 'Chest x-ray', confidence: 0.72 }],
        model: 'llama3.1:8b',
        governance: { governed_path: true, use_case: 'clinical_code_extraction' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.extractClinicalCodes(
      {
        noteText: 'Chest x-ray and pneumonia treatment documented.',
        patientId: 'patient-code-1',
        noteId: 'note-code-1',
        encounterId: 'enc-code-1',
      },
      'tenant-code',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/nlp/extract-codes',
      {
        noteText: 'Chest x-ray and pneumonia treatment documented.',
        patientId: 'patient-code-1',
        noteId: 'note-code-1',
        encounterId: 'enc-code-1',
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-code' },
      },
    );
    expect(response.suggestedIcd10Codes).toHaveLength(1);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies IoT analysis through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        alerts: [{ type: 'spo2', severity: 'warning' }],
        reading_count: 1,
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.analyzeIotReadings(
      {
        patientId: 'patient-iot-1',
        readings: [{ type: 'spo2', value: 91, unit: '%', at: '2026-03-24T12:00:00Z' }],
      },
      'tenant-iot',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/iot/analyze',
      {
        patientId: 'patient-iot-1',
        readings: [{ type: 'spo2', value: 91, unit: '%', at: '2026-03-24T12:00:00Z' }],
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-iot' },
      },
    );
    expect(response.alerts).toHaveLength(1);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies scheduling prediction through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        no_show_probability: 0.44,
        cancel_probability: 0.16,
        recommended_duration: 45,
        confidence_score: 0.78,
        model: 'scheduling_rules_v1',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.predictSchedulingRisk(
      {
        appointmentId: 'apt-1',
        priorNoShows: 2,
        visitType: 'new',
      },
      'tenant-scheduling',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/scheduling/predict',
      {
        appointmentId: 'apt-1',
        priorNoShows: 2,
        visitType: 'new',
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-scheduling' },
      },
    );
    expect(response.recommended_duration).toBe(45);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies smart form defaults through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        defaults: {
          weight_based_dosing: { value: true, confidence: 0.95, source: 'cdss_rule' },
        },
        model: 'form_defaults_rules_v1',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.suggestFormDefaults(
      {
        formName: 'pediatric-intake',
        context: { age: 8, sex: 'female' },
      },
      'tenant-forms',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/forms/suggest-defaults',
      {
        formName: 'pediatric-intake',
        context: { age: 8, sex: 'female' },
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-forms' },
      },
    );
    expect(response.defaults.weight_based_dosing.value).toBe(true);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies empirical antimicrobial recommendations through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        recommendation: 'ceftriaxone',
        rationale: ['Urinary source pattern'],
        model: 'antimicrobial_rules_v1',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.recommendEmpiricalAntimicrobial(
      {
        syndrome: 'urinary tract infection',
        severity: 'moderate',
      },
      'tenant-abx',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/antimicrobial/empirical',
      {
        syndrome: 'urinary tract infection',
        severity: 'moderate',
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-abx' },
      },
    );
    expect(response.recommendation).toBe('ceftriaxone');
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies antimicrobial de-escalation through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        recommendation: 'ceftriaxone',
        action: 'deescalate',
        model: 'antimicrobial_rules_v1',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.recommendAntimicrobialDeescalation(
      {
        organism: 'E. coli',
        current_regimen: 'piperacillin-tazobactam',
        susceptibility: { ceftriaxone: 'S' },
      },
      'tenant-abx',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/antimicrobial/deescalate',
      {
        organism: 'E. coli',
        current_regimen: 'piperacillin-tazobactam',
        susceptibility: { ceftriaxone: 'S' },
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-abx' },
      },
    );
    expect(response.action).toBe('deescalate');
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies supply stockout prediction through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        seasonal_factor: 1.4,
        drug: 'Artemether-Lumefantrine',
        model: 'supply_stockout_rules_v1',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.predictSupplyStockout(
      {
        drugName: 'Artemether-Lumefantrine',
        currentStock: 120,
        avgDailyConsumption: 4,
        safetyStockDays: 20,
      },
      'tenant-supply',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/supply/stockout-predict',
      {
        drugName: 'Artemether-Lumefantrine',
        currentStock: 120,
        avgDailyConsumption: 4,
        safetyStockDays: 20,
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-supply' },
      },
    );
    expect(response.seasonal_factor).toBe(1.4);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('proxies model performance evaluation through governed endpoint with tenant audit context', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        auc_roc: 0.82,
        brier_score: 0.14,
        sensitivity: 0.8,
        specificity: 0.78,
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.evaluateModelPerformance(
      {
        modelName: 'readmission',
        period: '2026-03',
        outcomes: [{ predicted: 0.9, actual: 1 }],
      },
      'tenant-model',
      tenantDb,
    );

    expect(postMock).toHaveBeenCalledWith(
      '/model/performance',
      {
        modelName: 'readmission',
        period: '2026-03',
        outcomes: [{ predicted: 0.9, actual: 1 }],
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-model' },
      },
    );
    expect(response.auc_roc).toBe(0.82);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
  });

  it('records tenant-side prompt audit for intelligent diagnosis responses when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        suggested_diagnoses: [
          { diagnosis: 'Pneumonia', probability: 0.71, confidence: 0.8 },
        ],
        recommended_tests: ['Chest X-ray'],
        red_flags: ['tachypnea'],
        ai_enabled: true,
        model: 'intelligent_dx_v2',
        governance: { vendor_id: 'openai-governed' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.diagnosisAssist(
      {
        patientId: 'patient-1',
        encounterId: 'enc-1',
        symptoms: ['cough', 'fever'],
        chiefComplaint: 'cough and fever',
        age: 32,
        gender: 'female',
      },
      true,
      'tenant-dx',
      tenantDb,
    );

    expect(response.suggested_diagnoses).toHaveLength(1);
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        modelId: 'intelligent_dx_v2',
        provider: 'openai-governed',
      }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        modelId: 'intelligent_dx_v2',
        patientId: 'patient-1',
        encounterId: 'enc-1',
      }),
    );
  });

  it('records tenant-side prompt audit for nurse note summarization when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        summary: 'Patient is stable after intervention.',
        model: 'patient_summary_v3',
        governance: { vendor_id: 'anthropic-governed' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.generateNurseNoteDraft(
      {
        patientId: 'patient-22',
        encounterId: 'enc-22',
        chiefComplaint: 'Fever',
        observations: 'Alert and oriented',
        vitals: { temperature: 38.2 },
        age: 22,
        gender: 'female',
      },
      'tenant-note',
      tenantDb,
    );

    expect(response.draft).toContain('stable');
    expect(auditMock.registerModelEntry).toHaveBeenCalledTimes(1);
    expect(auditMock.logPromptAudit).toHaveBeenCalledTimes(1);
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        modelId: 'patient_summary_v3',
        provider: 'anthropic-governed',
      }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        modelId: 'patient_summary_v3',
        patientId: 'patient-22',
        encounterId: 'enc-22',
      }),
    );
  });

  it('records tenant-side prompt audit for ambient transcription stream when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        transcript: 'Patient reports chest pain.',
        entities: {
          diagnoses: [{ text: 'Chest pain', confidence: 0.8 }],
          medications: [],
          allergies: [],
          orders: [{ type: 'ecg', description: '12-lead ECG' }],
          vitals: [],
          alerts: [{ type: 'red_flag', message: 'Possible ACS', severity: 'high' }],
        },
        draft_note: { subjective: 'Chest pain started today.' },
        model: 'ambient_stream_v1',
        governance: { vendor_id: 'local' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.ambientTranscriptionStream(
      {
        sessionId: 'session-1',
        audioBase64: 'ZmFrZS1hdWRpbw==',
        context: { prior: 'note' },
        patientId: 'patient-7',
        appointmentId: 'appt-7',
      },
      'tenant-ambient',
      tenantDb,
    );

    expect(response.transcript).toContain('chest pain');
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ modelId: 'ambient_stream_v1' }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        modelId: 'ambient_stream_v1',
        patientId: 'patient-7',
        encounterId: 'appt-7',
      }),
    );
  });

  it('records tenant-side prompt audit for inbox triage when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        priority: 'urgent',
        priority_reason: 'Patient message contains possible emergency keywords.',
        triage_score: 70,
        triage_model: 'inbox_triage_v2',
        draft_reply: 'Please come to the clinic today.',
        governance: { vendor_id: 'local' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.triageInboxItem(
      {
        sourceType: 'patient_message',
        sourceId: 'msg-1',
        title: 'Urgent help',
        content: 'I have severe chest pain',
        patientId: 'patient-8',
      },
      'tenant-inbox',
      tenantDb,
    );

    expect(response.priority).toBe('urgent');
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ modelId: 'inbox_triage_v2' }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        modelId: 'inbox_triage_v2',
        patientId: 'patient-8',
      }),
    );
  });

  it('records tenant-side prompt audit for deterioration risk when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        score: 82,
        event_type: 'cardiac_arrest',
        timeframe_hours: 2,
        model: 'MEWS',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.predictDeteriorationRisk(
      {
        patientId: 'patient-risk',
        admissionId: 'adm-1',
        vitals: { spo2: 82, heart_rate: 132 },
      },
      'tenant-risk',
      tenantDb,
    );

    expect(response.score).toBe(82);
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ modelId: 'MEWS' }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        patientId: 'patient-risk',
        encounterId: 'adm-1',
      }),
    );
  });

  it('records tenant-side prompt audit for radiology analysis when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        findings: [{ label: 'Pneumothorax', severity: 'critical', confidence: 0.91 }],
        top_finding: 'Pneumothorax',
        confidence: 0.91,
        model_version: 'medicore-cxr-v1.0',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.analyzeRadiologyStudy(
      {
        studyId: 'study-1',
        patientId: 'patient-xray',
        modality: 'CXR',
        bodyPart: 'Chest',
        storageKey: 'studies/cxr-1.dcm',
      },
      'tenant-rad',
      tenantDb,
    );

    expect(response.top_finding).toBe('Pneumothorax');
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ modelId: 'medicore-cxr-v1.0' }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        patientId: 'patient-xray',
        encounterId: 'study-1',
      }),
    );
  });

  it('records tenant-side prompt audit for formulary optimization when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        recommendation: 'substitute_generic',
        generic_alternative: 'atorvastatin 20mg',
        saving_amount: 75,
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.optimizeFormulary(
      {
        patientId: 'patient-form',
        prescriptionId: 'rx-1',
        brandedDrug: 'Lipitor',
        diagnoses: ['hyperlipidaemia'],
      },
      'tenant-form',
      tenantDb,
    );

    expect(response.recommendation).toBe('substitute_generic');
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ modelId: 'formulary_optimize_proxy' }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        patientId: 'patient-form',
        encounterId: 'rx-1',
      }),
    );
  });

  it('records tenant-side prompt audit for PGx checks when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        drug: 'clopidogrel',
        alerts: [{ gene: 'CYP2C19', interaction: 'Reduced effect' }],
        safe: false,
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.checkPgx(
      {
        patientId: 'patient-pgx',
        drug: 'clopidogrel',
        cyp2c19: 'PM',
      },
      'tenant-pgx',
      tenantDb,
    );

    expect(response.safe).toBe(false);
    expect(auditMock.registerModelEntry).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ modelId: 'pgx_check_proxy' }),
    );
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        patientId: 'patient-pgx',
      }),
    );
  });

  it('records tenant-side prompt audit for dermatology lesion classification when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        urgency: 'urgent',
        biopsy_recommended: true,
        differentials: ['Melanoma'],
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.classifyDermatologyLesion(
      {
        patientId: 'patient-derm',
        morphology: 'nodule',
        location: 'sun_exposed',
        diameter_mm: 8,
      },
      'tenant-derm',
      tenantDb,
    );

    expect(response.urgency).toBe('urgent');
    expect(auditMock.registerModelEntry).toHaveBeenCalled();
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ patientId: 'patient-derm' }),
    );
  });

  it('records tenant-side prompt audit for nutrition prescribing when tenant DB is available', async () => {
    const auditMock = {
      registerModelEntry: jest.fn().mockResolvedValue(undefined),
      logPromptAudit: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {} as any;
    const service = new CdssService(undefined, undefined, auditMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        tee_kcal: 2100,
        protein_target_g: 72,
        route: 'oral',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.prescribeNutritionPlan(
      {
        patientId: 'patient-nutri',
        route: 'oral',
        weight_kg: 60,
        stress_factor: 'moderate',
      },
      'tenant-nutri',
      tenantDb,
    );

    expect(response.tee_kcal).toBe(2100);
    expect(auditMock.registerModelEntry).toHaveBeenCalled();
    expect(auditMock.logPromptAudit).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({ patientId: 'patient-nutri' }),
    );
  });

  it('proxies registration-document analysis to the governed intake endpoint', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        document_type: 'referral_letter',
        structured_payload: {
          requestedSpecialty: 'Oncology',
          urgency: 'Urgent',
        },
        summary: 'Urgent oncology referral.',
        flags: ['document_type:referral_letter'],
        confidence: 0.86,
        model: 'medicore-llm',
        governance: { governed_path: true, use_case: 'registration_document_intelligence' },
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.analyzeRegistrationDocument(
      {
        documentType: 'referral_letter',
        extractedText: 'Urgent oncology referral for breast lump.',
        fileName: 'referral.txt',
        mimeType: 'text/plain',
        language: 'en',
        patientId: 'patient-1',
      },
      'tenant-reg',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/registration/documents/analyze',
      {
        document_type: 'referral_letter',
        extracted_text: 'Urgent oncology referral for breast lump.',
        file_name: 'referral.txt',
        mime_type: 'text/plain',
        language: 'en',
        patient_id: 'patient-1',
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-reg' },
      },
    );
    expect(response.structuredPayload).toEqual(
      expect.objectContaining({
        requestedSpecialty: 'Oncology',
        urgency: 'Urgent',
      }),
    );
    expect(response.governance).toEqual(
      expect.objectContaining({
        governed_path: true,
      }),
    );
  });
});
