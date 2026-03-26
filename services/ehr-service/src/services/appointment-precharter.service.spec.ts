import { AppointmentPrecharterService } from './appointment-precharter.service';

describe('AppointmentPrecharterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes prechart generation through governed CdssService calls', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const tenantDb = {
      query: jest.fn()
        .mockResolvedValueOnce([{ id: 'appt-1', patient_id: 'patient-1', start_time: new Date('2026-03-24T09:00:00Z') }])
        .mockResolvedValueOnce([{ id: 'patient-1', first_name: 'Jane', last_name: 'Doe', date_of_birth: '2000-01-01', gender: 'female' }])
        .mockResolvedValueOnce([{ chief_complaint: 'cough and fever' }])
        .mockResolvedValueOnce([{ code: 'J18', description: 'Pneumonia' }]),
      getRepository: jest.fn().mockReturnValue(repo),
    } as any;

    const cdssService = {
      patientSummarize: jest.fn().mockResolvedValue({
        clinical_summary: 'Stable but needs reassessment.',
        active_problems: [{ code: 'J18', description: 'Pneumonia' }],
        current_medications: [{ name: 'Amoxicillin' }],
        allergies: [{ substance: 'Penicillin' }],
      }),
      detectCareGaps: jest.fn().mockResolvedValue({
        care_gaps: [{ gap_type: 'follow_up', description: 'Follow-up chest review' }],
      }),
      diagnosisAssist: jest.fn().mockResolvedValue({
        suggested_diagnoses: [{ diagnosis: 'Pneumonia', icd10: 'J18', confidence: 0.8 }],
      }),
      riskAssessment: jest.fn().mockResolvedValue({
        risk_level: 'moderate',
        overall_score: 0.62,
        factors: [{ factor: 'Recent respiratory symptoms', impact: 'moderate' }],
      }),
    };

    const service = new AppointmentPrecharterService({} as any, cdssService as any);
    const result = await service.generateForAppointment('appt-1', tenantDb, 'kids-clinic');

    expect(cdssService.patientSummarize).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        patientName: 'Jane Doe',
      }),
      'kids-clinic',
      tenantDb,
    );
    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        chiefComplaint: 'cough and fever',
        context: 'previsit_planning_diagnosis',
        specialty: 'primary_care',
        module: 'previsit_planning',
      }),
      true,
      'kids-clinic',
      tenantDb,
    );
    expect(cdssService.detectCareGaps).toHaveBeenCalledWith(
      expect.any(Number),
      'female',
      [],
      ['Pneumonia'],
      expect.objectContaining({
        tenantId: 'kids-clinic',
        tenantDb,
        patientId: 'patient-1',
        context: 'previsit_planning',
        specialty: 'primary_care',
        module: 'previsit_planning',
      }),
    );
    expect(cdssService.riskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        gender: 'female',
        context: 'previsit_planning',
        specialty: 'primary_care',
        module: 'previsit_planning',
      }),
      tenantDb,
      'kids-clinic',
    );
    expect(result.clinicalSummary).toBe('Stable but needs reassessment.');
    expect(result.suggestedAgenda).toContain('Address care gap: Follow-up chest review');
    expect(result.suggestedAgenda).toContain('Review possible diagnosis: Pneumonia (J18)');
  });
});
