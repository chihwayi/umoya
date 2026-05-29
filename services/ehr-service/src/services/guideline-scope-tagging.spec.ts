import { AnesthesiaService } from './anesthesia.service';
import { CdssHookService } from './cdss-hook.service';
import { GeriatricsService } from './geriatrics.service';
import { InfectionControlService } from './infection-control.service';
import { IcuService } from './icu.service';
import { OncologyService } from './oncology.service';
import { PediatricsService } from './pediatrics.service';
import { PatientPortalService } from './patient-portal.service';
import { PopulationHealthService } from './population-health.service';
import { PmtctService } from './pmtct.service';

describe('Guideline scope tagging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tags infection-control infection guidance with infectious disease scope', async () => {
    const cdssService = {
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
    };
    const service = new InfectionControlService(cdssService as any);
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn((payload) => payload),
        save: jest.fn(async (payload) => ({ id: 'infection-1', ...payload })),
      }),
    } as any;

    await service.reportInfection(
      { infectionType: 'MRSA bloodstream infection', deviceAssociated: true },
      'user-1',
      tenantDb,
    );

    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'mrsa bloodstream infection',
      expect.objectContaining({
        specialty: 'infectious_disease',
        module: 'infection_control',
      }),
    );
  });

  it('tags antimicrobial stewardship guidance with pharmacy medication-safety scope', async () => {
    const cdssService = {
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
    };
    const service = new InfectionControlService(cdssService as any);
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn((payload) => payload),
        save: jest.fn(async (payload) => ({ id: 'stewardship-1', ...payload })),
      }),
    } as any;

    await service.trackAntibiotic(
      { indication: 'pneumonia' },
      tenantDb,
    );

    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'pneumonia',
      expect.objectContaining({
        specialty: 'pharmacy',
        module: 'medication_safety',
      }),
    );
  });

  it('tags ICU guideline lookups with acute-care critical-care scope', async () => {
    const cdssService = {
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
    };
    const service = new IcuService({} as any, cdssService as any);

    await service.ventProtocol({ weightKg: 70 });
    await service.assessSedation({ rass: -2 });

    expect(cdssService.getGuidelines).toHaveBeenNthCalledWith(
      1,
      'mechanical ventilation lung protective protocol',
      expect.objectContaining({
        specialty: 'acute_care',
        module: 'critical_care',
      }),
    );
    expect(cdssService.getGuidelines).toHaveBeenNthCalledWith(
      2,
      'ICU sedation analgesia delirium PADIS',
      expect.objectContaining({
        specialty: 'acute_care',
        module: 'critical_care',
      }),
    );
  });

  it('tags PMTCT guideline lookups with obstetrics PMTCT scope', async () => {
    const cdssService = {
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
    };
    const service = new PmtctService({} as any, {} as any, cdssService as any);

    await service.merCalculate({ period: '202603' });

    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'PEPFAR MER indicators PMTCT',
      expect.objectContaining({
        specialty: 'obstetrics',
        module: 'pmtct',
      }),
    );
  });

  it('tags oncology targeted-therapy enrichment with oncology scope', async () => {
    const cdssService = {
      diagnosisAssist: jest.fn().mockResolvedValue({ recommendations: [] }),
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
    };
    const service = new OncologyService({} as any, {} as any, cdssService as any);
    jest.spyOn(service, 'getGenomicSummary').mockResolvedValue([
      {
        cancer_type: 'breast cancer',
        genomic_data: {
          HER2: 'positive',
        },
      },
    ] as any);

    await service.matchTargetedTherapies({} as any, 'case-1');

    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        specialty: 'oncology',
        module: 'targeted_therapy',
      }),
      true,
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'oncology targeted therapy breast cancer',
      expect.objectContaining({
        specialty: 'oncology',
        module: 'targeted_therapy',
      }),
    );
  });

  it('tags pulmonology, nephrology, malaria, TB, and immunization callers with explicit scope', async () => {
    const cdssService = {
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
      diagnosisAssist: jest.fn().mockResolvedValue({ source: 'hybrid_cdss_ai' }),
    };

    const pulmonologyModule = await import('./pulmonology.service');
    const nephrologyModule = await import('./nephrology.service');
    const malariaModule = await import('./malaria.service');
    const tbModule = await import('./tb.service');
    const immunizationModule = await import('./immunization.service');

    const pulmonology = new pulmonologyModule.PulmonologyService({} as any, cdssService as any);
    const nephrology = new nephrologyModule.NephrologyService({} as any, cdssService as any);
    const malaria = new malariaModule.MalariaService({} as any, cdssService as any);
    const tb = new tbModule.TbService(cdssService as any);
    const immunization = new immunizationModule.ImmunizationService(cdssService as any, null as any);

    await pulmonology.asthmaStepUp({});
    await pulmonology.prescribeOxygen({});
    await nephrology.assessDialysisAdequacy({});
    await malaria.recommendTreatment({});
    await tb.recommendRegimen({});
    await tb.screenForTb({ cough: true, coughDurationWeeks: 3, age: 40, gender: 'male', vitals: {}, hivStatus: 'negative' });
    await tb.analyseAdherence({ age: 40, gender: 'male', symptoms: ['missed doses'] });

    jest.spyOn(immunization as any, 'calculateRecommendedDate').mockReturnValue(new Date('2026-01-01T00:00:00.000Z'));
    jest.spyOn(immunization, 'getPatientImmunizations').mockResolvedValue([]);
    await immunization.getImmunizationForecast(
      'patient-1',
      new Date('2025-01-01T00:00:00.000Z'),
      {
        getRepository: jest.fn().mockReturnValue({
          find: jest.fn().mockResolvedValue([
            {
              vaccineName: 'BCG',
              vaccineCode: 'BCG',
              doseNumber: 1,
              recommendedAgeMonths: 0,
              scheduleType: 'routine',
            },
          ]),
        }),
      } as any,
    );
    await immunization.recordAdverseEvent(
      'imm-1',
      {
        eventDate: new Date('2026-03-24T00:00:00.000Z'),
        severity: 'severe',
        eventDescription: 'anaphylaxis',
        hospitalizationRequired: true,
      },
      'user-1',
      { query: jest.fn().mockResolvedValue([]) } as any,
    );

    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'asthma step-up therapy GINA',
      expect.objectContaining({ specialty: 'pulmonology', module: 'respiratory_care' }),
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'long-term oxygen therapy LTOT criteria',
      expect.objectContaining({ specialty: 'pulmonology', module: 'respiratory_care' }),
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'dialysis adequacy Kt/V',
      expect.objectContaining({ specialty: 'nephrology', module: 'renal_replacement_therapy' }),
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'malaria treatment protocol',
      expect.objectContaining({ specialty: 'infectious_disease', module: 'malaria_care' }),
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'tuberculosis',
      expect.objectContaining({ specialty: 'infectious_disease', module: 'tuberculosis_care' }),
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'immunization catch-up schedule',
      expect.objectContaining({ specialty: 'public_health', module: 'immunization' }),
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'tb_screen',
        specialty: 'infectious_disease',
        module: 'tuberculosis_care',
      }),
      false,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'tb_treatment_adherence',
        specialty: 'infectious_disease',
        module: 'tuberculosis_care',
      }),
      false,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({ specialty: 'public_health', module: 'immunization' }),
      true,
    );
  });

  it('tags pediatric growth and milestone assessments with pediatrics growth-and-development scope', async () => {
    const cdssService = {
      diagnosisAssist: jest.fn().mockResolvedValue({ source: 'hybrid_cdss_ai' }),
    };
    const service = new PediatricsService(cdssService as any);

    await service.assessGrowth({ age_months: 18, weight_kg: 9.0 });
    await service.assessMilestones({ age_months: 24, babbling: false });

    expect(cdssService.diagnosisAssist).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        context: 'growth_assessment',
        specialty: 'pediatrics',
        module: 'growth_and_development',
      }),
      true,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        context: 'developmental_milestone_assessment',
        specialty: 'pediatrics',
        module: 'growth_and_development',
      }),
      true,
    );
  });

  it('tags perioperative anesthesia guidance with explicit perioperative scope', async () => {
    const cdssService = {
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
    };
    const service = new AnesthesiaService(cdssService as any);

    await service.getPreAnesthesiaGuidance({ asaClass: 'III' }, 'kids-clinic');
    await service.getPonvProphylaxisGuidance({ historyOfPonv: true }, 'kids-clinic');
    await service.getPostoperativePainGuidance({ obstructiveSleepApnea: true }, 'kids-clinic');

    expect(cdssService.getGuidelines).toHaveBeenNthCalledWith(
      1,
      'pre-anesthesia assessment',
      expect.objectContaining({
        specialty: 'perioperative_care',
        module: 'anesthesia',
      }),
      'kids-clinic',
      undefined,
    );
    expect(cdssService.getGuidelines).toHaveBeenNthCalledWith(
      2,
      'ponv prophylaxis',
      expect.objectContaining({
        specialty: 'perioperative_care',
        module: 'anesthesia',
      }),
      'kids-clinic',
      undefined,
    );
    expect(cdssService.getGuidelines).toHaveBeenNthCalledWith(
      3,
      'postoperative pain management',
      expect.objectContaining({
        specialty: 'perioperative_care',
        module: 'postoperative_care',
      }),
      'kids-clinic',
      undefined,
    );
  });

  it('tags neurology, mental-health, NTD, and trial-matching callers with explicit scope', async () => {
    const cdssService = {
      diagnosisAssist: jest.fn().mockResolvedValue({
        source: 'hybrid_cdss_ai',
        matches: [{ nctId: 'NCT-1', eligibilityScore: 0.82, inclusionMet: [], exclusionFlags: [] }],
      }),
    };

    const neurologyModule = await import('./neurology.service');
    const mentalHealthModule = await import('./mental-health.service');
    const ntdModule = await import('./ntd.service');
    const trialsModule = await import('./clinical-trial-matching.service');

    const neurology = new neurologyModule.NeurologyService({} as any, cdssService as any);
    const mentalHealth = new mentalHealthModule.MentalHealthService({} as any, cdssService as any);
    const ntd = new ntdModule.NtdService({} as any, {} as any, cdssService as any);
    const trialService = new trialsModule.ClinicalTrialMatchingService(
      {
        getTenantDatabase: jest.fn().mockResolvedValue({
          getRepository: jest.fn().mockReturnValue({
            findOneBy: jest.fn().mockResolvedValue(null),
            create: jest.fn((payload) => payload),
            save: jest.fn(async (payload) => ({ id: 'trial-match-1', ...payload })),
          }),
        }),
      } as any,
      cdssService as any,
    );

    jest.spyOn(trialService as any, 'buildPatientProfile').mockResolvedValue({
      patientId: 'patient-1',
      primaryDiagnosis: 'breast cancer',
      age: 51,
      gender: 'female',
      currentMedications: [],
    });
    jest.spyOn(trialService as any, 'fetchTrials').mockResolvedValue([
      {
        nctId: 'NCT-1',
        title: 'Precision Oncology Trial',
        phase: 'Phase 2',
        sponsor: 'Medicore Research',
        contactEmail: 'trial@example.com',
        locations: ['Harare, Zimbabwe'],
      },
    ]);

    await neurology.triageStroke({ facial_droop: true });
    await neurology.classifySeizure({ generalised: true });
    await neurology.diagnoseHeadache({ thunderclap: true });
    await mentalHealth.scoreScreening('PHQ-9', { q1: 2, q2: 3 });
    await ntd.screenNtd({ symptoms: ['blood in urine'] });
    await trialService.matchTrials('kids-clinic', 'patient-1');

    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'stroke_triage', specialty: 'neurology', module: 'stroke_care' }),
      true,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'seizure_classification', specialty: 'neurology', module: 'epilepsy_care' }),
      true,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'headache_diagnosis', specialty: 'neurology', module: 'headache_care' }),
      true,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'mental_health_screening', specialty: 'mental_health', module: 'screening_and_crisis' }),
      true,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'ntd_screen', specialty: 'infectious_disease', module: 'ntd_and_outbreak_care' }),
      true,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'clinical_trial_eligibility', specialty: 'oncology', module: 'clinical_trials' }),
      true,
    );
  });

  it('tags geriatrics and population-health risk workflows with explicit scope', async () => {
    const cdssService = {
      riskAssessment: jest.fn().mockResolvedValue({ risk_level: 'high' }),
    };

    const geriatrics = new GeriatricsService({} as any, cdssService as any);
    const populationHealth = new PopulationHealthService(cdssService as any);
    const repo = {
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => ({ id: 'registry-1', ...payload })),
      update: jest.fn(async () => undefined),
    };
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue(repo),
    } as any;

    await geriatrics.assessFrailty({ age: 84 });
    await geriatrics.assessFallRisk({ age: 84, history_of_falls: true });
    await populationHealth.enrollInRegistry(tenantDb, 'patient-1', {
      conditionCode: 'I10',
      conditionName: 'Hypertension',
      conditionType: 'hypertension',
      riskLevel: 'moderate',
    });

    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'frailty_assessment',
        specialty: 'geriatrics',
        module: 'frailty_and_cga',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'fall_risk',
        specialty: 'geriatrics',
        module: 'fall_prevention',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'chronic_disease_registry',
        specialty: 'primary_care',
        module: 'population_health',
      }),
    );
  });

  it('tags patient-portal health insights with explicit primary-care self-service scope', async () => {
    const cdssService = {
      riskAssessment: jest.fn().mockResolvedValue({ risk_level: 'moderate', recommendations: [] }),
      detectCareGaps: jest.fn().mockResolvedValue({ gaps: [] }),
    };
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue({
        query: jest
          .fn()
          .mockResolvedValueOnce([{ date_of_birth: '1988-01-01', gender: 'female', first_name: 'Tari' }])
          .mockResolvedValueOnce([{ blood_pressure_systolic: 150, blood_pressure_diastolic: 95, recorded_at: '2026-03-24T10:00:00.000Z' }])
          .mockResolvedValueOnce([{ medication_name: 'amlodipine' }])
          .mockResolvedValueOnce([{ condition_type: 'hypertension', condition_name: 'Hypertension', status: 'active', risk_level: 'moderate' }]),
      }),
    };
    const service = new PatientPortalService(tenantService as any, cdssService as any, {} as any);

    await service.getPatientHealthInsights('patient-1', 'kids-clinic');

    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'patient_portal_health_insights',
        specialty: 'primary_care',
        module: 'patient_self_service',
      }),
      expect.any(Object),
      'kids-clinic',
    );
    expect(cdssService.detectCareGaps).toHaveBeenCalledWith(
      expect.any(Number),
      'female',
      [],
      ['Hypertension'],
      expect.objectContaining({
        tenantId: 'kids-clinic',
        patientId: 'patient-1',
        context: 'patient_portal_health_insights',
        specialty: 'primary_care',
        module: 'patient_self_service',
      }),
    );
  });

  it('tags CDSS hook orchestrators with explicit workflow scope', async () => {
    const cdssService = {
      riskAssessment: jest.fn().mockResolvedValue({ risk_level: 'high' }),
      diagnosisAssist: jest.fn().mockResolvedValue({ recommendations: [] }),
      getGuidelines: jest.fn().mockResolvedValue({ source: 'advanced_cdss' }),
      detectCareGaps: jest.fn().mockResolvedValue({ gaps: [] }),
    };
    const service = new CdssHookService(cdssService as any);
    const tenantDb = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'patient-1', dateOfBirth: '1975-01-01', gender: 'female' }),
      }),
    } as any;

    await service.handleTriageAssessment({
      tenantId: 'kids-clinic',
      tenantDb,
      assessment: { patient_id: 'patient-1', chief_complaint: 'Chest pain', priority: 'urgent' },
      chiefComplaintConcept: { conceptId: '1', term: 'Chest pain' },
      observationConcepts: [{ conceptId: '2', term: 'Shortness of breath' }],
    });
    await service.handleVitalsRecorded({
      tenantId: 'kids-clinic',
      tenantDb,
      vitals: { patient_id: 'patient-1', systolic: 80, diastolic: 50, heart_rate: 130 },
    });
    await service.handleLabOrderCreated({
      tenantId: 'kids-clinic',
      tenantDb,
      labOrder: { patient_id: 'patient-1', clinical_indication: 'anemia workup' },
    });
    await service.handleImagingOrderCreated({
      tenantId: 'kids-clinic',
      tenantDb,
      imagingOrder: { patient_id: 'patient-1', clinical_indication: 'lung nodule' },
    });
    await service.handleNursingNoteRecorded({
      tenantId: 'kids-clinic',
      tenantDb,
      note: { patient_id: 'patient-1', observations: 'confusion', outcomes: 'fall risk' },
    });

    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'triage_risk_assessment',
        specialty: 'acute_care',
        module: 'emergency_triage',
      }),
      tenantDb,
      'kids-clinic',
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'vital_sign_surveillance',
        specialty: 'acute_care',
        module: 'clinical_surveillance',
      }),
      tenantDb,
      'kids-clinic',
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'triage_assessment',
        specialty: 'acute_care',
        module: 'emergency_triage',
      }),
      true,
      'kids-clinic',
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'anemia workup',
      expect.objectContaining({
        specialty: 'primary_care',
        module: 'diagnostic_workup',
      }),
      'kids-clinic',
    );
    expect(cdssService.getGuidelines).toHaveBeenCalledWith(
      'lung nodule',
      expect.objectContaining({
        specialty: 'radiology',
        module: 'imaging_appropriateness',
      }),
      'kids-clinic',
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'nursing_assessment',
        specialty: 'nursing_care',
        module: 'nursing_assessment',
      }),
      true,
      'kids-clinic',
    );
    expect(cdssService.detectCareGaps).toHaveBeenCalledWith(
      expect.any(Number),
      'female',
      undefined,
      ['anemia workup'],
      expect.objectContaining({
        tenantId: 'kids-clinic',
        context: 'lab_order_follow_up',
        specialty: 'primary_care',
        module: 'diagnostic_workup',
      }),
    );
    expect(cdssService.detectCareGaps).toHaveBeenCalledWith(
      expect.any(Number),
      'female',
      undefined,
      ['lung nodule'],
      expect.objectContaining({
        tenantId: 'kids-clinic',
        context: 'imaging_follow_up',
        specialty: 'radiology',
        module: 'imaging_appropriateness',
      }),
    );
    expect(cdssService.detectCareGaps).toHaveBeenCalledWith(
      expect.any(Number),
      'female',
      undefined,
      expect.arrayContaining(['confusion', 'fall risk']),
      expect.objectContaining({
        tenantId: 'kids-clinic',
        context: 'nursing_follow_up',
        specialty: 'nursing_care',
        module: 'nursing_assessment',
      }),
    );
  });

  it('tags remaining specialty risk workflows with explicit scope', async () => {
    const cdssService = {
      riskAssessment: jest.fn().mockResolvedValue({ risk_level: 'high' }),
    };

    const malariaModule = await import('./malaria.service');
    const nephrologyModule = await import('./nephrology.service');
    const tbModule = await import('./tb.service');
    const pmtctModule = await import('./pmtct.service');
    const icuModule = await import('./icu.service');
    const mentalHealthModule = await import('./mental-health.service');
    const ntdModule = await import('./ntd.service');

    const malariaRepo = {
      create: jest.fn((payload) => payload),
      save: jest.fn(async (payload) => ({ id: 'contact-1', ...payload })),
    };
    const malaria = new malariaModule.MalariaService(
      {
        getTenantDatabase: jest.fn().mockResolvedValue({
          getRepository: jest.fn().mockReturnValue(malariaRepo),
        }),
      } as any,
      cdssService as any,
    );
    const nephrology = new nephrologyModule.NephrologyService({} as any, cdssService as any);
    const tb = new tbModule.TbService(cdssService as any);
    const pmtct = new pmtctModule.PmtctService({} as any, {} as any, cdssService as any);
    const icu = new icuModule.IcuService({} as any, cdssService as any);
    const mentalHealth = new mentalHealthModule.MentalHealthService({} as any, cdssService as any);
    const ntd = new ntdModule.NtdService({} as any, {} as any, cdssService as any);

    await malaria.addContact('kids-clinic', { contactPatientId: 'patient-2', exposureType: 'household' } as any);
    await malaria.scoreSeverity({ age: 5, severe: true });
    await nephrology.stageCkd({ egfr: 28, acr: 340 });
    await tb.assessContactRisk({ contactId: 'patient-3', contactAge: 4, gender: 'female' });
    await pmtct.pmtctRisk({ patient_id: 'patient-4', age: 29, gender: 'female' });
    await icu.calculateSofa({ gcs: 10, creatinine: 2.4 });
    await mentalHealth.assessSuicideRisk({ ideation_level: 4, has_intent: true });
    await ntd.choleraRisk({ watery_diarrhea_episodes: 5, vomiting: true });

    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'malaria_contact',
        specialty: 'infectious_disease',
        module: 'malaria_care',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'malaria_severity',
        specialty: 'infectious_disease',
        module: 'malaria_care',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'ckd_staging',
        specialty: 'nephrology',
        module: 'chronic_kidney_disease',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'tuberculosis_contact',
        specialty: 'infectious_disease',
        module: 'tuberculosis_care',
      }),
      null,
      undefined,
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'pmtct',
        specialty: 'obstetrics',
        module: 'pmtct',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'sofa_score',
        specialty: 'acute_care',
        module: 'critical_care',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'suicide_risk',
        specialty: 'mental_health',
        module: 'screening_and_crisis',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'cholera_risk',
        specialty: 'infectious_disease',
        module: 'ntd_and_outbreak_care',
      }),
    );
  });
});
