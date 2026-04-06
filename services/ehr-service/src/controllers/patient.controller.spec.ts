import { Test, TestingModule } from '@nestjs/testing';
import { PatientController } from './patient.controller';
import { PatientService } from '../services/patient.service';
import { ProactiveAiService } from '../services/proactive-ai.service';
import { PatientIntelligenceService } from '../services/patient-intelligence.service';

describe('PatientController', () => {
  let controller: PatientController;
  let service: PatientService;
  const mockTenantDb = {} as any;

  const mockPatientService = {
    getAllPatients: jest.fn(),
    searchPatients: jest.fn(),
    advancedSearch: jest.fn(),
    getStats: jest.fn(),
    getPatientById: jest.fn(),
    getPatientByMRN: jest.fn(),
    getPatientContext: jest.fn(),
    createPatient: jest.fn(),
    updatePatient: jest.fn(),
    deactivatePatient: jest.fn(),
  };

  const mockProactiveAiService = {
    triggerAnalysis: jest.fn(),
    getSnapshot: jest.fn(),
  };

  const mockPatientIntelligenceService = {
    getPatientIntelligence: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientController],
      providers: [
        {
          provide: PatientService,
          useValue: mockPatientService,
        },
        {
          provide: ProactiveAiService,
          useValue: mockProactiveAiService,
        },
        {
          provide: PatientIntelligenceService,
          useValue: mockPatientIntelligenceService,
        },
      ],
    }).compile();

    controller = module.get<PatientController>(PatientController);
    service = module.get<PatientService>(PatientService);
    jest.clearAllMocks();
  });

  it('returns shared patient context via getPatientContext', async () => {
    const expected = {
      patient: { id: 'patient-1', fullName: 'Jane Doe' },
      latestVitals: { id: 'vitals-1' },
      modules: {
        hiv: { latestEnrollment: { id: 'hiv-enroll-1' } },
        maternity: { latestEnrollment: null },
        oncology: { latestCase: null, activeCaseCount: 0 },
        telemedicine: { latestConsultation: null },
        lab: { latestCriticalAlert: null, unresolvedAlertCount: 0 },
        pharmacy: { latestPrescription: null, activePrescriptionCount: 0 },
      },
      generatedAt: '2026-03-05T12:00:00.000Z',
    };
    mockPatientService.getPatientContext.mockResolvedValue(expected);
    mockProactiveAiService.triggerAnalysis.mockResolvedValue(undefined);
    mockProactiveAiService.getSnapshot.mockResolvedValue(null);

    const result = await controller.getPatientContext(
      'patient-1',
      { tenantDb: mockTenantDb, tenantId: 'tenant-1', user: { userId: 'user-1' } } as any,
    );

    expect(service.getPatientContext).toHaveBeenCalledWith('patient-1', mockTenantDb);
    expect(mockProactiveAiService.triggerAnalysis).toHaveBeenCalledWith({
      patientId: 'patient-1',
      tenantId: 'tenant-1',
      triggeredByUserId: 'user-1',
      triggerType: 'chart_open',
    });
    expect(mockProactiveAiService.getSnapshot).toHaveBeenCalledWith('patient-1', 'tenant-1');
    expect(result).toEqual(expected);
  });

  it('returns unified patient intelligence via getPatientIntelligence', async () => {
    const intelligence = {
      summary: { tone: 'attention', headline: 'Several AI signals need follow-through.' },
      nextActions: [{ id: 'gap:1', title: 'Close care gap' }],
    };
    mockPatientIntelligenceService.getPatientIntelligence.mockResolvedValue(intelligence);

    const result = await controller.getPatientIntelligence(
      'patient-1',
      { tenantDb: mockTenantDb, tenantId: 'tenant-1', user: { userId: 'user-1' } } as any,
    );

    expect(mockPatientIntelligenceService.getPatientIntelligence).toHaveBeenCalledWith(
      'patient-1',
      'tenant-1',
      mockTenantDb,
      'user-1',
    );
    expect(result).toEqual(intelligence);
  });
});
