import { PatientAuthService } from './patient-auth.service';

describe('PatientAuthService', () => {
  const buildPatient = () => ({
    id: 'patient-1',
    patientNumber: 'MRN-001',
    firstName: 'Tariro',
    lastName: 'Moyo',
    dateOfBirth: new Date('1990-05-12'),
    gender: 'female',
    nationalId: '63-123456-A-12',
    phone: '+263771234567',
    email: 'existing@clinic.test',
    address: '12 Samora Machel Ave',
    city: 'Harare',
    emergencyContactName: 'Nyasha Moyo',
    emergencyContactPhone: '+263777000111',
    nextOfKinName: 'Kuda Moyo',
    nextOfKinPhone: '+263777000222',
    insuranceProvider: 'Premier',
    medicalAidProvider: 'Premier',
    insuranceNumber: 'PREM-445566',
    medicalAidNumber: 'PREM-445566',
    medicalAidPlan: 'Gold',
    portalAccessEnabled: false,
    portalEmailVerified: false,
  });

  const buildService = (overrides: {
    patient?: any;
    existingPatient?: any;
    intakeAssessment?: any;
  } = {}) => {
    const patient = overrides.patient ?? buildPatient();
    const existingPatient = overrides.existingPatient ?? null;
    const intakeAssessment = overrides.intakeAssessment ?? {
      completenessScore: 86,
      missingFields: ['insuranceProvider'],
      suspectedDuplicateCount: 1,
      duplicateCandidates: [{ patientId: 'duplicate-1', matchScore: 0.72, reasons: ['exact_phone_match'] }],
      coverageRiskLevel: 'information_required',
      coverageFlags: ['missing_insurance_provider'],
      consentReady: false,
      consentMissingItems: ['insuranceProvider'],
      frontDeskSummary: 'Need provider details before financial clearance.',
    };

    const patientRepository = {
      findOne: jest.fn()
        .mockResolvedValueOnce(patient)
        .mockResolvedValueOnce(existingPatient),
      save: jest.fn().mockImplementation(async (value) => value),
    };

    const tenantConnection = {
      getRepository: jest.fn().mockReturnValue(patientRepository),
    };

    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantConnection),
    };

    const registrationIntelligenceService = {
      assessRegistrationIntake: jest.fn().mockResolvedValue(intakeAssessment),
    };

    const emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    const jwtService = {
      sign: jest.fn(),
    };

    const service = new PatientAuthService(
      jwtService as any,
      tenantService as any,
      emailService as any,
      registrationIntelligenceService as any,
    );

    return {
      service,
      patient,
      patientRepository,
      registrationIntelligenceService,
      emailService,
      intakeAssessment,
    };
  };

  it('assesses registration readiness using registration intelligence without persisting', async () => {
    const { service, patient, registrationIntelligenceService, intakeAssessment } = buildService({
      existingPatient: { id: 'patient-2' },
    });

    const result = await service.assessRegistration(
      {
        patientNumber: patient.patientNumber,
        email: 'new.portal@clinic.test',
        password: 'Secret123!',
        dateOfBirth: '12/05/1990',
        phone: '+263771111111',
      },
      'kids-clinic',
    );

    expect(result.patient.patientNumber).toBe(patient.patientNumber);
    expect(result.emailConflict).toBe(true);
    expect(result.portalAccessEnabled).toBe(false);
    expect(result.intakeAssessment).toBe(intakeAssessment);
    expect(registrationIntelligenceService.assessRegistrationIntake).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        patientId: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: 'new.portal@clinic.test',
        phone: '+263771111111',
      }),
      { persist: false },
    );
  });

  it('includes persisted intake assessment when registration succeeds', async () => {
    const { service, patient, patientRepository, registrationIntelligenceService, intakeAssessment } = buildService();

    const result = await service.register(
      {
        patientNumber: patient.patientNumber,
        email: 'portal@clinic.test',
        password: 'Secret123!',
        dateOfBirth: '12/05/1990',
        phone: '+263771999999',
      },
      'kids-clinic',
    );

    expect(patientRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        portalAccessEnabled: true,
        email: 'portal@clinic.test',
        phone: '+263771999999',
      }),
    );
    expect(registrationIntelligenceService.assessRegistrationIntake).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        patientId: patient.id,
        email: 'portal@clinic.test',
      }),
      { persist: true, actorUserId: null },
    );
    expect(result.intakeAssessment).toBe(intakeAssessment);
  });
});
